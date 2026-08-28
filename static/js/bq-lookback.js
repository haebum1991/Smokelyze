
/**
 * NIFC Wildfire BigQuery N-Day Lookback Controller
 */
import { map } from "./layers-state.js";
import { loadedGeoJSON, loadedSources } from "./loader-state.js";
import { DATA_IMPORT_METHOD, LAYER_DEFS } from "./layers-def.js";
import { toggleSpinner } from "./loader-ui.js";
import { logUserAction } from "./fb-logging.js";
import { auth, onAuthStateChanged } from "./fb-init.js";
import { showAuthOverlay } from "./utils.js";

export const wildfireLookbackMap = {};

// Self-contained Modular Style injection for Lookback controls
function ensureLookbackStyles() {
    if (typeof document === "undefined" || document.getElementById("LookbackModuleStyles")) return;
    const styleHTML = `
<style id="LookbackModuleStyles">
  button[id^="LookBackUpdateBtn"] {
    cursor: pointer;
    font-size: 1.4rem;
    font-weight: bold;
    border-radius: 0.4rem;
    display: inline-flex !important;
    align-items: center;
    justify-content: center;
    width: 3.4rem;
    height: 2.8rem;
    padding: 0;
    background-color: var(--color-bg);
    color: var(--text-strong);
    border: 0.1rem solid var(--card-shadow);
    transition: transform 0.2s ease;
  }
  button[id^="LookBackUpdateBtn"][data-is-synced="true"] {
    background-color: #059669 !important;
    color: #ffffff !important;
    border-color: #059669 !important;
  }
  @media (hover: hover) {
    button[id^="LookBackUpdateBtn"][data-is-synced="false"]:hover {
      background-color: var(--card-shadow) !important;
      color: var(--color-bg) !important;
      border-color: var(--card-shadow) !important;
    }
  }
  input[id^="LookBackInput"]::-webkit-inner-spin-button,
  input[id^="LookBackInput"]::-webkit-outer-spin-button {
    opacity: 1 !important;
  }
</style>`;
    document.head.insertAdjacentHTML("beforeend", styleHTML);
}
ensureLookbackStyles();

if (typeof document !== "undefined") {
    onAuthStateChanged(auth, (user) => {
        document.querySelectorAll('button[id^="LookBackUpdateBtn"]').forEach(btn => {
            if (user) {
                btn.classList.remove("disabled-auth");
                btn.removeAttribute("title");
            } else {
                btn.classList.add("disabled-auth");
                btn.title = "Please login to use BigQuery lookback";
            }
        });
    });
}

/**
 * Calculates date range string formatted as "YYYY-MM-DD ~ YYYY-MM-DD" or "YYYY-MM-DD" for 0 days.
 */
export function calculateDateRange(isoDateStr, lookbackDays = 0) {
    const rawDate = isoDateStr || document.getElementById("datePicker")?.value || "";
    let end;
    if (!rawDate || rawDate.toUpperCase() === "LIVE") {
        end = new Date();
    } else {
        const parts = rawDate.split("-").map(v => parseInt(v, 10));
        end = (parts.length === 3 && !parts.some(isNaN))
            ? new Date(parts[0], parts[1] - 1, parts[2])
            : new Date();
    }

    const start = new Date(end);
    start.setDate(start.getDate() - lookbackDays);

    const formatDate = (d) => {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    };

    const endStr = formatDate(end);
    const startStr = formatDate(start);

    if (lookbackDays === 0) {
        return endStr;
    }
    return `${startStr} to ${endStr}`;
}

const pendingLookbackRequests = new Map();

/**
 * Queries BigQuery for N-day lookback deduplicated wildfire features and updates map source.
 */
