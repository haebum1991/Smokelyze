
import { map } from "./map-init.js";
import { auth, onAuthStateChanged } from "./fb-init.js";
import * as utils from "./utils.js";
import { showErrorToast, showTaskNotification } from "./loader.js";
import { updateAuthButton } from "./signin.js";
import { setHysplitDrawer } from "./ui-toggles.js";


// --- Configuration & State ---
// Connect directly to the AWS EC2 IP to bypass this limit.
const HYSPLIT_API_URL = "http://13.220.91.222:8000/hysplit";
const STORAGE_KEY = "smokelyze_hysplit_history";

const state = {
    pendingLngLat: null,
    currentUser: null,
    history: [], // [{ runId, color, params, visible }]
    runCount: 0,
    isHysplitMode: false,
    modalBaseParams: null,
};

const RAINBOW_COLORS = ["#007cff", "#ff4d4d", "#2ecc71", "#e67e22", "#9b59b6", "#1abc9c", "#f1c40f"];
const LAYER_SUFFIXES = ["wall", "line", "arrow", "points", "vispoints", "point"];

// --- Initialization ---
function init() {
    if (!map) return;

    // 1. Capture coordinate from context menu (parallel to fb-MapPost)
    map.on("contextmenu", (e) => {
        state.pendingLngLat = e.lngLat;
    });

    // 4. Modal validation listeners
    const modalBody = document.querySelector("#HysplitModalOverlay .MapPost-modal-body");
    if (modalBody) {
        modalBody.addEventListener("input", checkHysplitDuplicate);
        modalBody.addEventListener("change", checkHysplitDuplicate);
    }

    // 1b. Map click for Hysplit Mode
    map.on("click", (e) => {
        if (state.isHysplitMode) {
            state.pendingLngLat = e.lngLat;
            uiShowHysplitModal();
            handleHysplitModeToggle(false);
        }
    });

    // 2. Register Arrow Icon (Only once)
    registerArrowIcon();

    // 3. Global Event Delegation
    document.body.addEventListener("click", (e) => {
        // A. Ctx Menu Button Click
        const hysplitBtn = e.target.closest("#MapPostBtnHysplit");
        if (hysplitBtn) {
            e.preventDefault();
            uiShowHysplitModal();
            return;
        }

        // B. Modal Submit
        if (e.target.closest("#HysplitBtnSubmit")) {
            e.preventDefault();
            clickOnSubmitHysplit();
            return;
        }

        // C. Modal Cancel/Close
        if (e.target.closest("#HysplitBtnCancel") || e.target.closest("#HysplitModalClose")) {
            uiHideHysplitModal();
            return;
        }

        // D. Toggle Visibility from Drawer
        const toggleBtn = e.target.closest(".hysplit-item-toggle");
        if (toggleBtn) {
            const runId = parseInt(toggleBtn.dataset.runId);
            toggleTrajectoryVisibility(runId);
            return;
        }

        // E. Remove from Drawer
        const removeBtn = e.target.closest(".hysplit-item-remove");
        if (removeBtn) {
            const runId = parseInt(removeBtn.dataset.runId);
            removeTrajectory(runId);
            return;
        }

        // F. New Hysplit from drawer button
        if (e.target.closest("#HysplitBtnNew")) {
            handleHysplitModeToggle(true);
            return;
        }

        // H. Click on Item (Re-run)
        const itemEl = e.target.closest(".Hysplit-item");
        if (itemEl && !e.target.closest("button")) {
            const runId = parseInt(itemEl.dataset.runId);
            const item = state.history.find(h => h.runId === runId);
            if (item) {
                state.pendingLngLat = { lng: item.params.lon, lat: item.params.lat };
                uiShowHysplitModal(item.params);
            }
            return;
        }
        
        // J. Focus Map on Receptor
        const focusBtn = e.target.closest(".hysplit-item-focus");
        if (focusBtn) {
            const runId = parseInt(focusBtn.dataset.runId);
            const item = state.history.find(h => h.runId === runId);
            if (item && map) {
                map.flyTo({
                    center: [item.params.lon, item.params.lat],
                    zoom: 10,
                    essential: true
                });
            }
            return;
        }
        
        // I. Download CSV
        const csvBtn = e.target.closest(".export-btn-csv");

        if (csvBtn) {
            const runId = parseInt(csvBtn.dataset.runId);
            downloadTrajectoryAsCSV(runId);
            return;
        }

        // G. Clear All
        if (e.target.closest("#HysplitBtnClearAll")) {
            if (confirm("Clear all HYSPLIT trajectories?")) {
                clearHysplitTrajectory();
            }
            return;
        }
    });

    // 3. Auth State Monitoring
    onAuthStateChanged(auth, (user) => {
        state.currentUser = user;
        updateAuthButton("MapPostBtnHysplit", user, "Run HYSPLIT");
        updateAuthButton("HysplitBtnNew", user, "+Trajectory");

        if (user) {
            // Restore from LocalStorage when logged in
            if (map.isStyleLoaded()) {
                loadFromStorage();
            } else {
                map.once("styledata", loadFromStorage);
            }
        } else {
            // Clear map but keep LocalStorage when logged out
            clearHysplitTrajectory(false);
        }
    });
}

