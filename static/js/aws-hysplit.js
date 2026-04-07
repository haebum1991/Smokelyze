
import { map } from "./map-init.js";
import { moveLayerToTop } from "./layers-handler.js";
import { auth, onAuthStateChanged } from "./fb-init.js";
import * as utils from "./utils.js";
import { showErrorToast, showTaskNotification } from "./loader-ui.js"; // CRITICAL: Use loader-ui to break circular loop
import { generatePopupHTML } from "./layers-tooltip.js";
import { updateAuthButton } from "./signin.js";
import { setHysplitDrawer, appendSwitch } from "./ui-toggles.js";
import { logUserAction } from "./fb-logging.js";
import { state as globalState } from "./ui-state.js";
import { appendGenericHelpIcon } from "./ui-param-desc.js";

// --- Configuration & State ---
const HYSPLIT_API_URL = "https://tiwczmnrwbmsonuap4r2fzpnsm0fqnyp.lambda-url.us-east-1.on.aws/hysplit";
const STORAGE_KEY = "smokelyze_hysplit_history";

const state = {
    pendingLngLat: null,
    currentUser: null,
    history: [], // [{ runId, color, params, visible }]
    runCount: 0,
    isHysplitMode: false,
    modalBaseParams: null,
    showFlowStream: false,
    isRunning: false,
};

const RAINBOW_COLORS = ["#007cff", "#ff4d4d", "#2ecc71", "#e67e22", "#9b59b6", "#1abc9c", "#f1c40f"];
const LAYER_SUFFIXES = ["wall", "line", "points", "vispoints", "point", "heatmap"];