export async function fetchLookbackNIFC(sourceKey, isoDate, lookbackDays = 0) {
    if (!map) return null;

    // Check login before initiating request
    if (!auth?.currentUser) {
        showAuthOverlay?.();
        return null;
    }

    const cleanDate = isoDate || document.getElementById("datePicker")?.value || "LIVE";
    const cacheKey = `${cleanDate}_lookback_${lookbackDays}`;

    // 1. Return memory-cached data if already loaded
    if (loadedSources[sourceKey] === cacheKey && loadedGeoJSON[sourceKey]) {
        console.log(`[BQ-LOOKBACK] Returning memory cache for ${sourceKey} (${cacheKey})`);
        return loadedGeoJSON[sourceKey];
    }

    // 2. Lock & deduplicate in-flight requests (prevents rapid double clicking)
    if (pendingLookbackRequests.has(cacheKey)) {
        console.warn(`[BQ-LOOKBACK] Request already in progress for ${cacheKey}. Reusing active fetch.`);
        return pendingLookbackRequests.get(cacheKey);
    }

    toggleSpinner(true, `Querying BigQuery ${lookbackDays}-day lookback for ${sourceKey}...`);

    const fetchPromise = (async () => {
        try {
            const idToken = await auth.currentUser.getIdToken();
            const url = `/api/bg?dataset=${encodeURIComponent(sourceKey)}&date=${encodeURIComponent(cleanDate)}&lookback=${lookbackDays}`;
            const res = await fetch(url, {
                headers: {
                    "Authorization": `Bearer ${idToken}`
                }
            });
            if (!res.ok) {
                const errText = await res.text();
                console.error(`[BQ-LOOKBACK] HTTP ${res.status} Details:`, errText);
                throw new Error(`HTTP ${res.status}: ${errText}`);
            }

            const geoJSON = await res.json();
            if (geoJSON?.features) {
                loadedGeoJSON[sourceKey] = geoJSON;
                loadedSources[sourceKey] = cacheKey;

                const sourceId = DATA_IMPORT_METHOD[sourceKey]?.source || sourceKey;
                map.getSource(sourceId)?.setData(geoJSON);

                console.log(`[BQ-LOOKBACK] Loaded ${geoJSON.features.length} features for ${sourceKey} over ${lookbackDays} days.`);
                logUserAction("query_lookback", { dataset: sourceKey, date: cleanDate, lookback: lookbackDays, count: geoJSON.features.length });
            }
            return geoJSON;
        } catch (err) {
            console.error("[BQ-LOOKBACK Failed]:", err);
            alert(`Failed to query BigQuery lookback data: ${err.message}`);
            return null;
        } finally {
            toggleSpinner(false);
            pendingLookbackRequests.delete(cacheKey);
        }
    })();

    pendingLookbackRequests.set(cacheKey, fetchPromise);
    return fetchPromise;
}

// SVG Icons for Lookback Action Button (from svg-symbols.html sprite)
const SVG_UPDATE = `<svg width="15" height="15"><use xlink:href="#icon-refresh" /></svg>`;
const SVG_DONE = `<svg width="15" height="15"><use xlink:href="#icon-check" /></svg>`;

/**
 * Updates button state (data-is-synced, icon, tooltip) cleanly
 */
function setLookbackBtnSynced(btn, isSynced, isLoggedIn = true) {
    if (!btn) return;
    if (isSynced) {
        btn.innerHTML = SVG_DONE;
        btn.setAttribute("data-is-synced", "true");
        btn.setAttribute("title", "Data is up to date");
    } else {
        btn.innerHTML = SVG_UPDATE;
        btn.setAttribute("data-is-synced", "false");
        btn.setAttribute("title", isLoggedIn ? "Fetch lookback data" : "Please login to use BigQuery lookback");
    }
}

/**
 * Generates HTML string for the Lookback control box in legend drawer with dynamic date range text
 */
export function renderLookbackBoxHTML(id) {
    const curDays = (wildfireLookbackMap[id] !== undefined) ? wildfireLookbackMap[id] : 0;
    const datePickerVal = document.getElementById("datePicker")?.value || "LIVE";
    const rangeStr = calculateDateRange(datePickerVal, curDays);

    const sourceKey = id.replace(/-/g, "_");
    const cacheKey = `${datePickerVal}_lookback_${curDays}`;
    const isSynced = (loadedSources[sourceKey] === cacheKey);

    const isLoggedIn = !!auth?.currentUser;
    const authClass = isLoggedIn ? "" : "disabled-auth";
    const authTitle = isLoggedIn ? (isSynced ? "Data is up to date" : "Fetch lookback data") : "Please login to use BigQuery lookback";
    const btnIcon = isSynced ? SVG_DONE : SVG_UPDATE;

    // Layer icon preview on the left of Lookback (flame symbol / perimeter swatch)
    const layerDef = LAYER_DEFS?.[id];
    const iconImg = layerDef?.legend?.iconImage;
    let iconHtml = "";
    if (iconImg) {
        iconHtml = `<canvas class="legend-icon-canvas" data-icon="${iconImg}" width="48" height="48" style="width:1.8rem; height:1.8rem; margin-right:0.6rem; vertical-align:middle; flex-shrink:0; display:inline-block;"></canvas>`;
    } else if (layerDef?.legend?.colors?.[0]) {
        iconHtml = `<span class="legend-color-rect" style="background:${layerDef.legend.colors[0]}; width:1.2rem; height:1.2rem; margin-right:0.6rem; vertical-align:middle; flex-shrink:0; display:inline-block; border:0.1rem solid var(--text-main);"></span>`;
    }

    return `<div class="legend-item" onclick="event.stopPropagation();" style="display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center;">
                    ${iconHtml}
                    <span>Lookback:</span>
                </div>
                <div style="display:flex; align-items:center; gap:0.4rem;">
                    <input type="number" 
                           id="LookBackInput-${id}" 
                           data-layer-id="${id}" 
                           min="0" 
                           max="15" 
                           value="${curDays}" 
                           style="width:4.8rem; text-align:center; padding:0.2rem 0.2rem 0.2rem 0.4rem; border-radius:0.3rem; font-size:1.4rem;">
                    <span style="font-size:1.2rem;">days</span>
                </div>
                <button id="LookBackUpdateBtn-${id}" 
                        class="${authClass}" 
                        title="${authTitle}" 
                        aria-label="Update lookback query" 
                        data-layer-id="${id}" 
                        data-is-synced="${isSynced ? "true" : "false"}">
                    ${btnIcon}
                </button>
            </div>
            <hr style="margin: 0.5rem 0;">
            <div class="legend-item legend-lookback-range" data-layer-id="${id}" style="justify-content:flex-end; color:var(--card-shadow); font-size:1.2rem;">
                Range:&nbsp;<span class="range-text" style="font-weight:bold;">${rangeStr}</span>
            </div>`;
}