/**
 * Creates and registers a 10x10 yellow arrow icon for the trajectory flow.
 */
function registerArrowIcon() {
    if (!map) return;

    if (!map.isStyleLoaded()) {
        map.once("styledata", registerArrowIcon);
        return;
    }

    if (map.hasImage("hysplit-arrow-blue")) return;

    // Use a clean SVG (Lucide-like) arrow in Blue
    const svgString = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#007cff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12h14"></path>
            <path d="m12 5 7 7-7 7"></path>
        </svg>
    `;

    const img = new Image();
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
        map.addImage("hysplit-arrow-blue", img, { pixelRatio: 1 });
        URL.revokeObjectURL(url);
    };
    img.src = url;
}

export function handleHysplitModeToggle(force) {
    state.isHysplitMode = (force !== undefined) ? force : !state.isHysplitMode;
    const mapEl = document.getElementById("map");
    if (state.isHysplitMode) {
        mapEl.classList.add("Hysplit-mode-cursor");
        if (showErrorToast) showErrorToast("HYSPLIT Mode: Click on the map to select a starting point.", "info");
        setHysplitDrawer(false);
    } else {
        mapEl.classList.remove("Hysplit-mode-cursor");
    }
}

// --- UI Logic ---
function uiShowHysplitModal(params = null) {
    if (!state.currentUser) {
        utils.showAuthOverlay();
        return;
    }

    // Hide original MapPost context menu
    const ctxMenu = document.getElementById("MapPostContextMenu");
    if (ctxMenu) ctxMenu.style.display = "none";

    const lngLat = state.pendingLngLat;
    if (!lngLat) return;

    if (state.previewMarker) state.previewMarker.remove();
    const el = document.createElement("div");
    el.className = "MapPost-pointer-preview";
    el.innerHTML = `<svg viewBox="0 0 24 24" width="40" height="40"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="#007cff" stroke="white" stroke-width="1.5"/><circle cx="12" cy="10" r="3" fill="white"/></svg>`;
    state.previewMarker = new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat(lngLat).addTo(map);

    const modalOverlay = document.getElementById("HysplitModalOverlay");
    const locEl = document.getElementById("HysplitFormLocation");
    const dateEl = document.getElementById("HysplitFormDate");
    const dateVal = document.getElementById("datePicker")?.value || "";

    if (locEl) locEl.innerText = `${lngLat.lng.toFixed(4)}, ${lngLat.lat.toFixed(4)}`;
    if (dateEl) {
        let cleanDate = params ? params.date : dateVal;
        if (cleanDate && cleanDate.includes(" ")) cleanDate = cleanDate.split(" ")[0];
        dateEl.value = cleanDate;
    }

    if (modalOverlay) modalOverlay.style.display = "flex";

    // Set form fields if params exist
    if (params) {
        const timeEl = document.getElementById("HysplitFormTime");
        const durEl = document.getElementById("HysplitFormDuration");
        const heightEl = document.getElementById("HysplitFormHeight");

        if (timeEl) timeEl.value = params.time;
        if (durEl) durEl.value = params.duration;
        if (heightEl) heightEl.value = params.height;

        const dirRadio = document.querySelector(`input[name="HysplitDirection"][value="${params.direction}"]`);
        if (dirRadio) dirRadio.checked = true;
    }

    // Set base params for change detection
    state.modalBaseParams = params;
    checkHysplitDuplicate();
}

function checkHysplitDuplicate() {
    const submitBtn = document.getElementById("HysplitBtnSubmit");
    const titleEl = document.getElementById("HysplitModalTitle");
    if (!submitBtn || !titleEl) return;

    if (!state.modalBaseParams) {
        titleEl.innerText = "HYSPLIT Simulation";
        submitBtn.disabled = false;
        return;
    }

    const time = document.getElementById("HysplitFormTime").value;
    const directionEl = document.querySelector('input[name="HysplitDirection"]:checked');
    const direction = directionEl ? directionEl.value : "backward";
    const duration = parseFloat(document.getElementById("HysplitFormDuration").value);
    const height = parseFloat(document.getElementById("HysplitFormHeight").value);
    const date = document.getElementById("HysplitFormDate").value;

    const b = state.modalBaseParams;
    const isSame = (
        date === b.date &&
        time === b.time &&
        direction === b.direction &&
        duration === b.duration &&
        height === b.height
    );

    if (isSame) {
        titleEl.innerText = "HYSPLIT Simulation (Conditions are identical)";
        submitBtn.disabled = true;
        submitBtn.style.opacity = "0.5";
    } else {
        titleEl.innerText = "HYSPLIT Simulation";
        submitBtn.disabled = false;
        submitBtn.style.opacity = "1";
    }
}

function uiHideHysplitModal() {
    const modal = document.getElementById("HysplitModalOverlay");
    if (modal) modal.style.display = "none";
    if (state.previewMarker) {
        state.previewMarker.remove();
        state.previewMarker = null;
    }
    handleHysplitModeToggle(false);
}

// --- Persistence ---
function saveToStorage() {
    try {
        // Limit storage to last 10 items to prevent hitting quota
        const toSave = state.history.slice(0, 10);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
        console.warn("HYSPLIT: Failed to save to localStorage", e);
    }
}

function loadFromStorage() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
        const history = JSON.parse(saved);
        // Render in reverse to maintain original unshift order
        [...history].reverse().forEach(item => {
            renderHysplitTrajectory(item.data, item.params.direction, item.runId, true, item.params);
        });
    } catch (e) {
        console.error("HYSPLIT: Error loading from storage", e);
    }
}

// --- API & Execution ---
async function clickOnSubmitHysplit() {
    const submitBtn = document.getElementById("HysplitBtnSubmit");
    const time = document.getElementById("HysplitFormTime").value;
    const directionEl = document.querySelector('input[name="HysplitDirection"]:checked');
    const direction = directionEl ? directionEl.value : "backward";
    const duration = parseFloat(document.getElementById("HysplitFormDuration").value);
    const height = parseFloat(document.getElementById("HysplitFormHeight").value);
    const date = document.getElementById("HysplitFormDate").value;
    const lngLat = state.pendingLngLat;

    if (!lngLat || !date) return alert("Missing location or date.");

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = "Running...";
    }

    // Close modal immediately so user can continue
    uiHideHysplitModal();

    const task = showTaskNotification("HYSPLIT Simulation", "Requesting trajectory from AWS...");

    try {
    
        // Get the ID token for the current user to secure the API call
        const idToken = await auth.currentUser.getIdToken(true);
        
        const params = new URLSearchParams({
            lon: lngLat.lng,
            lat: lngLat.lat,
            date: date,
            time: time,
            direction: direction,
            duration: duration,
            height: height
        });

        // Use direct IP but with Authorization header
        const response = await fetch(`${HYSPLIT_API_URL}?${params.toString()}`, {
            method: "POST", // POST is generally better for actions like starting a simulation
            mode: "cors",
            headers: {
                "Authorization": `Bearer ${idToken}`
            }
        });

        if (!response.ok) throw new Error("API request failed");
        const data = await response.json();
        if (data.error) throw new Error(data.error);

        const currentParams = {
            lon: lngLat.lng,
            lat: lngLat.lat,
            date: date,
            time: time,
            direction: direction,
            duration: duration,
            height: height
        };
        task.update("Rendering trajectory...", "running");
        renderHysplitTrajectory(data, direction, null, false, currentParams);
        
        task.update("Simulation complete!", "success");

        // Automatically open drawer if hidden
        const drawer = document.getElementById("HysplitDrawer");
        if (drawer && !drawer.classList.contains("open")) {
            setHysplitDrawer(true);
        }
    } catch (err) {
        console.error("HYSPLIT failed:", err);
        task.update(`Failed: ${err.message}`, "error");
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = "Run Simulation";
        }
    }
}

// --- Rendering & List Management ---
export function clearHysplitTrajectory(clearHistory = true) {
    if (!map) return;
    const style = map.getStyle();

    if (clearHistory) {
        state.history = [];
        saveToStorage();
    } else {
        state.history.forEach(item => {
            item.visible = false;
        });
    }

    updateHysplitDrawerList();

    // Remove all layers starting with hysplit-
    if (style.layers) {
        style.layers
            .filter(l => l.id.startsWith("hysplit-"))
            .forEach(l => map.removeLayer(l.id));
    }
    // Remove all sources starting with hysplit-
    if (style.sources) {
        Object.keys(style.sources)
            .filter(id => id.startsWith("hysplit-"))
            .forEach(id => map.removeSource(id));
    }
}

function updateHysplitDrawerList() {
    const listEl = document.getElementById("HysplitDrawerList");
    if (!listEl) return;

    if (state.history.length === 0) {
        listEl.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-main); font-size: 1.4rem;">No trajectories yet.<br>Click a point on map or use the button above.</div>`;
        return;
    }

    listEl.innerHTML = state.history.map(item => {
        const p = item.params;
        const visibleCls = item.visible ? "active" : "";
        const eyeIcon = item.visible
            ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
            : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

        return `
            <div class="Hysplit-item" data-run-id="${item.runId}" style="border-left-color: ${item.color}; border-left-width: 5px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                    <div style="font-size: 1.3rem; font-weight: bold; color: var(--text-heading);">
                        ${p.date} UTC (${p.direction === "backward" ? "B" : "F"})
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="hysplit-item-focus ui-btn-close" data-run-id="${item.runId}" title="Focus on map">
                            <svg width="20" height="20">
                                <use xlink:href="#icon-location" />
                            </svg>
                        </button>
                        <button class="hysplit-item-toggle ui-btn-close ${visibleCls}" data-run-id="${item.runId}">
                            ${eyeIcon}
                        </button>
                        <button class="hysplit-item-remove ui-btn-close" data-run-id="${item.runId}">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    </div>
                </div>
                <div style="font-size: 1.1rem; color: var(--text-main); display: flex; justify-content: space-between; align-items: flex-end;">
                    <div>
                        AGL: ${p.height}m | Dur: ${p.duration}h<br>
                        Loc: ${parseFloat(p.lon).toFixed(3)}, ${parseFloat(p.lat).toFixed(3)}
                    </div>
                    <button class="export-btn-csv" data-run-id="${item.runId}">
                        ⬇ .CSV
                    </button>
                </div>
            </div>
        `;
    }).join("");
}