// --- Initialization ---
export function initHysplit() {
    console.log("[HYSPLIT] Full Init Starting...");
    if (!map) return;

    // Listen for reset events from ui-reset.js (Decoupled Reset)
    document.addEventListener("smokelyze-reset-hysplit", (e) => {
        console.log("[HYSPLIT] Reset event received.");
        clearHysplitTrajectory(e.detail?.deleteHistory ?? false);
    });
    
    // Toggle flow event from ui-toggles.js
    window.addEventListener("hysplit-flow-toggle", (e) => {
        state.showFlowStream = e.detail;
        toggleFlowAnimation(e.detail);
    });
    
    // 1. Capture coordinate from context menu (parallel to fb-MapPost)
    map.on("contextmenu", (e) => {
        state.pendingLngLat = e.lngLat;
    });

    // 4. Modal validation & UI listeners
    const modalBody = document.querySelector("#HysplitModalOverlay .MapPost-modal-body");
    if (modalBody) {
        modalBody.addEventListener("input", checkHysplitDuplicate);
        modalBody.addEventListener("change", (e) => {
            checkHysplitDuplicate();
            
            // Toggle dispersion settings / Sync defaults
            if (e.target.id === "InputHysplitType") {
                const val = e.target.value;
                const group = document.getElementById("HysplitDispersionGroup");
                if (group) group.style.display = (val === "dispersion") ? "block" : "none";

                // Sync Direction default
                const dir = (val === "dispersion") ? "forward" : "backward";
                const radio = document.querySelector(`input[name="HysplitDirection"][value="${dir}"]`);
                if (radio) radio.checked = true;
            }
        });
    }

    // 1b. Map click for Hysplit Mode
    map.on("click", (e) => {
        if (state.isHysplitMode) {
            state.pendingLngLat = e.lngLat;
            uiShowHysplitModal();
            handleHysplitModeToggle(false);
        }
    });

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
            
                // E.1. Activate visibility if it is currently hidden
                if (!item.visible) {
                    toggleTrajectoryVisibility(runId);
                }

                const pt = item.data[0]; // Receptor is always index 0
                const props = {
                    date: pt.date,
                    date2: pt.date2,
                    lon: pt.lon,
                    lat: pt.lat,
                    height: pt.height?.toFixed(1) || 0,
                    pressure: pt.pressure?.toFixed(1) || "N/A",
                    color: item.color
                };

                if (utils.highlightLocation) {
                    utils.highlightLocation([pt.lon, pt.lat], props, "hysplit", 10);
                } else {
                    map.flyTo({
                        center: [item.params.lon, item.params.lat],
                        zoom: 10,
                        essential: true
                    });
                }
            }
            return;
        }

        // I. Download CSV
        const csvBtn = e.target.closest(".export-btn-csv");
        const animBtn = e.target.closest(".hysplit-item-anim");

        if (animBtn) {
            const runId = parseInt(animBtn.dataset.runId);
            showDispersionAnimation(runId);
            return;
        }

        if (csvBtn) {
            const runId = parseInt(csvBtn.dataset.runId);
            downloadTrajectoryAsCSV(runId);
            return;
        }

        // G. Clear All
        if (e.target.closest("#HysplitBtnClearAll")) {
            if (confirm("Clear all HYSPLIT simulation?")) {
                clearHysplitTrajectory();
            }
            return;
        }
    });

    // 3. Auth State Monitoring
    onAuthStateChanged(auth, (user) => {
        state.currentUser = user;
        updateAuthButton("MapPostBtnHysplit", user, "Run HYSPLIT");
        updateAuthButton("HysplitBtnNew", user, "+Simulation");

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

    // 4. Initialize Flow Animation (Safe check for style loading)
    if (map.isStyleLoaded()) {
        initFlowAnimation();
    } else {
        map.once("styledata", initFlowAnimation);
    }
    console.log("[HYSPLIT] Full Init Complete!");
    
    // 5. Parameter help icons
    appendGenericHelpIcon("DivHysplitDuration", "InputHysplitDuration");
    appendGenericHelpIcon("DivHysplitHeight", "InputHysplitHeight");
    appendGenericHelpIcon("DivHysplitReleaseRate", "InputHysplitRate");
    appendGenericHelpIcon("DivHysplitReleaseDuration", "InputHysplitReleaseDuration");
    appendGenericHelpIcon("DivHysplitPdiam", "InputHysplitPdiam");
    appendGenericHelpIcon("DivHysplitPdensity", "InputHysplitPdensity");
    
    initDispersionAnimator();
}

/**
 * Ensures HYSPLIT layers are moved to the top of the map.
 * This is called by the global layers-handler.
 */
function moveHysplitToTop() {
    if (!map) return;
    state.history.forEach(item => {
        if (!item.visible) return;
        LAYER_SUFFIXES.forEach(suffix => {
            const layerId = `hysplit-layer-${suffix}-${item.runId}`;
            if (map.getLayer(layerId)) map.moveLayer(layerId);
        });
    });
    // Finally move flow animation to absolute top
    if (map.getLayer("trajflow-layer-glow")) map.moveLayer("trajflow-layer-glow");
    if (map.getLayer("trajflow-layer-core")) map.moveLayer("trajflow-layer-core");
}

function isHysplitVisible() {
    return state.history.some(item => item.visible);
}

function getHysplitHistoryCount() {
    return state.history.length;
}

function getHysplitContext() {
    return state.history
        .filter(item => item.visible)
        .map(item => `Date: ${item.params.date}, Start: ${item.params.lon}, ${item.params.lat}, Dir: ${item.params.direction}`);
}

function getHysplitHistoryData() {
    return state.history.map(item => ({
        id: item.runId,
        visible: item.visible,
        params: item.params,
        points: item.data.map(pt => ({ ...pt }))
    }));
}

// Expose to window for layers-handler.js and AI context integration
if (typeof window !== "undefined") {
    window.moveHysplitToTop = moveHysplitToTop;
    window.isHysplitVisible = isHysplitVisible;
    window.getHysplitContext = getHysplitContext;
    window.getHysplitHistoryCount = getHysplitHistoryCount;
    window.getHysplitHistoryData = getHysplitHistoryData;
    window.setHysplitVisibility = setHysplitVisibility;
}

function initFlowAnimation() {
    if (!map) return;
    if (map.getSource("trajflow-source")) return;

    map.addSource("trajflow-source", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] }
    });

    // Sync switch state if it was already created in ui-toggles.js
    const flowCheck = document.getElementById("MapBtnHysplitFlow");
    if (flowCheck) {
        flowCheck.checked = state.showFlowStream;
    }

    // 1. Glow Layer (Outer neon glow)
    map.addLayer({
        id: "trajflow-layer-glow",
        type: "circle",
        source: "trajflow-source",
        paint: {
            "circle-radius": [
                "interpolate", ["linear"], ["zoom"],
                3, ["*", ["get", "sizeScale"], 6],
                10, ["*", ["get", "sizeScale"], 15]
            ],
            "circle-color": ["get", "color"],
            "circle-blur": 0.8,
            "circle-opacity": ["*", ["get", "opacity"], 0.7]
        }
    });

    // 2. Core Layer (Bright inner center)
    map.addLayer({
        id: "trajflow-layer-core",
        type: "circle",
        source: "trajflow-source",
        paint: {
            "circle-radius": [
                "interpolate", ["linear"], ["zoom"],
                3, ["*", ["get", "sizeScale"], 2.5],
                10, ["*", ["get", "sizeScale"], 5]
            ],
            "circle-color": "#ffffff",
            "circle-opacity": ["get", "opacity"]
        }
    });
    
    let flowAnimRunning = false;
    let lastFrameTime = 0;
    const TARGET_FPS = 20; // Drastically reduce from 60fps to 20fps
    const FRAME_INTERVAL = 1000 / TARGET_FPS;

    const animate = (timestamp) => {
        // Check if animation should keep running
        const hasVisible = state.showFlowStream && state.history.some(
            item => item.visible && item.flowCoords && item.flowCoords.length >= 2
        );

        if (!hasVisible) {
            flowAnimRunning = false;
            // Clear any leftover particles from the map
            const source = map.getSource("trajflow-source");
            if (source) source.setData({ type: "FeatureCollection", features: [] });
            return; // Fully stop the loop — CPU rests
        }
        
        // Throttling: Skip frames to enforce 20 FPS limit
        if (!timestamp) timestamp = performance.now();
        const elapsed = timestamp - lastFrameTime;
        if (elapsed < FRAME_INTERVAL) {
            requestAnimationFrame(animate);
            return;
        }
        lastFrameTime = timestamp - (elapsed % FRAME_INTERVAL);
        
        const now = performance.now();
        const duration = 2000;

        const features = [];
        state.history.forEach(item => {
            if (!item.visible || !item.flowCoords || item.flowCoords.length < 2) return;

            const c = item.flowCoords;
            const streakCount = 8; // Increased for a longer, denser stream

            for (let sIdx = 0; sIdx < streakCount; sIdx++) {
                const streakOffset = (sIdx * 25); // Tightened offset for a continuous [liquid] look
                // Fix negative modulo for early page load
                let timePos = (now - streakOffset);
                let progress = (timePos % duration + duration) % duration / duration;

                const idx = progress * (c.length - 1);
                const i = Math.floor(idx);
                const next = Math.min(i + 1, c.length - 1);
                const t = idx % 1;

                const pos = [
                    c[i][0] + (c[next][0] - c[i][0]) * t,
                    c[i][1] + (c[next][1] - c[i][1]) * t
                ];

                const alpha = 1.0 - (sIdx / streakCount);
                const size = 1.0 - (sIdx / (streakCount * 1.5)); // Tail shrinks less aggressively

                features.push({
                    type: "Feature",
                    geometry: { type: "Point", coordinates: pos },
                    properties: {
                        color: item.color,
                        opacity: alpha,
                        sizeScale: size
                    }
                });
            }
        });

        const source = map.getSource("trajflow-source");
        if (source) {
            source.setData({ type: "FeatureCollection", features });
        }

        requestAnimationFrame(animate);
    };

    // Helper: restarts the animation loop only if not already running
    state._startFlowAnim = () => {
        if (flowAnimRunning) return;
        flowAnimRunning = true;
        requestAnimationFrame(animate);
    };
}