/**
 * Binds input changes & click events to Lookback controls in legend drawer
 */
export function bindLookbackEvents(container) {
    if (!container) return;

    // Real-time input change updates range text preview & button sync status
    const inputs = container.querySelectorAll('input[id^="LookBackInput"]');
    inputs.forEach(input => {
        const updateRangePreview = () => {
            const layerId = input.getAttribute("data-layer-id");
            let days = parseInt(input.value, 10);
            if (isNaN(days) || days < 0) days = 0;
            if (days > 15) days = 15;

            const datePickerVal = document.getElementById("datePicker")?.value || "LIVE";
            const rangeSpan = container.querySelector(`.legend-lookback-range[data-layer-id="${layerId}"] .range-text`);
            if (rangeSpan) {
                rangeSpan.textContent = calculateDateRange(datePickerVal, days);
            }

            // Toggle Done vs Update based on whether input matches active map state
            const sourceKey = layerId.replace(/-/g, "_");
            const activeDays = (wildfireLookbackMap[layerId] !== undefined) ? wildfireLookbackMap[layerId] : 0;
            const cacheKey = `${datePickerVal}_lookback_${days}`;
            const isSynced = (loadedSources[sourceKey] === cacheKey && days === activeDays);

            const btn = document.getElementById(`LookBackUpdateBtn-${layerId}`);
            setLookbackBtnSynced(btn, isSynced, !!auth?.currentUser);
        };

        input.addEventListener("input", updateRangePreview);
        input.addEventListener("change", updateRangePreview);
    });

    // Update button click handler
    const btns = container.querySelectorAll('button[id^="LookBackUpdateBtn"]');
    btns.forEach(btn => {
        btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            e.preventDefault();

            // Guard: If already synced, ignore click to prevent redundant query
            if (btn.getAttribute("data-is-synced") === "true") {
                return;
            }

            // Guard: If not logged in, show login overlay and DO NOT change button or state
            if (!auth?.currentUser) {
                showAuthOverlay?.();
                return;
            }

            const layerId = btn.getAttribute("data-layer-id");
            const input = document.getElementById(`LookBackInput-${layerId}`);
            if (!input) return;

            let days = parseInt(input.value, 10);
            if (isNaN(days) || days < 0) {
                days = 0;
                input.value = 0;
            }
            if (days > 15) {
                alert("Lookback days cannot exceed 15 days. Automatically set to 15 days.");
                days = 15;
                input.value = 15;
            }

            const datePickerVal = document.getElementById("datePicker")?.value || "LIVE";
            const rangeSpan = container.querySelector(`.legend-lookback-range[data-layer-id="${layerId}"] .range-text`);
            if (rangeSpan) {
                rangeSpan.textContent = calculateDateRange(datePickerVal, days);
            }

            const sourceKey = layerId.replace(/-/g, "_");
            const result = await fetchLookbackNIFC(sourceKey, datePickerVal, days);
            if (!result) return;

            wildfireLookbackMap[layerId] = days;

            // Mark button as Done (green) only after successful sync to map
            setLookbackBtnSynced(btn, true, true);
        });
    });
}

/**
 * Resets all lookback state, input elements, buttons, and range indicators to 0 days.
 */
export function resetLookbackState() {
    Object.keys(wildfireLookbackMap).forEach(key => {
        delete wildfireLookbackMap[key];
    });

    const datePickerVal = document.getElementById("datePicker")?.value || "LIVE";

    document.querySelectorAll('input[id^="LookBackInput"]').forEach(input => {
        input.value = 0;
    });

    document.querySelectorAll(".legend-lookback-range .range-text").forEach(span => {
        span.textContent = calculateDateRange(datePickerVal, 0);
    });

    document.querySelectorAll('button[id^="LookBackUpdateBtn"]').forEach(btn => {
        setLookbackBtnSynced(btn, false, !!auth?.currentUser);
    });
}