function toggleTrajectoryVisibility(runId) {
    const item = state.history.find(h => h.runId === runId);
    if (!item) return;

    item.visible = !item.visible;

    if (item.visible) {
        const testLayer = `hysplit-layer-point-${runId}`;
        if (!map.getLayer(testLayer)) {
            drawTrajectoryLayers(item.runId, item.data, item.params.direction, item.color, true);
            updateHysplitDrawerList();
            return;
        }
    }

    const visibility = item.visible ? "visible" : "none";
    LAYER_SUFFIXES.forEach(suffix => {
        const layerId = `hysplit-layer-${suffix}-${runId}`;
        if (map.getLayer(layerId)) {
            map.setLayoutProperty(layerId, "visibility", visibility);
        }
    });

    updateHysplitDrawerList();
}

function removeTrajectory(runId) {
    state.history = state.history.filter(h => h.runId !== runId);
    saveToStorage();

    LAYER_SUFFIXES.forEach(suffix => {
        const layerId = `hysplit-layer-${suffix}-${runId}`;
        if (map.getLayer(layerId)) map.removeLayer(layerId);
    });

    if (map.getSource(`hysplit-src-traj-${runId}`)) map.removeSource(`hysplit-src-traj-${runId}`);
    if (map.getSource(`hysplit-src-wall-${runId}`)) map.removeSource(`hysplit-src-wall-${runId}`);

    updateHysplitDrawerList();
}