export function handleHysplitModeToggle(force) {
    state.isHysplitMode = (force !== undefined) ? force : !state.isHysplitMode;
    
    // Security: Immediate login check when entering mode
    if (state.isHysplitMode && !state.currentUser) {
        utils.showAuthOverlay();
        state.isHysplitMode = false;
        return;
    }
    
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
    const locEl = document.getElementById("InputHysplitLocation");
    const dateEl = document.getElementById("InputHysplitDate");
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
        const timeEl = document.getElementById("InputHysplitTime");
        const durEl = document.getElementById("InputHysplitDuration");
        const heightEl = document.getElementById("InputHysplitHeight");

        if (timeEl) timeEl.value = params.time;
        if (durEl) durEl.value = params.duration;
        if (heightEl) heightEl.value = params.height;

        const dirRadio = document.querySelector(`input[name="HysplitDirection"][value="${params.direction}"]`);
        if (dirRadio) dirRadio.checked = true;
        
        const typeEl = document.getElementById("InputHysplitType");
        if (typeEl) {
            typeEl.value = params.run_type || "trajectory";
            const group = document.getElementById("HysplitDispersionGroup");
            if (group) group.style.display = (typeEl.value === "dispersion") ? "block" : "none";
        }

        if (params.run_type === "dispersion") {
            if (document.getElementById("InputHysplitRate")) document.getElementById("InputHysplitRate").value = params.species_rate || 5;
            if (document.getElementById("InputHysplitPdiam")) document.getElementById("InputHysplitPdiam").value = params.species_pdiam || 2.5;
            if (document.getElementById("InputHysplitPdensity")) document.getElementById("InputHysplitPdensity").value = params.species_density || 1.2;
            if (document.getElementById("InputHysplitReleaseDuration")) document.getElementById("InputHysplitReleaseDuration").value = params.species_duration || 1;
        }
    }

    // Set base params for change detection
    state.modalBaseParams = params;
    checkHysplitDuplicate();
}

