
/**
 * NIFC Wildfire BigQuery N-Day Lookback Controller
 */
import { map } from "./layers-state.js";
import { loadedGeoJSON, loadedSources } from "./loader-state.js";
import { DATA_IMPORT_METHOD } from "./layers-def.js";
import { toggleSpinner } from "./loader-ui.js";
import { logUserAction } from "./fb-logging.js";

export const wildfireLookbackMap = {};

// Ensure lookback button stays visible on mobile screens
if (typeof document !== "undefined" && !document.getElementById("legend-lookback-style")) {
    const styleEl = document.createElement("style");
    styleEl.id = "legend-lookback-style";
    styleEl.textContent = `.legend-lookback-btn { display: inline-block !important; }`;
    document.head.appendChild(styleEl);
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
            const url = `/.netlify/functions/gcs-bigquery?dataset=${encodeURIComponent(sourceKey)}&date=${encodeURIComponent(cleanDate)}&lookback=${lookbackDays}`;
            const res = await fetch(url);
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

    const btnText = isSynced ? "✓ Done" : "Update";
    const btnStyle = isSynced
        ? `
            background: #059669;
            color: #ffffff;
            display: inline-block !important;
        `
        : `
            display: inline-block !important;
        `;

    return `<div class="legend-item" onclick="event.stopPropagation();" style="justify-content:space-between;">
                <span>Lookback:</span>
                <div>
                    <input type="number" class="legend-lookback-input" data-layer-id="${id}" min="0" max="15" value="${curDays}" style="width:4rem; text-align:center;">
                    <span>days</span>
                </div>
                <button class="export-btn-csv legend-lookback-btn" data-layer-id="${id}" data-is-synced="${isSynced ? "true" : "false"}" style="${btnStyle}">${btnText}</button>
            </div>
            <hr style="margin: 0.5rem;">
            <div class="legend-item legend-lookback-range" data-layer-id="${id}" style="justify-content:flex-end; color:var(--card-shadow);">
                Range:&nbsp;<span class="range-text" style="font-weight:bold;">${rangeStr}</span>
            </div>`;
}

/**
 * Binds input changes & click events to Lookback controls in legend drawer
 */
export function bindLookbackEvents(container) {
    if (!container) return;

    // Real-time input change updates range text preview & button sync status
    const inputs = container.querySelectorAll(".legend-lookback-input");
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

            const btn = container.querySelector(`.legend-lookback-btn[data-layer-id="${layerId}"]`);
            if (btn) {
                if (isSynced) {
                    btn.textContent = "✓ Done";
                    btn.style.backgroundColor = "#059669";
                    btn.style.color = "#ffffff";
                    btn.setAttribute("data-is-synced", "true");
                } else {
                    btn.textContent = "Update";
                    btn.style.backgroundColor = "";
                    btn.style.color = "";
                    btn.setAttribute("data-is-synced", "false");
                }
            }
        };

        input.addEventListener("input", updateRangePreview);
        input.addEventListener("change", updateRangePreview);
    });

    // Update button click handler
    const btns = container.querySelectorAll(".legend-lookback-btn");
    btns.forEach(btn => {
        // Instant press color swap isolated in loader-lookback.js
        btn.addEventListener("pointerdown", () => {
            if (btn.getAttribute("data-is-synced") !== "true") {
                btn.style.color = "var(--color-bg)";
                btn.style.backgroundColor = "var(--card-shadow)";
            }
        });
        const resetStyle = () => {
            if (btn.getAttribute("data-is-synced") !== "true") {
                btn.style.color = "";
                btn.style.backgroundColor = "";
            }
        };
        btn.addEventListener("pointerup", resetStyle);
        btn.addEventListener("pointerleave", resetStyle);

        btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            e.preventDefault();
            const layerId = btn.getAttribute("data-layer-id");
            const input = container.querySelector(`.legend-lookback-input[data-layer-id="${layerId}"]`);
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

            wildfireLookbackMap[layerId] = days;

            const datePickerVal = document.getElementById("datePicker")?.value || "LIVE";
            const rangeSpan = container.querySelector(`.legend-lookback-range[data-layer-id="${layerId}"] .range-text`);
            if (rangeSpan) {
                rangeSpan.textContent = calculateDateRange(datePickerVal, days);
            }

            const sourceKey = layerId.replace(/-/g, "_");
            await fetchLookbackNIFC(sourceKey, datePickerVal, days);
            
            // Mark button as Done (green) after successful sync to map
            btn.textContent = "✓ Done";
            btn.style.backgroundColor = "#059669";
            btn.style.color = "#ffffff";
            btn.setAttribute("data-is-synced", "true");
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

    document.querySelectorAll(".legend-lookback-input").forEach(input => {
        input.value = 0;
    });

    document.querySelectorAll(".legend-lookback-range .range-text").forEach(span => {
        span.textContent = calculateDateRange(datePickerVal, 0);
    });

    document.querySelectorAll(".legend-lookback-btn").forEach(btn => {
        btn.textContent = "Update";
        btn.style.backgroundColor = "";
        btn.style.color = "";
        btn.removeAttribute("data-is-synced");
    });
}