/**
 * Converts trajectory data to CSV and triggers a download.
 */
function downloadTrajectoryAsCSV(runId) {
    const item = state.history.find(h => h.runId === runId);
    if (!item || !item.data) return;

    const data = item.data;
    const keys = Object.keys(data[0]);
    const csvRows = [keys.join(",")];

    data.forEach(pt => {
        const row = keys.map(k => {
            let val = pt[k];
            if (val === undefined || val === null) return "";
            // Wrap in quotes if value contains a comma
            if (typeof val === "string" && val.includes(",")) {
                return `"${val}"`;
            }
            return val;
        });
        csvRows.push(row.join(","));
    });

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    const filename = `hysplit_${item.params.date}_${item.params.time}_${item.runId}.csv`;

    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function renderHysplitTrajectory(data, direction, existingRunId = null, isRestoring = false, forcedParams = null) {
    if (!map || !data || data.length === 0) return;

    const runId = existingRunId || Date.now();
    const color = RAINBOW_COLORS[state.runCount % RAINBOW_COLORS.length];
    state.runCount++;

    // Draw on Map
    drawTrajectoryLayers(runId, data, direction, color, isRestoring);

    // Update History & Drawer
    // Update History & Drawer (Receptor is always data[0] in current API response)
    const receptorPoint = [data[0].lon, data[0].lat];
    const params = forcedParams || {
        lon: receptorPoint[0],
        lat: receptorPoint[1],
        date: data[0].date.includes(" ") ? data[0].date.split(" ")[0] : data[0].date,
        time: data[0].date2.split(" ")[1].split(":")[0],
        direction: direction,
        duration: data.length - 1,
        height: data[0].height?.toFixed(1) || 0
    };

    state.history.unshift({ runId, color, params, data, visible: true });
    
    // Enforce 10-item limit: remove oldest if exceeded
    if (state.history.length > 10) {
        const oldest = state.history[state.history.length - 1];
        removeTrajectory(oldest.runId);
    }
    
    if (!isRestoring) saveToStorage();
    updateHysplitDrawerList();
}

/**
 * Core rendering logic: Adds trajectory sources and layers to the map.
 */
function drawTrajectoryLayers(runId, data, direction, color, isRestoring = false) {
    if (!map || !data || data.length === 0) return;

    const exaggeration = 15;
    let coords3D = data.map(pt => [pt.lon, pt.lat, pt.height || 0]);
    if (direction === "backward") coords3D = coords3D.reverse();
    const receptorPoint = direction === "backward" ? coords3D[coords3D.length - 1] : coords3D[0];

    // Prepare hourly points with properties for tooltips
    const hourlyFeatures = data.map(pt => ({
        type: "Feature",
        properties: {
            date: pt.date,
            date2: pt.date2,
            lon: pt.lon.toFixed(3),
            lat: pt.lat.toFixed(3),
            height: pt.height?.toFixed(1) || 0,
            pressure: pt.pressure?.toFixed(1) || "N/A"
        },
        geometry: {
            type: "Point",
            coordinates: [pt.lon, pt.lat, pt.height || 0]
        }
    }));

    // Create unique sources
    if (!map.getSource(`hysplit-src-traj-${runId}`)) {
        map.addSource(`hysplit-src-traj-${runId}`, {
            type: "geojson",
            data: {
                type: "FeatureCollection",
                features: [
                    { type: "Feature", geometry: { type: "LineString", coordinates: coords3D } },
                    { type: "Feature", geometry: { type: "Point", coordinates: receptorPoint } },
                    ...hourlyFeatures
                ]
            }
        });
    }

    // 3D Wall Features
    const wallFeatures = [];
    for (let i = 0; i < coords3D.length - 1; i++) {
        const p1 = coords3D[i];
        const p2 = coords3D[i + 1];
        const h = ((p1[2] + p2[2]) / 2) * exaggeration;
        wallFeatures.push({
            type: "Feature",
            properties: { height: h },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [p1[0], p1[1]], [p2[0], p2[1]],
                    [p2[0] + 0.005, p2[1] + 0.005], [p1[0] + 0.005, p1[1] + 0.005],
                    [p1[0], p1[1]]
                ]]
            }
        });
    }

    if (!map.getSource(`hysplit-src-wall-${runId}`)) {
        map.addSource(`hysplit-src-wall-${runId}`, {
            type: "geojson",
            data: { type: "FeatureCollection", features: wallFeatures }
        });
    }

    // 1. 3D Wall Layer
    map.addLayer({
        id: `hysplit-layer-wall-${runId}`,
        type: "fill-extrusion",
        source: `hysplit-src-wall-${runId}`,
        paint: {
            "fill-extrusion-color": color,
            "fill-extrusion-height": ["get", "height"],
            "fill-extrusion-opacity": 0.4
        }
    });

    // 2. Line Layer
    map.addLayer({
        id: `hysplit-layer-line-${runId}`,
        type: "line",
        source: `hysplit-src-traj-${runId}`,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
            "line-color": color,
            "line-width": 3,
            "line-dasharray": [2, 1]
        }
    });

    // 3. Arrow Layer
    map.addLayer({
        id: `hysplit-layer-arrow-${runId}`,
        type: "symbol",
        source: `hysplit-src-traj-${runId}`,
        layout: {
            "symbol-placement": "line",
            "icon-image": "hysplit-arrow-blue",
            "icon-size": 0.7,
            "symbol-spacing": 40,
            "icon-allow-overlap": true,
            "icon-rotation-alignment": "map"
        }
    });

    // 4. Hourly Points Layer (The one we hover on)
    map.addLayer({
        id: `hysplit-layer-points-${runId}`,
        type: "circle",
        source: `hysplit-src-traj-${runId}`,
        filter: ["has", "date2"],
        paint: {
            "circle-radius": [
                "interpolate", ["linear"], ["zoom"],
                3, 4,
                10, 12,
                16, 20
            ],

            "circle-color": color,
            "circle-opacity": 0.0,
            "circle-stroke-width": 0,
        }
    });

    // 5. Visible Points Layer
    map.addLayer({
        id: `hysplit-layer-vispoints-${runId}`,
        type: "circle",
        source: `hysplit-src-traj-${runId}`,
        filter: ["has", "date2"],
        paint: {
            "circle-radius": [
                "interpolate", ["linear"], ["zoom"],
                3, 2,
                10, 8,
                16, 16
            ],

            "circle-color": "#ffffff",
            "circle-stroke-width": 1.5,
            "circle-stroke-color": color
        }
    });

    // 6. Receptor point
    map.addLayer({
        id: `hysplit-layer-point-${runId}`,
        type: "circle",
        source: `hysplit-src-traj-${runId}`,
        filter: ["all", ["==", "$type", "Point"], ["!has", "date2"]],
        paint: {
            "circle-radius": [
                "interpolate", ["linear"], ["zoom"],
                3, 3,
                10, 10,
                16, 20
            ],

            "circle-color": "#ffffff",
            "circle-stroke-width": 2,
            "circle-stroke-color": color
        }
    });

    // Precise Hover Events (Pick closest feature among overlaps)
    const hoverLayer = `hysplit-layer-points-${runId}`;
    map.on("mousemove", hoverLayer, (e) => {
        if (state?.tooltipLocked) return;
        map.getCanvas().style.cursor = "pointer";
        const tooltip = document.getElementById("MapTooltip");
        if (!tooltip) return;

        let f = e.features?.[0];
        if (e.features && e.features.length > 1) {
            let minSqDist = Infinity;
            for (const feat of e.features) {
                if (feat.geometry?.type === "Point") {
                    const [lon, lat] = feat.geometry.coordinates;
                    const d2 = Math.pow(lon - e.lngLat.lng, 2) + Math.pow(lat - e.lngLat.lat, 2);
                    if (d2 < minSqDist) {
                        minSqDist = d2;
                        f = feat;
                    }
                }
            }
        }
        if (!f) return;

        const props = f.properties;
        const [fLon, fLat] = f.geometry.coordinates;

        tooltip.innerHTML = `
            <div style="font-family: inherit; font-size: 1.4rem; line-height: 1.4;">
                <div style="font-weight: bold; color: ${color}; border-bottom: 0.1rem solid #eee; margin-bottom: 0.5rem; padding-bottom: 0.2rem;">HYSPLIT Point Info</div>
                <b>Date:</b> ${props.date} UTC<br/>
                <b>Date2:</b> ${props.date2} UTC<br/>
                <b>Lon:</b> ${fLon.toFixed(3)}<br/>
                <b>Lat:</b> ${fLat.toFixed(3)}<br/>
                <b>AGL:</b> ${props.height}m<br/>   
                <b>Pressure:</b> ${props.pressure} hPa
            </div>
        `;
        tooltip.style.display = "block";

        let x = e.originalEvent.clientX + 15;
        let y = e.originalEvent.clientY + 15;
        if (x + 320 > window.innerWidth) x = e.originalEvent.clientX - 330;
        if (y + 400 > window.innerHeight) y = e.originalEvent.clientY - 410;
        tooltip.style.left = `${x / 10}rem`;
        tooltip.style.top = `${y / 10}rem`;
    });

    map.on("mouseleave", hoverLayer, () => {
        if (state?.tooltipLocked) return;
        map.getCanvas().style.cursor = "";
        const tooltip = document.getElementById("MapTooltip");
        if (tooltip) tooltip.style.display = "none";
    });

    if (!isRestoring) {
        const bounds = coords3D.reduce((acc, c) => acc.extend([c[0], c[1]]), new maplibregl.LngLatBounds(coords3D[0], coords3D[0]));
        map.fitBounds(bounds, { padding: 80, pitch: 65, duration: 1500 });
    }
}

// Run init
init();