function checkHysplitDuplicate() {
    const submitBtn = document.getElementById("HysplitBtnSubmit");
    const titleEl = document.getElementById("HysplitModalTitle");
    if (!submitBtn || !titleEl) return;

    // 알림 토스트를 띄우려면버튼이 항상 클릭 가능해야 함
    submitBtn.disabled = false;

    let baseTitle = "HYSPLIT Simulation";
    let isSame = false;

    if (state.modalBaseParams) {
        const time = document.getElementById("InputHysplitTime").value;
        const directionEl = document.querySelector('input[name="HysplitDirection"]:checked');
        const direction = directionEl ? directionEl.value : "backward";
        const duration = parseFloat(document.getElementById("InputHysplitDuration").value);
        const height = parseFloat(document.getElementById("InputHysplitHeight").value);
        const date = document.getElementById("InputHysplitDate").value;
        const run_type = document.getElementById("InputHysplitType").value;

        const b = state.modalBaseParams;
        isSame = (
            date === b.date &&
            time === b.time &&
            direction === b.direction &&
            duration === b.duration &&
            height === b.height &&
            run_type === (b.run_type || "trajectory")
        );

        // If dispersion, check extra params
        if (isSame && run_type === "dispersion") {
            isSame = (
                parseFloat(document.getElementById("InputHysplitRate").value) === (b.species_rate || 5) &&
                parseFloat(document.getElementById("InputHysplitPdiam").value) === (b.species_pdiam || 2.5) &&
                parseFloat(document.getElementById("InputHysplitPdensity").value) === (b.species_density || 1.2) &&
                parseInt(document.getElementById("InputHysplitReleaseDuration").value) === (b.species_duration || 1)
            );
        }

        if (isSame) {
            baseTitle = "HYSPLIT Simulation (Conditions are identical)";
        }
    }

    if (state.isRunning) {
        titleEl.innerText = "HYSPLIT (Running...)";
        submitBtn.innerText = "Running...";
        submitBtn.style.opacity = "0.5";
    } else {
        titleEl.innerText = baseTitle;
        submitBtn.innerText = "Run Simulation";
        submitBtn.style.opacity = isSame ? "0.5" : "1";
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
    
    if (state.isRunning) {
        if (showErrorToast) showErrorToast("HYSPLIT is currently running... please wait.", "warning");
        return;
    }
    
    const submitBtn = document.getElementById("HysplitBtnSubmit");
    const time = document.getElementById("InputHysplitTime").value;
    const directionEl = document.querySelector('input[name="HysplitDirection"]:checked');
    const direction = directionEl ? directionEl.value : "backward";
    const duration = parseFloat(document.getElementById("InputHysplitDuration").value);
    const height = parseFloat(document.getElementById("InputHysplitHeight").value);
    const date = document.getElementById("InputHysplitDate").value;
    const lngLat = state.pendingLngLat;

    // Check for identical duplicate submission
    const runType = document.getElementById("InputHysplitType").value;
    if (state.modalBaseParams) {
        const b = state.modalBaseParams;
        let isSame = (
            date === b.date &&
            time === b.time &&
            direction === b.direction &&
            duration === b.duration &&
            height === b.height &&
            runType === (b.run_type || "trajectory")
        );

        if (isSame && runType === "dispersion") {
            isSame = (
                parseFloat(document.getElementById("InputHysplitRate").value) === (b.species_rate || 5) &&
                parseFloat(document.getElementById("InputHysplitPdiam").value) === (b.species_pdiam || 2.5) &&
                parseFloat(document.getElementById("InputHysplitPdensity").value) === (b.species_density || 1.2) &&
                parseInt(document.getElementById("InputHysplitReleaseDuration").value) === (b.species_duration || 1)
            );
        }

        if (isSame) {
            if (showErrorToast) showErrorToast("Same conditions already simulated. Please alter a field to run again.", "warning");
            return;
        }
    }
    
    if (!lngLat || !date) return alert("Missing location or date.");

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = "Running...";
    }
    
    state.isRunning = true;
    
    // Close modal immediately so user can continue
    uiHideHysplitModal();
    
    logUserAction("view", {
        dataset: "hysplit_run",
        layer: direction,
        date: date,
        filename: `lon:${lngLat.lng.toFixed(3)}_lat:${lngLat.lat.toFixed(3)}_h:${height}m_d:${duration}h`
    });
    
    const task = showTaskNotification("HYSPLIT Simulation", "Requesting trajectory from AWS...");

    try {
        // Get the ID token for the current user to secure the API call
        const idToken = await auth.currentUser.getIdToken(true);

        const runType = document.getElementById("InputHysplitType").value;

        const baseParams = {
            lon: lngLat.lng,
            lat: lngLat.lat,
            date: date,
            time: time,
            direction: direction,
            duration: duration,
            height: height,
            run_type: runType
        };

        // Add dispersion params if needed
        if (runType === "dispersion") {
            baseParams.particle_num = 500; // Fixed for server capacity
            baseParams.species_rate = parseFloat(document.getElementById("InputHysplitRate").value);
            baseParams.species_pdiam = parseFloat(document.getElementById("InputHysplitPdiam").value);
            baseParams.species_density = parseFloat(document.getElementById("InputHysplitPdensity").value);
            baseParams.species_duration = parseInt(document.getElementById("InputHysplitReleaseDuration").value);
        }

        const params = new URLSearchParams(baseParams);

        // Inject token directly into payload to bypass Netlify header stripping
        params.append("token", `Bearer ${idToken}`);

        // Modern JSON-based Lambda Request via Netlify Proxy
        const response = await fetch(HYSPLIT_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(Object.fromEntries(params))
        });

        if (!response.ok) throw new Error(`API initiation failed: ${response.status}`);
        let resultData = await response.json();

        if (resultData.status === "error") throw new Error(resultData.message || "Simulation failed");

        // --- Modern Lambda Result Support ---
        // Lambda returns result immediately ("done") through Netlify Proxy
        let finalData = null;
        if (resultData.status === "done") {
            finalData = resultData.data;
        } else {
            throw new Error(`Unexpected result from serverless backend: ${resultData.status}`);
        }

        const currentParams = baseParams;

        task.update("Rendering trajectory...", "running");
        renderHysplitTrajectory(finalData, direction, null, false, currentParams);
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
        state.isRunning = false;
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = "Run Simulation";
        }
    }
}

// --- Rendering & List Management ---
export function clearHysplitTrajectory(clearHistory = true) {
    console.log(`[HYSPLIT] clearing trajectory (clearHistory: ${clearHistory})`);
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
            ? `<svg width="18" height="18"><use xlink:href="#icon-eye-open" /></svg>`
            : `<svg width="18" height="18"><use xlink:href="#icon-eye-closed" /></svg>`;

        const isDispersion = (p.run_type === "dispersion");
        const animBtn = isDispersion
            ? `<button class="hysplit-item-anim ui-btn-close" data-run-id="${item.runId}" title="See Animation">
                 <svg width="18" height="18"><use xlink:href="#icon-hysplit-anim" /></svg>
               </button>`
            : "";

        return `
            <div class="Hysplit-item" data-run-id="${item.runId}" style="border-left-color: ${utils.ESML(item.color)}; border-left-width: 5px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                    <div style="font-size: 1.3rem; font-weight: bold; color: var(--text-heading);">
                        ${utils.ESML(p.date)} ${utils.ESML(p.time)}:00 UTC
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        ${animBtn}
                        <button class="hysplit-item-focus ui-btn-close" data-run-id="${item.runId}" title="Receptor Location">
                            <svg width="18" height="18">
                                <use xlink:href="#icon-location" />
                            </svg>
                        </button>
                        <button class="hysplit-item-toggle ui-btn-close ${visibleCls}" data-run-id="${item.runId}">
                            ${eyeIcon}
                        </button>
                        <button class="hysplit-item-remove ui-btn-close" data-run-id="${item.runId}">
                            <svg width="18" height="18"><use xlink:href="#icon-close" /></svg>
                        </button>
                    </div>
                </div>
                <div style="font-size: 1.1rem; color: var(--text-main); display: flex; justify-content: space-between; align-items: flex-end;">
                    <div>
                        <b>Mode: ${utils.ESML(p.run_type || "trajectory")}</b><br>
                        Dir: ${utils.ESML(p.direction)} | Dur: ${utils.ESML(p.duration)}h | AGL: ${utils.ESML(p.height)}m <br>
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

function setHysplitVisibility(runId, visible) {
    const items = (runId === "all") ? state.history : state.history.filter(h => String(h.runId) === String(runId));
    if (items.length === 0) return;

    items.forEach(item => {
        if (item.visible === visible) return;
        item.visible = visible;

        const visibility = visible ? "visible" : "none";
        const testLayer = `hysplit-layer-point-${item.runId}`;

        if (visible && !map.getLayer(testLayer)) {
            drawTrajectoryLayers(item.runId, item.data, item.params.direction, item.color, true);
        } else {
            LAYER_SUFFIXES.forEach(suffix => {
                const layerId = `hysplit-layer-${suffix}-${item.runId}`;
                if (map.getLayer(layerId)) {
                    map.setLayoutProperty(layerId, "visibility", visibility);
                }
            });
        }
    });

    updateHysplitDrawerList();
    if (visible && state._startFlowAnim) state._startFlowAnim();
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
    if (item.visible) {
        if (state._startFlowAnim) state._startFlowAnim();
        // Participate in global stacking order
        moveLayerToTop("hysplit");
    }
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
    const keys = [...new Set(data.flatMap(pt => Object.keys(pt)))];
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

    const isDispersion = (forcedParams && forcedParams.run_type === "dispersion");

    // Draw on Map
    if (isDispersion) {
        drawDispersionLayers(runId, data, color, isRestoring);
    } else {
        drawTrajectoryLayers(runId, data, direction, color, isRestoring);
    }

    // Cache coordinates for flow animation (Exclude dispersion)
    let flowCoords = isDispersion ? [] : data.map(pt => [pt.lon, pt.lat]);
    if (direction === "backward") flowCoords.reverse();

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

    state.history.unshift({ runId, color, params, data, flowCoords, visible: true });

    // Enforce 10-item limit: remove oldest if exceeded
    if (state.history.length > 10) {
        const oldest = state.history[state.history.length - 1];
        removeTrajectory(oldest.runId);
    }

    if (!isRestoring) saveToStorage();
    updateHysplitDrawerList();
    if (state._startFlowAnim) state._startFlowAnim();
    
    // Participate in global stacking order
    moveLayerToTop("hysplit");
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
    const NUM_SEGMENTS = 10; // Splitting each hourly block into 10 smooth steps

    for (let i = 0; i < coords3D.length - 1; i++) {
        const p1 = coords3D[i];
        const p2 = coords3D[i + 1];
        
        for (let j = 0; j < NUM_SEGMENTS; j++) {
            const t1 = j / NUM_SEGMENTS;
            const t2 = (j + 1) / NUM_SEGMENTS;
            
            // Interpolate point A (start of sub-segment)
            const lonA = p1[0] + (p2[0] - p1[0]) * t1;
            const latA = p1[1] + (p2[1] - p1[1]) * t1;
            const hA = p1[2] + (p2[2] - p1[2]) * t1;
            
            // Interpolate point B (end of sub-segment)
            const lonB = p1[0] + (p2[0] - p1[0]) * t2;
            const latB = p1[1] + (p2[1] - p1[1]) * t2;
            const hB = p1[2] + (p2[2] - p1[2]) * t2;
            
            // Average height of this tiny step
            const h = ((hA + hB) / 2) * exaggeration;
            
            wallFeatures.push({
                type: "Feature",
                properties: { height: h },
                geometry: {
                    type: "Polygon",
                    coordinates: [[
                        [lonA, latA], [lonB, latB],
                        [lonB + 0.005, latB + 0.005], [lonA + 0.005, latA + 0.005],
                        [lonA, latA]
                    ]]
                }
            });
        }
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

            "circle-color": color,
            "circle-stroke-width": 1,
            "circle-stroke-color": "#ffffff"
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
        if (globalState?.tooltipLocked) return;
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
        
        // Pass coordinates and color into props for unified formatting
        props.lon = fLon;
        props.lat = fLat;
        props.color = color;

        tooltip.innerHTML = generatePopupHTML(props, "hysplit", false);
        tooltip.style.display = "block";

        let x = e.originalEvent.clientX + 15;
        let y = e.originalEvent.clientY + 15;
        if (x + 320 > window.innerWidth) x = e.originalEvent.clientX - 330;
        if (y + 400 > window.innerHeight) y = e.originalEvent.clientY - 410;
        tooltip.style.left = `${x / 10}rem`;
        tooltip.style.top = `${y / 10}rem`;
    });

    map.on("mouseleave", hoverLayer, () => {
        if (globalState?.tooltipLocked) return;
        map.getCanvas().style.cursor = "";
        const tooltip = document.getElementById("MapTooltip");
        if (tooltip) tooltip.style.display = "none";
    });
    
    // Exact Click Event (highlightLocation)
    map.on("click", hoverLayer, (e) => {
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
        
        props.lon = fLon;
        props.lat = fLat;
        props.color = color;

        if (utils.highlightLocation) {
            e.preventDefault(); // Stop click from bubbling up and triggering clearHighlight
            utils.highlightLocation([fLon, fLat], props, "hysplit", 10);
        }
    });

    // Ensure flow animation stays on top of newly added static layers
    if (map.getLayer("trajflow-layer-glow")) map.moveLayer("trajflow-layer-glow");
    if (map.getLayer("trajflow-layer-core")) map.moveLayer("trajflow-layer-core");
    
    if (!isRestoring) {
        const bounds = coords3D.reduce((acc, c) => acc.extend([c[0], c[1]]), new maplibregl.LngLatBounds(coords3D[0], coords3D[0]));
        map.fitBounds(bounds, { padding: 80, pitch: 65, duration: 1500 });
    }
}

/**
 * Renders dispersion particle cloud.
 */
function drawDispersionLayers(runId, data, color, isRestoring = false) {
    if (!map || !data || data.length === 0) return;

    const features = data.map(pt => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [pt.lon, pt.lat] },
        properties: { ...pt } // Preserve ALL fields including q_ug_m3, q_kg, etc.
    }));

    if (!map.getSource(`hysplit-src-traj-${runId}`)) {
        map.addSource(`hysplit-src-traj-${runId}`, {
            type: "geojson",
            data: { type: "FeatureCollection", features }
        });
    }

    // 1. NOAA-style Heatmap Plume layer
    map.addLayer({
        id: `hysplit-layer-heatmap-${runId}`,
        type: "heatmap",
        source: `hysplit-src-traj-${runId}`,
        maxzoom: 15,
        paint: {
            // Dynamically scale weight based on concentration (q_ug_m3)
            "heatmap-weight": [
                "interpolate",
                ["linear"],
                ["get", "q_ug_m3"],
                0, 0,
                0.5, 0.3,
                2, 0.6,
                10, 1.0
            ],
            "heatmap-intensity": [
                "interpolate", ["linear"], ["zoom"],
                1, 0.5,
                12, 1.5
            ],
            "heatmap-color": [
                "interpolate", ["linear"], ["heatmap-density"],
                0, "rgba(0, 0, 255, 0)",
                0.1, "rgba(0, 255, 255, 0.4)",
                0.2, "rgba(0, 255, 0, 0.6)",
                0.4, "rgba(255, 255, 0, 0.7)",
                0.7, "rgba(255, 120, 0, 0.9)",
                0.95, "rgba(255, 0, 0, 1)" 
            ],
            "heatmap-radius": [
                "interpolate", ["linear"], ["zoom"],
                2, 5,
                10, 18
            ],
            "heatmap-opacity": 0.8
        }
    });

    // 2. Individual Particles (Circle Layer) - for detailed view when zoomed in
    map.addLayer({
        id: `hysplit-layer-point-${runId}`,
        type: "circle",
        source: `hysplit-src-traj-${runId}`,
        minzoom: 8,
        paint: {
            "circle-radius": [
                "interpolate", ["linear"], ["zoom"],
                9, 1.5,
                16, 6
            ],
            "circle-color": color,
            "circle-opacity": [
                "interpolate", ["linear"], ["zoom"],
                8, 0,
                11, 0.7
            ],
            "circle-stroke-width": 0.5,
            "circle-stroke-color": "#ffffff"
        }
    });
    
    // --- Tooltip & Interaction ---
    const hoverLayer = `hysplit-layer-point-${runId}`;
    map.on("mousemove", hoverLayer, (e) => {
        if (globalState?.tooltipLocked) return;
        map.getCanvas().style.cursor = "pointer";
        const tooltip = document.getElementById("MapTooltip");
        if (!tooltip) return;

        const f = e.features?.[0];
        if (!f) return;

        const props = f.properties;
        const [fLon, fLat] = f.geometry.coordinates;

        // Ensure these are treated as numbers and formatted
        props.lon = fLon;
        props.lat = fLat;
        props.color = color;
        props.run_type = "dispersion";

        tooltip.innerHTML = generatePopupHTML(props, "hysplit", false);
        tooltip.style.display = "block";

        let x = e.originalEvent.clientX + 15;
        let y = e.originalEvent.clientY + 15;
        if (x + 320 > window.innerWidth) x = e.originalEvent.clientX - 330;
        if (y + 400 > window.innerHeight) y = e.originalEvent.clientY - 410;
        tooltip.style.left = `${x / 10}rem`;
        tooltip.style.top = `${y / 10}rem`;
    });

    map.on("mouseleave", hoverLayer, () => {
        if (globalState?.tooltipLocked) return;
        map.getCanvas().style.cursor = "";
        const tooltip = document.getElementById("MapTooltip");
        if (tooltip) tooltip.style.display = "none";
    });

    map.on("click", hoverLayer, (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const [fLon, fLat] = f.geometry.coordinates;
        const props = { ...f.properties, lon: fLon, lat: fLat, color, run_type: "dispersion" };

        if (utils.highlightLocation) {
            e.preventDefault();
            utils.highlightLocation([fLon, fLat], props, "hysplit", 10);
        }
    });
    
    if (!isRestoring) {
        const bounds = data.reduce((acc, pt) => acc.extend([pt.lon, pt.lat]), new maplibregl.LngLatBounds([data[0].lon, data[0].lat], [data[0].lon, data[0].lat]));
        map.fitBounds(bounds, { padding: 100, duration: 2000 });
    }
}

/**
 * Toggles the visibility of the flow animation layers.
 */
export function toggleFlowAnimation(show) {
    const visibility = show ? "visible" : "none";
    if (map.getLayer("trajflow-layer-glow")) map.setLayoutProperty("trajflow-layer-glow", "visibility", visibility);
    if (map.getLayer("trajflow-layer-core")) map.setLayoutProperty("trajflow-layer-core", "visibility", visibility);
    if (show && state._startFlowAnim) state._startFlowAnim();
}

// --- Dispersion Animation Controller ---
let dispersionAnimState = {
    isRunning: false,
    intervalId: null,
    currentStep: 0,
    steps: [], // Array of unique date2 strings
    runId: null,
    data: null
};

function initDispersionAnimator() {
    const playBtn = document.getElementById("DispersionAnimPlayBtn");
    const slider = document.getElementById("DispersionAnimSlider");
    const closeBtn = document.getElementById("DispersionAnimClose");
    
    if (playBtn) playBtn.addEventListener("click", toggleDispersionAnimPlayback);
    if (slider) slider.addEventListener("input", (e) => {
        stopDispersionAnimPlayback();
        updateDispersionFrame(parseInt(e.target.value));
    });
    if (closeBtn) closeBtn.addEventListener("click", hideDispersionAnimator);

    makeDraggable(document.getElementById("DispersionAnimModal"), document.getElementById("DispersionAnimHeader"));
}

function showDispersionAnimation(runId) {
    const item = state.history.find(h => h.runId === runId);
    if (!item || !item.data) return;

    dispersionAnimState.runId = runId;
    dispersionAnimState.data = item.data;
    
    // Extract unique time steps (date2)
    const uniqueSteps = [...new Set(item.data.map(pt => pt.date2))].sort((a, b) => new Date(a) - new Date(b));
    dispersionAnimState.steps = uniqueSteps;
    dispersionAnimState.currentStep = 0;

    const modal = document.getElementById("DispersionAnimModal");
    const slider = document.getElementById("DispersionAnimSlider");
    if (modal) {
        modal.style.display = "flex";
        // Apply color indicator (matching history item style)
        modal.style.borderLeft = `5px solid ${utils.ESML(item.color)}`;
    }
    const meta = document.getElementById("DispersionAnimMeta");
    const massEl = document.getElementById("DispersionAnimMassDisplay");
    if (massEl) massEl.innerHTML = "";
    if (meta) {
        const p = item.params;
        const dirLabel = p.direction === "backward" ? "Backward" : "Forward";
        meta.innerHTML = `<span style="color: var(--text-main);">Base:</span> <span style="color: var(--card-shadow);">${utils.ESML(p.date)} ${utils.ESML(p.time)}:00 UTC</span><br> 
                          <span style="color: var(--text-main);">Dir:</span> <span style="color: var(--card-shadow);">${utils.ESML(dirLabel)}</span>`;
    }
    if (slider) {
        slider.max = uniqueSteps.length - 1;
        slider.value = 0;
    }

    updateDispersionFrame(0);
}

function toggleDispersionAnimPlayback() {
    if (dispersionAnimState.isRunning) {
        stopDispersionAnimPlayback();
    } else {
        startDispersionAnimPlayback();
    }
}

function startDispersionAnimPlayback() {
    if (dispersionAnimState.isRunning) return;
    dispersionAnimState.isRunning = true;
    updateDispersionPlayIcon(true);

    dispersionAnimState.intervalId = setInterval(() => {
        let next = dispersionAnimState.currentStep + 1;
        if (next >= dispersionAnimState.steps.length) {
            next = 0; // Loop back
        }
        updateDispersionFrame(next);
    }, 200);
}

function stopDispersionAnimPlayback() {
    if (!dispersionAnimState.isRunning) return;
    dispersionAnimState.isRunning = false;
    updateDispersionPlayIcon(false);
    if (dispersionAnimState.intervalId) {
        clearInterval(dispersionAnimState.intervalId);
        dispersionAnimState.intervalId = null;
    }
}

function updateDispersionPlayIcon(playing) {
    const icon = document.getElementById("DispersionAnimPlayIcon");
    if (!icon) return;
    if (playing) {
        // Pause icon path
        icon.setAttribute("d", "M6 19h4V5H6v14zm8-14v14h4V5h-4z");
    } else {
        // Play icon path
        icon.setAttribute("d", "M8 5v14l11-7z");
    }
}

function hideDispersionAnimator() {
    stopDispersionAnimPlayback();
    const modal = document.getElementById("DispersionAnimModal");
    if (modal) modal.style.display = "none";
    
    // Restore full data view on closing
    if (dispersionAnimState.runId) {
        const item = state.history.find(h => h.runId === dispersionAnimState.runId);
        if (item && item.visible) {
            const source = map.getSource(`hysplit-src-traj-${item.runId}`);
            if (source) {
                const features = item.data.map(pt => ({
                    type: "Feature",
                    geometry: { type: "Point", coordinates: [pt.lon, pt.lat] },
                    properties: { ...pt }
                }));
                source.setData({ type: "FeatureCollection", features });
            }
        }
    }
}

function updateDispersionFrame(index) {
    dispersionAnimState.currentStep = index;
    const timeStr = dispersionAnimState.steps[index];
    const data = dispersionAnimState.data;

    // Update UI
    const timeDisplay = document.getElementById("DispersionAnimTimeDisplay");
    const stepDisplay = document.getElementById("DispersionAnimStepDisplay");
    const slider = document.getElementById("DispersionAnimSlider");
    const massEl = document.getElementById("DispersionAnimMassDisplay");
    const meta = document.getElementById("DispersionAnimMeta");

    if (stepDisplay) stepDisplay.innerText = `Step: ${index + 1} / ${dispersionAnimState.steps.length}`;
    if (timeDisplay) {
        timeDisplay.innerHTML = `<span style="color: var(--text-main);">Current:</span> <span style="color: var(--card-shadow);">${utils.ESML(timeStr)} UTC</span>`;
    }
    if (slider) slider.value = index;

    // Update Map Layer for this run
    const runId = dispersionAnimState.runId;
    const source = map.getSource(`hysplit-src-traj-${runId}`);
    if (source) {
        const filtered = data.filter(pt => pt.date2 === timeStr);
        
        // Calculate total for the current step (Only trust q_kg for Total Mass)
        let totalValue = 0;
        let hasQkg = false;
        if (filtered.length > 0 && filtered[0].q_kg !== undefined) {
            hasQkg = true;
            totalValue = filtered.reduce((acc, pt) => acc + (parseFloat(pt.q_kg) || 0), 0);
        }

        if (massEl) {
            if (hasQkg) {
                const expStr = totalValue.toExponential(3);
                const [mantissa, exponent] = expStr.split("e");
                const formattedExponent = exponent.replace("+", "");
                const formattedMass = `${utils.ESML(mantissa)} &times; 10<sup>${utils.ESML(formattedExponent)}</sup>`;
                massEl.innerHTML = `<span style="color: var(--text-main);">Total Mass:</span> <b style="color: var(--card-shadow);">${formattedMass}</b> kg`;
                massEl.style.display = "block";
            } else {
                massEl.style.display = "none";
            }
        }

        if (meta) {
            const item = state.history.find(h => h.runId === runId);
            const p = item.params;
            const dirLabel = p.direction === "backward" ? "Backward" : "Forward";
            meta.innerHTML = `<span style="color: var(--text-main);">Base:</span> <span style="color: var(--card-shadow);">${utils.ESML(p.date)} ${utils.ESML(p.time)}:00 UTC</span><br>
                              <span style="color: var(--text-main);">Dir:</span> <span style="color: var(--card-shadow);">${utils.ESML(dirLabel)}</span>`;
        }

        const features = filtered.map(pt => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [pt.lon, pt.lat] },
            properties: { ...pt }
        }));
        source.setData({ type: "FeatureCollection", features });
    }
}

/**
 * Utility for making elements draggable (Floating Modals)
 */
function makeDraggable(el, handle) {
    if (!el || !handle) return;
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    
    handle.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        el.style.top = (el.offsetTop - pos2) + "px";
        el.style.left = (el.offsetLeft - pos1) + "px";
        el.style.right = "auto"; // Unlock from fixed right
        el.style.bottom = "auto";
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

