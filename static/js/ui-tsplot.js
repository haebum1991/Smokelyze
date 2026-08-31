
import { updateAuthButton } from "./signin.js";
import { map } from "./map-init.js";
import * as utils from "./utils.js";
import { auth } from "./fb-init.js";
import { getPlotTheme } from "./stats-common.js";
import { LAYER_TEMPLATES } from "./layers-def.js";
import { activeLayerStack } from "./layers-state.js";
import { getRasterTooltipInfo } from "./raster-loader.js";


// Self-contained Modular TSPlot Modal DOM injection
function ensureTSplotModalDOM() {
    if (document.getElementById("TSplotModalOverlay")) return;

    const modalHTML = `
<style>
  #TSplotControls input[type=number]::-webkit-inner-spin-button,
  #TSplotControls input[type=number]::-webkit-outer-spin-button {
    opacity: 1 !important;
  }
  .tsplot-layer-option-btn {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 0.8rem 1.2rem;
    border-radius: var(--border-radius-0p8rem);
    border: 0.1rem solid var(--card-shadow);
    background: var(--color-bg);
    color: var(--text-main);
    font-size: 1.4rem;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s ease, color 0.15s ease;
  }
  @media (hover: hover) {
    #TSplotUpdateBtn[data-is-synced="false"]:hover {
      background-color: var(--card-shadow) !important;
      color: var(--color-bg) !important;
      border-color: var(--card-shadow) !important;
    }
    .tsplot-layer-option-btn:hover {
      background-color: var(--card-shadow) !important;
      color: var(--color-bg) !important;
    }
    .tsplot-layer-option-btn:hover span {
      color: var(--color-bg) !important;
    }
    #TSplotSwitchLayerBtn:hover {
      background-color: var(--card-shadow) !important;
      color: var(--color-bg) !important;
    }
    #TSplotLayerPickerCancelBtn:hover {
      background-color: var(--card-shadow) !important;
      color: var(--color-bg) !important;
    }
  }
</style>
<div class="MapPost-modal-overlay" 
     id="TSplotModalOverlay" 
     style="display:none; z-index: var(--z-highest);">
  <div class="MapPost-modal" 
       style="max-width: 80rem; width: 95%;">
    <div class="MapPost-modal-header" style="display:flex; align-items:center; justify-content:space-between; gap:1rem;">
      <div style="display:flex; align-items:center; gap:1rem; flex:1; min-width:0; flex-wrap:wrap;">
        <h3 id="TSplotModalTitle" style="margin:0; font-size:1.6rem;">Time-Series Plot</h3>
        <button id="TSplotSwitchLayerBtn" 
                title="Switch to another active layer"
                style="display:none; cursor:pointer; font-size:1.2rem; padding:0.4rem 0.8rem; border-radius:var(--border-radius-0p8rem); background:var(--color-bg); color:var(--text-main); border:0.1rem solid var(--card-shadow); align-items:center; gap:0.4rem; transition:background 0.15s ease, color 0.15s ease;">
          <svg width="14" height="14" style="stroke:currentColor; fill:none;"><use xlink:href="#icon-layers" /></svg>
          Switch Layer
        </button>
      </div>
      <button class="ui-btn-close" id="TSplotModalClose">
        <svg width="20" height="20">
          <use xlink:href="#icon-close" />
        </svg>
      </button>
    </div>
    <div class="MapPost-modal-body">
      <div id="TSplotControls" 
           style="display:none; 
                  align-items:center; 
                  justify-content:flex-start; 
                  flex-wrap:wrap; 
                  padding:0.6rem 1rem; 
                  border-radius:var(--border-radius-0p8rem); 
                  margin-bottom:1rem; 
                  gap:1.5rem; 
                  color:var(--text-main); 
                  font-size:1.4rem;">
        <div id="TSplotRangeControls" style="display:flex; align-items:center; gap:1.5rem; flex-wrap:wrap;">
          <div style="display:flex; flex-direction:column; gap:0.4rem;">
            <div style="display:flex; align-items:center; gap:0.4rem;">
              <span style="min-width: 9.5rem; font-size:1.4rem;">Lookback:</span>
              <input type="number" 
                     id="TSplotLookbackInput" 
                     min="0" 
                     max="15" 
                     value="4" 
                     style="width:4.8rem; text-align:center; padding:0.2rem 0.2rem 0.2rem 0.4rem; border-radius:var(--border-radius-0p8rem); font-size:1.4rem;">
              <span style="min-width: 7.5rem; color:var(--text-main); font-size:1.4rem;">days, from</span>
              <span id="TSplotLBDateText" 
                    style="font-weight:bold; color:var(--card-shadow); font-size:1.4rem;"></span>
            </div>
            <div style="display:flex; align-items:center; gap:0.4rem;">
              <span style="min-width: 9.5rem; font-size:1.4rem;">Lookforward:</span>
              <input type="number" 
                     id="TSplotLookforwardInput" 
                     min="0" 
                     max="15" 
                     value="4" 
                     style="width:4.8rem; text-align:center; padding:0.2rem 0.2rem 0.2rem 0.4rem; border-radius:var(--border-radius-0p8rem); font-size:1.4rem;">
              <span style="min-width: 7.5rem; color:var(--text-main); font-size:1.4rem;">days, to</span>
              <span id="TSplotLFDateText" 
                    style="font-weight:bold; color:var(--card-shadow); font-size:1.4rem;"></span>
            </div>
          </div>
          <button id="TSplotUpdateBtn" 
                  title="Data is up to date" 
                  aria-label="Update time-series query" 
                  data-is-synced="true" 
                  style="cursor:pointer; 
                         font-size:1.4rem; 
                         font-weight:bold; 
                         border-radius:var(--border-radius-0p8rem); 
                         display:inline-flex !important; 
                         align-items:center; 
                         justify-content:center; 
                         width:3.4rem; 
                         height:3.4rem; 
                         padding:0; 
                         background-color:#059669; 
                         color:#ffffff; 
                         border:0.1rem solid #059669; 
                         transition:transform 0.2s ease;">
            <svg width="16" height="16"><use xlink:href="#icon-check" /></svg>
          </button>
        </div>
        <div id="TSplotTzToggleGroup" 
             style="margin-left:auto; display:none; align-items:center; background:var(--color-bg); padding:0.2rem; border-radius:var(--border-radius-0p8rem); border:0.1rem solid var(--border-soft); gap:0.2rem;">
          <button id="TSplotTzUtcBtn" 
                  title="Display in UTC"
                  style="cursor:pointer; font-size:1.4rem; font-weight:bold; border-radius:var(--border-radius-0p8rem); border:none; padding:0.4rem 0.8rem; background:var(--card-shadow); color:var(--color-bg); transition:all 0.2s ease;">
            UTC
          </button>
          <button id="TSplotTzLocalBtn" 
                  title="Display in Site Local Time"
                  style="cursor:pointer; font-size:1.4rem; border-radius:var(--border-radius-0p8rem); border:none; padding:0.4rem 0.8rem; background:var(--color-bg); color:var(--text-main); transition:all 0.2s ease;">
            Site Time
          </button>
        </div>
      </div>
      <div id="TSplotChartContainer" 
           style="width: 100%; height: 100%; display: none;"></div>
      <div id="TSplotLoading" 
           style="display:none; text-align:center; padding: 5rem 2rem;">
        <div id="TSplotSpinner" 
             style="margin: 0 auto 1.5rem auto; 
                    width: 4rem; 
                    height: 4rem; 
                    border: 0.4rem solid var(--border-soft); 
                    border-top: 0.4rem solid var(--card-shadow); 
                    border-radius: 50%; 
                    animation: spin 1s linear infinite;">
        </div>
        <span id="TSplotLoadingText" 
              style="font-size: 1.4rem; color: var(--text-soft);">Loading hourly data...</span>
      </div>
      <div id="TSplotError" 
           style="display:none; 
                  color:var(--color-invalid, #ef4444); 
                  padding:6rem 2rem; 
                  text-align:center; 
                  font-size: 1.6rem;
                  font-weight: bold;">
      </div>
      <!-- Navigation Confirmation Overlay / Dialog -->
      <div id="TSplotConfirmOverlay" 
           style="display:none; 
                  position:absolute; 
                  top:0; 
                  left:0; 
                  width:100%; 
                  height:100%; 
                  background:rgba(0, 0, 0, 0.45); 
                  backdrop-filter:blur(3px); 
                  -webkit-backdrop-filter:blur(3px); 
                  z-index:100; 
                  align-items:center; 
                  justify-content:center;">
        <div id="TSplotConfirmDialog" 
             style="background:var(--color-bg); 
                    border:0.1rem solid var(--card-shadow); 
                    border-radius:var(--border-radius-0p8rem); 
                    padding:1.5rem 2.2rem; 
                    text-align:center; 
                    max-width:40rem; 
                    width:90%;">
          <div id="TSplotConfirmTitle" 
               style="font-size:1.6rem; font-weight:bold; color:var(--text-main); margin-bottom:1rem;">
            Navigate Map
          </div>
          <div id="TSplotConfirmMsg" 
               style="font-size:1.4rem; color:var(--text-main); margin-bottom:1.8rem;">
            Would you like to navigate the map to this date and time?
          </div>
          <div style="display:flex; justify-content:center; gap:1.2rem;">
            <button id="TSplotConfirmYesBtn" 
                    style="cursor:pointer; font-size:1.6rem; padding:0.6rem 1.6rem; border-radius:var(--border-radius-0p8rem); background:#059669; color:#ffffff; border:none;">
              Yes
            </button>
            <button id="TSplotConfirmCancelBtn" 
                    style="cursor:pointer; font-size:1.6rem; padding:0.6rem 1.6rem; border-radius:var(--border-radius-0p8rem); background:var(--color-bg); color:var(--text-main); border:0.1rem solid var(--card-shadow);">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
<!-- Modal: Select Layer for Time-Series Plot (Pre-flight Picker when >= 2 layers active) -->
<div class="MapPost-modal-overlay" 
     id="TSplotLayerPickerOverlay" 
     style="display:none; z-index: var(--z-highest);">
  <div class="MapPost-modal" 
       style="max-width: 48rem; width: 92%; height: auto; max-height: calc(100dvh - var(--header-height-total) - var(--footer-height) - 4rem);">
    <div class="MapPost-modal-header">
      <div style="display:flex; align-items:center; gap:0.8rem;">
        <svg width="18" height="18" style="stroke:var(--text-main); fill:none; color:var(--text-main);"><use xlink:href="#icon-layers" /></svg>
        <h3 style="margin:0; font-size:1.6rem; color:var(--text-main);">Select Layer for Time-Series Plot</h3>
      </div>
      <button class="ui-btn-close" id="TSplotLayerPickerClose">
        <svg width="18" height="18">
          <use xlink:href="#icon-close" />
        </svg>
      </button>
    </div>
    <div class="MapPost-modal-body" style="padding: 2rem;">
      <p style="margin:0 0 1.2rem 0; font-size:1.4rem; color:var(--text-main); line-height: 1.4;">
        Multiple active layers support time-series profiles at this location. Please choose which dataset to plot:
      </p>
      <div id="TSplotLayerPickerList" 
           style="display:flex; flex-direction:column; gap:0.8rem; max-height: 55vh; overflow-y:auto; padding-right:0.2rem;">
      </div>
      <div style="display:flex; justify-content:flex-end; margin-top:1.6rem;">
        <button id="TSplotLayerPickerCancelBtn" 
                style="cursor:pointer; font-size:1.4rem; padding:0.6rem 1.4rem; border-radius:var(--border-radius-0p8rem); background:var(--color-bg); color:var(--text-main); border:0.1rem solid var(--card-shadow); transition:background 0.15s ease, color 0.15s ease;">
          Cancel
        </button>
      </div>
    </div>
  </div>
</div>`;
    document.body.insertAdjacentHTML("beforeend", modalHTML);
}
ensureTSplotModalDOM();

// DOM Elements
const modal = document.getElementById("TSplotModalOverlay");
const closeBtn = document.getElementById("TSplotModalClose");
const chartContainer = document.getElementById("TSplotChartContainer");
const loadingEl = document.getElementById("TSplotLoading");
const loadingTextEl = document.getElementById("TSplotLoadingText");
const errorEl = document.getElementById("TSplotError");

// Layer Picker Modal DOM Elements
const layerPickerOverlay = document.getElementById("TSplotLayerPickerOverlay");
const layerPickerCloseBtn = document.getElementById("TSplotLayerPickerClose");
const layerPickerCancelBtn = document.getElementById("TSplotLayerPickerCancelBtn");
const layerPickerList = document.getElementById("TSplotLayerPickerList");

function hideTSLayerPicker() {
    if (layerPickerOverlay) {
        layerPickerOverlay.style.display = "none";
    }
}

if (layerPickerCloseBtn) {
    layerPickerCloseBtn.addEventListener("click", hideTSLayerPicker);
}
if (layerPickerCancelBtn) {
    layerPickerCancelBtn.addEventListener("click", hideTSLayerPicker);
}


function getLayerDatasetName(cfg) {
    if (!cfg) return "";
    const id = cfg.sourceId || cfg.productId || "";

    if (id.startsWith("airnow-")) return "AirNow";
    if (id.startsWith("tempo-")) return "TEMPO";
    if (id.startsWith("tropomi-")) return "TROPOMI";
    if (id.startsWith("hrrr-")) return "HRRR";
    if (id.startsWith("geoscf-")) return "GEOS-CF";
    if (id.startsWith("goes-")) return "GOES";

    // Model Vector Layers (e.g. GAM-v1, GAM-v2, PM CBSA, EPA EMBER)
    const dsSelect = document.getElementById("MapDataSelect");
    if (dsSelect?.selectedOptions?.[0]) {
        const fullText = dsSelect.selectedOptions[0].text;
        return fullText.split("(")[0].trim() || fullText;
    }
    return "Model Dataset";
}

function openTSLayerPicker(lng, lat, supportedList) {
    if (!layerPickerOverlay || !layerPickerList) return;

    layerPickerList.innerHTML = "";
    supportedList.forEach(cfg => {
        const itemBtn = document.createElement("button");
        itemBtn.className = "tsplot-layer-option-btn";

        const isHourly = Boolean(cfg.type && cfg.type.includes("hourly"));
        const badgeText = isHourly ? "HOURLY" : "DAILY";
        const subtitle = getLayerDatasetName(cfg);

        itemBtn.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:0.2rem; flex:1; min-width:0;">
                <span style="font-size:1.4rem; font-weight:bold; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${cfg.title}</span>
                <span style="font-size:1.2rem;">${subtitle}</span>
            </div>
            <span style="font-size:1.2rem; font-weight:bold; padding:0.2rem 0.6rem; border-radius:var(--border-radius-0p8rem); border:0.1rem solid currentColor; white-space:nowrap;">
                ${badgeText}
            </span>
        `;

        itemBtn.addEventListener("click", () => {
            hideTSLayerPicker();
            showTSProfile(lng, lat, null, null, cfg.sourceId);
        });

        layerPickerList.appendChild(itemBtn);
    });

    layerPickerOverlay.style.display = "flex";
}

// TSPlot Controls DOM Elements
const controlsEl = document.getElementById("TSplotControls");
const rangeControlsEl = document.getElementById("TSplotRangeControls");
const lookbackInput = document.getElementById("TSplotLookbackInput");
const lookforwardInput = document.getElementById("TSplotLookforwardInput");
const updateBtn = document.getElementById("TSplotUpdateBtn");
const lbDateTextEl = document.getElementById("TSplotLBDateText");
const lfDateTextEl = document.getElementById("TSplotLFDateText");
const tzToggleGroup = document.getElementById("TSplotTzToggleGroup");
const tzUtcBtn = document.getElementById("TSplotTzUtcBtn");
const tzLocalBtn = document.getElementById("TSplotTzLocalBtn");

// Initialize listeners
if (closeBtn) {
    closeBtn.addEventListener("click", hideTSplotModal);
}

let pendingNavTarget = null;

function promptMapNavigation(dateStr, hourStr, displayLabel, isDaily) {
    const overlay = document.getElementById("TSplotConfirmOverlay");
    const msgEl = document.getElementById("TSplotConfirmMsg");
    if (!overlay || !msgEl) return;

    pendingNavTarget = {
        dateStr,
        hourStr,
        isDaily
    };

    msgEl.innerHTML = `Would you like to navigate the map to<br/><b style="color:var(--card-shadow);">${displayLabel}</b>?`;
    overlay.style.display = "flex";
}

let tsplotNavMarker = null;
let tsplotMapClickListener = null;

export function clearTSPlotNavMarker() {
    if (tsplotNavMarker) {
        tsplotNavMarker.remove();
        tsplotNavMarker = null;
    }
    if (tsplotMapClickListener && map) {
        map.off("click", tsplotMapClickListener);
        tsplotMapClickListener = null;
    }
}

document.addEventListener("smokelyze-reset-tsplot", () => {
    clearTSPlotNavMarker();
    hideTSplotModal();
    hideTSLayerPicker();
});

function setTSPlotNavMarker(lng, lat) {
    if (!map) return;
    clearTSPlotNavMarker();

    map.flyTo({
        center: [lng, lat],
        zoom: Math.max(map.getZoom(), 8),
        essential: true
    });

    if (window.maplibregl?.Marker) {
        const marker = new window.maplibregl.Marker()
            .setLngLat([lng, lat])
            .addTo(map);

        marker.getElement().addEventListener("click", (e) => {
            e.stopPropagation();
            clearTSPlotNavMarker();
        });

        tsplotMapClickListener = clearTSPlotNavMarker;
        setTimeout(() => {
            if (tsplotNavMarker && tsplotMapClickListener) {
                map.on("click", tsplotMapClickListener);
            }
        }, 300);

        tsplotNavMarker = marker;
    }
}

function initNavConfirmDialog() {
    const overlay = document.getElementById("TSplotConfirmOverlay");
    const yesBtn = document.getElementById("TSplotConfirmYesBtn");
    const cancelBtn = document.getElementById("TSplotConfirmCancelBtn");

    if (cancelBtn) {
        cancelBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (overlay) overlay.style.display = "none";
            pendingNavTarget = null;
        });
    }

    if (yesBtn) {
        yesBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (overlay) overlay.style.display = "none";
            if (!pendingNavTarget) return;

            const { dateStr, hourStr, isDaily } = pendingNavTarget;
            pendingNavTarget = null;

            const targetLng = state.currentTSContext?.lng;
            const targetLat = state.currentTSContext?.lat;

            const datePicker = document.getElementById("datePicker");
            if (datePicker && dateStr) {
                datePicker.value = dateStr;
                datePicker.dispatchEvent(new Event("change", { bubbles: true }));
            }

            if (!isDaily && hourStr !== null) {
                const timePicker = document.getElementById("timePicker");
                if (timePicker) {
                    timePicker.value = String(hourStr).padStart(2, "0");
                    timePicker.dispatchEvent(new Event("change", { bubbles: true }));
                }
            }

            hideTSplotModal();

            if (targetLng !== undefined && targetLat !== undefined) {
                setTSPlotNavMarker(targetLng, targetLat);
            }
        });
    }
}
initNavConfirmDialog();

const state = {
    pendingLngLat: null,
    currentTSContext: null,
    activeLookback: 4,
    activeLookforward: 4,
    lastLayerType: null,
    selectedTzMode: "UTC", // "UTC" or "LOCAL"
    cachedProfileArgs: null,
    siteIanaZone: "UTC",
    siteTzAbbr: "Local"
};

let activeChart = null;

/**
 * Determines the IANA timezone of a site/station from state name/code or coordinates
 */
export function getSiteTimezone(lng, lat, stateNameOrCode = "") {
    const s = String(stateNameOrCode || "").trim().toUpperCase();

    const eastern = ["CT", "DE", "FL", "GA", "IN", "KY", "ME", "MD", "MA", "MI", "NH", "NJ", "NY", "NC", "OH", "PA", "RI", "SC", "VA", "VT", "WV", "DC", "CONNECTICUT", "DELAWARE", "FLORIDA", "GEORGIA", "INDIANA", "KENTUCKY", "MAINE", "MARYLAND", "MASSACHUSETTS", "MICHIGAN", "NEW HAMPSHIRE", "NEW JERSEY", "NEW YORK", "NORTH CAROLINA", "OHIO", "PENNSYLVANIA", "RHODE ISLAND", "SOUTH CAROLINA", "VIRGINIA", "VERMONT", "WEST VIRGINIA"];
    const central = ["AL", "AR", "IL", "IA", "KS", "LA", "MN", "MS", "MO", "NE", "ND", "OK", "SD", "TN", "TX", "WI", "ALABAMA", "ARKANSAS", "ILLINOIS", "IOWA", "KANSAS", "LOUISIANA", "MINNESOTA", "MISSISSIPPI", "MISSOURI", "NEBRASKA", "NORTH DAKOTA", "OKLAHOMA", "SOUTH DAKOTA", "TENNESSEE", "TEXAS", "WISCONSIN"];
    const mountain = ["CO", "ID", "MT", "NM", "UT", "WY", "COLORADO", "IDAHO", "MONTANA", "NEW MEXICO", "UTAH", "WYOMING"];
    const pacific = ["CA", "NV", "OR", "WA", "CALIFORNIA", "NEVADA", "OREGON", "WASHINGTON"];

    if (s === "AZ" || s === "ARIZONA") return "America/Phoenix";
    if (s === "AK" || s === "ALASKA") return "America/Anchorage";
    if (s === "HI" || s === "HAWAII") return "Pacific/Honolulu";
    if (eastern.includes(s)) return "America/New_York";
    if (central.includes(s)) return "America/Chicago";
    if (mountain.includes(s)) return "America/Denver";
    if (pacific.includes(s)) return "America/Los_Angeles";

    if (lng !== undefined && lng !== null) {
        if (lng < -140) return "America/Anchorage";
        if (lng < -114) return "America/Los_Angeles";
        if (lng < -102) return "America/Denver";
        if (lng < -85) return "America/Chicago";
        if (lng < -65) return "America/New_York";
    }

    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
        return "UTC";
    }
}

function updateTzToggleUI() {
    if (!tzUtcBtn || !tzLocalBtn) return;
    if (state.selectedTzMode === "UTC") {
        tzUtcBtn.style.backgroundColor = "var(--card-shadow)";
        tzUtcBtn.style.color = "var(--color-bg)";
        tzUtcBtn.style.fontWeight = "bold";
        tzLocalBtn.style.backgroundColor = "var(--color-bg)";
        tzLocalBtn.style.color = "var(--text-main)";
        tzLocalBtn.style.fontWeight = "";
    } else {
        tzLocalBtn.style.backgroundColor = "var(--card-shadow)";
        tzLocalBtn.style.color = "var(--color-bg)";
        tzLocalBtn.style.fontWeight = "bold";
        tzUtcBtn.style.backgroundColor = "var(--color-bg)";
        tzUtcBtn.style.color = "var(--text-main)";
        tzUtcBtn.style.fontWeight = "";
    }
}

if (tzUtcBtn) {
    tzUtcBtn.addEventListener("click", () => {
        if (state.selectedTzMode === "UTC") return;
        state.selectedTzMode = "UTC";
        updateTzToggleUI();
        if (state.cachedProfileArgs) {
            renderChart(...state.cachedProfileArgs);
        }
    });
}
if (tzLocalBtn) {
    tzLocalBtn.addEventListener("click", () => {
        if (state.selectedTzMode === "LOCAL") return;
        state.selectedTzMode = "LOCAL";
        updateTzToggleUI();
        if (state.cachedProfileArgs) {
            renderChart(...state.cachedProfileArgs);
        }
    });
}

/**
 * Calculates start and end dates from a center date string and lookback/lookforward offsets
 */
function calculateTSDates(centerDateStr, lookbackDays, lookforwardDays) {
    if (!centerDateStr || centerDateStr === "LIVE") {
        const now = new Date();
        centerDateStr = now.toISOString().slice(0, 10);
    }
    const [y, m, d] = centerDateStr.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, d - lookbackDays));
    const end = new Date(Date.UTC(y, m - 1, d + lookforwardDays));
    return {
        startDateStr: start.toISOString().slice(0, 10),
        endDateStr: end.toISOString().slice(0, 10)
    };
}

const SVG_UPDATE = `<svg width="15" height="15"><use xlink:href="#icon-refresh" /></svg>`;
const SVG_DONE = `<svg width="15" height="15"><use xlink:href="#icon-check" /></svg>`;

function setTSPlotBtnSynced(isSynced) {
    if (!updateBtn) return;
    if (isSynced) {
        updateBtn.innerHTML = SVG_DONE;
        updateBtn.style.backgroundColor = "#059669";
        updateBtn.style.color = "#ffffff";
        updateBtn.style.borderColor = "#059669";
        updateBtn.setAttribute("data-is-synced", "true");
        updateBtn.setAttribute("title", "Data is up to date");
    } else {
        updateBtn.innerHTML = SVG_UPDATE;
        updateBtn.style.backgroundColor = "var(--color-bg)";
        updateBtn.style.color = "var(--text-main)";
        updateBtn.style.borderColor = "var(--card-shadow)";
        updateBtn.setAttribute("data-is-synced", "false");
        updateBtn.setAttribute("title", "Fetch time-series data");
    }
}

function updateTSRangePreview() {
    if (!state.currentTSContext) return;
    const lb = Math.max(0, Math.min(15, parseInt(lookbackInput?.value, 10) || 0));
    const lf = Math.max(0, Math.min(15, parseInt(lookforwardInput?.value, 10) || 0));
    const dates = calculateTSDates(state.currentTSContext.queryDateStr, lb, lf);
    if (lbDateTextEl) lbDateTextEl.textContent = dates.startDateStr;
    if (lfDateTextEl) lfDateTextEl.textContent = dates.endDateStr;
    const isSynced = (state.activeLookback === lb && state.activeLookforward === lf);
    setTSPlotBtnSynced(isSynced);
}

if (lookbackInput) {
    lookbackInput.addEventListener("input", updateTSRangePreview);
    lookbackInput.addEventListener("change", updateTSRangePreview);
}
if (lookforwardInput) {
    lookforwardInput.addEventListener("input", updateTSRangePreview);
    lookforwardInput.addEventListener("change", updateTSRangePreview);
}
if (updateBtn) {
    updateBtn.addEventListener("pointerdown", () => {
        if (updateBtn.getAttribute("data-is-synced") !== "true") {
            updateBtn.style.color = "var(--color-bg)";
            updateBtn.style.backgroundColor = "var(--card-shadow)";
        }
    });
    const resetStyle = () => {
        if (updateBtn.getAttribute("data-is-synced") !== "true") {
            updateBtn.style.color = "var(--text-main)";
            updateBtn.style.backgroundColor = "var(--color-bg)";
            updateBtn.style.borderColor = "var(--card-shadow)";
        }
    };
    updateBtn.addEventListener("pointerup", resetStyle);
    updateBtn.addEventListener("pointerleave", resetStyle);

    updateBtn.addEventListener("click", () => {
        if (!state.currentTSContext) return;
        // If already synced, ignore click to prevent redundant queries
        if (updateBtn.getAttribute("data-is-synced") === "true") {
            return;
        }
        const lb = Math.max(0, Math.min(15, parseInt(lookbackInput?.value, 10) || 0));
        const lf = Math.max(0, Math.min(15, parseInt(lookforwardInput?.value, 10) || 0));
        const currentLayerId = state.currentTSContext.activeConfig?.sourceId;
        showTSProfile(state.currentTSContext.lng, state.currentTSContext.lat, lb, lf, currentLayerId);
    });
}

// Auto-resize active chart with window once at the module level
window.addEventListener("resize", () => {
    if (activeChart) {
        activeChart.resize();
    }
});

// Capture coordinate from context menu directly in this module
if (map) {
    map.on("contextmenu", (e) => {
        state.pendingLngLat = e.lngLat;
    });
}

// Setup context menu button click listener
const tsplotBtn = document.getElementById("MapPostBtnTSplot");
if (tsplotBtn) {
    tsplotBtn.addEventListener("click", () => {
        // Hide context menu
        const ctxMenu = document.getElementById("MapPostContextMenu");
        if (ctxMenu) ctxMenu.style.display = "none";

        // Prompt login if not authenticated
        if (!auth.currentUser) {
            utils.showAuthOverlay();
            return;
        }

        // Show time-series profile for the clicked coordinate
        if (state.pendingLngLat) {
            const { lng, lat } = state.pendingLngLat;
            const { supported } = getActiveLayerContexts({ lng, lat });

            // If 2 or more supported layers are active, open the Layer Picker modal first!
            if (supported.length >= 2) {
                openTSLayerPicker(lng, lat, supported);
            } else if (supported.length === 1) {
                // Exactly 1 supported layer active -> open TS plot directly
                showTSProfile(lng, lat, null, null, supported[0].sourceId);
            } else {
                // 0 supported layers active -> show guidance in modal
                showTSProfile(lng, lat);
            }
        }
    });
}

document.addEventListener("smokelyzeAuthChanged", (e) => {
    updateAuthButton("MapPostBtnTSplot", e.detail?.user, "Time-Series Plot");
});

function hideTSplotModal() {
    if (modal) modal.style.display = "none";
    hideTSLayerPicker();
    const overlay = document.getElementById("TSplotConfirmOverlay");
    if (overlay) overlay.style.display = "none";
    pendingNavTarget = null;
    const dom = document.getElementById("TSplotChartContainer");
    if (dom) {
        const chart = echarts.getInstanceByDom(dom);
        if (chart) {
            chart.dispose();
        }
    }
    activeChart = null;
}

// Layer IDs that explicitly do NOT support Time-Series Plotting
const UNSUPPORTED_TSPLOT_LAYERS = new Set([
    "airfuse-o3", "airfuse-pm25",
    "wildfire-peri-curr", "wildfire-inci-curr",
    "wildfire-peri", "wildfire-inci",
    "wildfire-news", "MapPost",
    "burn", "smoke", "fire",
    "goes-geocolor-east", "goes-geocolor-west",
    "viirs-truecolor",
    "hysplit"
]);

// Static mapping for raster serverless product IDs
const RASTER_PRODUCT_MAP = {
    "tempo-no2": "TEMPO_NO2_L3",
    "tempo-hcho": "TEMPO_HCHO_L3",
    "tropomi-no2": "TROPOMI_NO2_L3",
    "tropomi-hcho": "TROPOMI_HCHO_L3",
    "hrrr-colmd": "COLMD_entire",
    "hrrr-massden": "MASSDEN_8m",
    "goes-aod-east": "ABI-L2-AODC-east",
    "goes-aod-west": "ABI-L2-AODC-west",
    "geoscf-o3": "GEOS_CF_o3",
    "geoscf-co": "GEOS_CF_co",
    "geoscf-no2": "GEOS_CF_no2",
    "geoscf-hcho": "GEOS_CF_hcho",
    "geoscf-pm25": "GEOS_CF_pm25_rh35",
    "geoscf-pm25oc": "GEOS_CF_pm25oc_rh35"
};

function getLayerConfigById(activeId) {
    if (!activeId || UNSUPPORTED_TSPLOT_LAYERS.has(activeId)) return null;

    const activeTmpl = LAYER_TEMPLATES.find(tmpl => tmpl.id === activeId);
    if (!activeTmpl) return null;

    const currentDataset = utils.getEffectiveDataset();
    let type = "daily_vector";
    let productId = activeTmpl.id;
    let sourceId = activeTmpl.id;
    let mapLayerId = `${activeTmpl.id}-circle`;
    let fieldKey = (typeof activeTmpl.field === "function") ? activeTmpl.field(currentDataset) : activeTmpl.field;
    let metric = fieldKey;
    let title = (typeof activeTmpl.title === "function") ? activeTmpl.title(currentDataset) : activeTmpl.title;
    let dataset = null;

    // 1. Raster layers (manualLayer = true)
    if (activeTmpl.manualLayer) {
        type = activeTmpl.hourly ? "hourly_raster" : "raster";
        mapLayerId = `${activeTmpl.id}-raster`;
        productId = RASTER_PRODUCT_MAP[activeTmpl.id] || activeTmpl.id;
    }
    // 2. AirNow Hourly
    else if (activeTmpl.hourly && activeTmpl.id.startsWith("airnow-")) {
        type = "airnow_hourly";
        dataset = "airnow_hourly_geojson";
        metric = activeTmpl.id === "airnow-hourly-pm25" ? "PM25" : (activeTmpl.id === "airnow-hourly-no2" ? "NO2" : "MDA8O3");
    }
    // 3. AirNow Daily
    else if (activeTmpl.id.startsWith("airnow-daily-")) {
        type = "airnow_daily";
        dataset = "airnow_date_geojson";
        metric = activeTmpl.id === "airnow-daily-pm25" ? "PM25" : "MDA8O3";
    }
    // 4. Model Daily Vector (gam-v1, gam-v2, pm-cbsa, epa-ember)
    else {
        type = "daily_vector";
        mapLayerId = `${activeTmpl.id}-${currentDataset}-circle`;
        dataset = currentDataset.replace(/-/g, "_");
    }

    return {
        type,
        productId,
        sourceId,
        mapLayerId,
        fieldKey,
        metric,
        title,
        dataset,
        isPoint: !activeTmpl.manualLayer
    };
}

function getActiveLayerContexts(targetLngLat = null) {
    const activeIds = [];
    const seen = new Set();

    // 1. Traverse activeLayerStack in reverse (top-most layer first)
    if (activeLayerStack && Array.isArray(activeLayerStack)) {
        for (let i = activeLayerStack.length - 1; i >= 0; i--) {
            const id = activeLayerStack[i];
            const checkbox = document.getElementById(`layer-${id}`);
            if (checkbox && checkbox.checked && !seen.has(id)) {
                activeIds.push(id);
                seen.add(id);
            }
        }
    }

    // 2. Also check any other checked layer in DOM not yet captured in stack
    const checkedInputs = document.querySelectorAll('input[id^="layer-"]:checked');
    checkedInputs.forEach(input => {
        const id = input.id.replace("layer-", "");
        if (!seen.has(id)) {
            activeIds.push(id);
            seen.add(id);
        }
    });

    const supported = [];
    const unsupported = [];
    const coords = targetLngLat || state.pendingLngLat;

    // Find the single closest rendered station feature to the clicked coordinate
    let closestFeature = null;
    let minDistanceSq = Infinity;

    if (coords && map) {
        try {
            const clickPx = map.project(new maplibregl.LngLat(coords.lng, coords.lat));
            const hitBbox = [[clickPx.x - 15, clickPx.y - 15], [clickPx.x + 15, clickPx.y + 15]];
            const pointLayerIds = activeIds
                .map(id => getLayerConfigById(id))
                .filter(c => c && c.isPoint)
                .map(c => c.mapLayerId);

            if (pointLayerIds.length > 0) {
                const features = map.queryRenderedFeatures(hitBbox, { layers: pointLayerIds });
                for (const f of features) {
                    if (f.geometry?.coordinates) {
                        const featPx = map.project(f.geometry.coordinates);
                        const distSq = (featPx.x - clickPx.x) ** 2 + (featPx.y - clickPx.y) ** 2;
                        if (distSq < minDistanceSq) {
                            minDistanceSq = distSq;
                            closestFeature = f;
                        }
                    }
                }
            }
        } catch {
            closestFeature = null;
        }
    }

    activeIds.forEach(id => {
        const cfg = getLayerConfigById(id);
        if (!cfg) {
            unsupported.push({ id });
            return;
        }

        if (coords) {
            // 1. Point vector layers: closest station must contain a valid value for this metric
            if (cfg.isPoint) {
                if (!closestFeature) return;
                const val = closestFeature.properties?.[cfg.fieldKey];
                if (val == null || val === "NA" || val === "" || isNaN(val)) return;
            }
            // 2. Raster layers: require active raster pixel data (non-NA / visible tooltip) at coordinate
            else {
                const rasterInfo = getRasterTooltipInfo?.(cfg.sourceId, coords.lng, coords.lat);
                if (!rasterInfo) return;
            }
        }

        supported.push(cfg);
    });

    return { supported, unsupported };
}

function getYAxisTitleAndDecimals(sourceId) {
    const tmpl = LAYER_TEMPLATES.find(t => t.id === sourceId);
    if (tmpl) {
        const currentDataset = utils.getEffectiveDataset();
        const displayTitle = (typeof tmpl.title === "function") ? tmpl.title(currentDataset) : tmpl.title;
        let title = displayTitle;

        if (sourceId.includes("no2")) {
            title = "NO2";
        } else if (sourceId.includes("hcho")) {
            title = "HCHO";
        } else if (sourceId.includes("co")) {
            title = "CO";
        } else if (sourceId.includes("o3")) {
            title = "O3";
        } else if (sourceId.includes("pm25oc")) {
            title = "PM2.5-OC";
        } else if (sourceId.includes("pm25")) {
            title = "PM2.5";
        } else if (sourceId === "hrrr-colmd") {
            title = "Smoke VCD";
        } else if (sourceId === "hrrr-massden") {
            title = "Smoke Concentration at 8m";
        } else if (sourceId.includes("goes")) {
            title = "AOD";
        } else {
            // Clean up titles for plot display (e.g. remove redundant prefixes)
            title = displayTitle
                .replace("AirNow Obs ", "")
                .replace("Obs ", "")
                .replace("Pred ", "")
                .replace(" (hourly)", "");
        }

        const unit = (typeof tmpl.unit === "function") ? tmpl.unit(currentDataset) : (tmpl.unit || "");
        if (unit && !title.toLowerCase().includes(unit.toLowerCase())) {
            title += ` (${unit})`;
        }

        return {
            title: title,
            decimals: tmpl.decimals !== undefined ? tmpl.decimals : 1
        };
    }
    return { title: "Value", decimals: 1 };
}

function getDisplayScale(sourceId, realValue) {
    const isTempo = sourceId.includes("tempo");
    const isTropomi = sourceId.includes("tropomi");
    const isHrrrColmd = sourceId === "hrrr-colmd";

    if (isTempo || isTropomi) {
        return realValue / 1e14;
    }
    if (isHrrrColmd) {
        return realValue / 1e3;
    }
    return realValue;
}

async function showTSProfile(lng, lat, customLookback = null, customLookforward = null, targetLayerId = null) {
    if (!modal) return;

    modal.style.display = "block";
    chartContainer.style.display = "none";
    errorEl.style.display = "none";
    loadingEl.style.display = "block";
    loadingTextEl.textContent = "Checking active layer...";

    const { supported, unsupported, totalActive } = getActiveLayerContexts({ lng, lat });

    // Case 1: No supported layers are active
    if (!supported || supported.length === 0) {
        if (controlsEl) controlsEl.style.display = "none";

        if (unsupported.length > 0) {
            showError(`
                <div style="margin-bottom: 1.6rem; font-size: 1.6rem; font-weight: bold; color: var(--text-main);">
                    This layer does not support the Time-Series Plot feature.
                </div>
                <div style="color: var(--text-main);
                            margin: 0 auto;
                            text-align: left;
                            background: var(--color-bg);
                            padding: 1.5rem 2.2rem;
                            border-radius: var(--border-radius-0p8rem);
                            border: 0.1rem solid var(--card-shadow);
                            font-size: 1.4rem;">
                    <p style="font-weight: bold; margin-bottom: 0.6rem;">Unsupported Layers:</p>
                    <ul style="margin: 0; padding-left: 1.8rem; line-height: 1.6;">
                        <li>Wildfire News & MapPost</li>
                        <li>NIFC: WF incidents, WF perimeters</li>
                        <li>AirNow: AirFuse O3, AirFuse PM2.5</li>
                        <li>Satellite-based: HMS-smoke, HMS-fire, GOES-GeoColor, VIIRS-TrueColor, MODIS area burned</li>
                    </ul>
                </div>
            `);
        } else {
            showError("Please toggle on a layer first.");
        }
        return;
    }

    // Case 2: One or more supported layers found
    let activeConfig = null;
    if (targetLayerId) {
        activeConfig = supported.find(c => c.sourceId === targetLayerId);
    }
    if (!activeConfig) {
        activeConfig = supported[0];
    }

    // Capture coordinate for future refreshes
    state.pendingLngLat = { lng, lat };

    const modalTitleEl = document.getElementById("TSplotModalTitle");
    if (modalTitleEl) {
        modalTitleEl.textContent = `${activeConfig.title} Time-Series Plot`;
    }

    const switchLayerBtn = document.getElementById("TSplotSwitchLayerBtn");
    if (switchLayerBtn) {
        if (supported.length >= 2) {
            switchLayerBtn.style.display = "inline-flex";
            switchLayerBtn.onclick = () => {
                openTSLayerPicker(lng, lat, supported);
            };
        } else {
            switchLayerBtn.style.display = "none";
        }
    }

    let selectedDateStr = utils.currentDate();
    let localSelectedDateStr = selectedDateStr;
    let chartDateStr = selectedDateStr;
    let queryDateStr = selectedDateStr;

    const isVectorDaily = activeConfig.isPoint;
    const isHourly = (activeConfig.type === "airnow_hourly" || activeConfig.type === "hourly_raster");
    const isDaily = !isHourly;
    const isAirnowHourly = (activeConfig.type === "airnow_hourly");

    if (controlsEl) {
        controlsEl.style.display = (isVectorDaily || isHourly) ? "flex" : "none";
    }
    if (rangeControlsEl) {
        rangeControlsEl.style.display = isVectorDaily ? "flex" : "none";
    }
    if (tzToggleGroup) {
        tzToggleGroup.style.display = isHourly ? "flex" : "none";
    }

    // Determine target local hour / timestamp for reference line
    let targetX = null;
    if (isHourly) {
        const timeInput = document.getElementById("timePicker");
        const localHour = timeInput ? parseInt(timeInput.value, 10) : 12;
        const [ly, lm, ld] = selectedDateStr.split("-").map(Number);
        const localDate = new Date(ly, lm - 1, ld, localHour, 0, 0);
        const utcY = localDate.getUTCFullYear();
        const utcM = String(localDate.getUTCMonth() + 1).padStart(2, "0");
        const utcD = String(localDate.getUTCDate()).padStart(2, "0");
        const utcHour = String(localDate.getUTCHours()).padStart(2, "0");
        const utcIsoDateStr = `${utcY}-${utcM}-${utcD}`;
        targetX = `${utcIsoDateStr} ${utcHour}:00`;

        // For raster datasets, use the corresponding UTC date
        if (activeConfig.type === "hourly_raster") {
            chartDateStr = utcIsoDateStr;
            queryDateStr = utcIsoDateStr;
        }
    }

    state.currentTSContext = {
        lng,
        lat,
        activeConfig,
        queryDateStr
    };

    // ==========================================
    // Server-side API Query (BigQuery / Cloud Run)
    // ==========================================
    loadingTextEl.textContent = `Requesting time-series profile for ${activeConfig.title || activeConfig.productId}...`;

    try {
        const user = auth?.currentUser;
        const idToken = user ? await user.getIdToken() : null;
        const headers = {};
        if (idToken) {
            headers["Authorization"] = `Bearer ${idToken}`;
        }

        let detectedStateCode = "";
        let url = `/api/tsplot?date=${queryDateStr}&product=${activeConfig.productId}&lat=${lat}&lon=${lng}`;
        let locationLabel = `(${lng.toFixed(4)}, ${lat.toFixed(4)})`;

        // Vector point stations (AirNow Daily, AirNow Hourly, Model Predictions) -> Fast BigQuery TSPlot query
        if (activeConfig.isPoint) {
            const clickPx = map.project(new maplibregl.LngLat(lng, lat));
            const bbox = [[clickPx.x - 15, clickPx.y - 15], [clickPx.x + 15, clickPx.y + 15]];
            const features = map.queryRenderedFeatures(bbox, { layers: [activeConfig.mapLayerId] });

            if (!features || features.length === 0) {
                showError("No data point found nearby. Please click on or near a visible data point.");
                return;
            }

            // Find closest station feature to clicked point
            let closestFeature = features[0];
            let minDistanceSq = Infinity;
            for (const f of features) {
                if (f.geometry?.coordinates) {
                    const featPx = map.project(f.geometry.coordinates);
                    const distSq = (featPx.x - clickPx.x) ** 2 + (featPx.y - clickPx.y) ** 2;
                    if (distSq < minDistanceSq) {
                        minDistanceSq = distSq;
                        closestFeature = f;
                    }
                }
            }

            const props = closestFeature.properties;
            const aqs = props.AQS || props.AQS_PM || props.AQS_O3;
            if (!aqs) {
                showError("AQS identifier not found for the selected station.");
                return;
            }

            const siteName = props.site_name || props.site || "Unknown Station";
            detectedStateCode = props.state || "";
            locationLabel = detectedStateCode ? `${siteName} (${aqs}), ${detectedStateCode}` : `${siteName} (${aqs})`;

            const defaultVal = isAirnowHourly ? 1 : 4;

            let lookback = customLookback;
            let lookforward = customLookforward;

            if (lookback === null) {
                const isSameType = (state.lastLayerType === activeConfig.type);
                lookback = isSameType ? (parseInt(lookbackInput?.value, 10) || defaultVal) : defaultVal;
                lookforward = isSameType ? (parseInt(lookforwardInput?.value, 10) || defaultVal) : defaultVal;
            }
            state.lastLayerType = activeConfig.type;

            if (lookbackInput) lookbackInput.value = lookback;
            if (lookforwardInput) lookforwardInput.value = lookforward;
            const dates = calculateTSDates(queryDateStr, lookback, lookforward);
            if (lbDateTextEl) lbDateTextEl.textContent = dates.startDateStr;
            if (lfDateTextEl) lfDateTextEl.textContent = dates.endDateStr;

            const queryParams = new URLSearchParams({
                mode: "tsplot",
                dataset: activeConfig.dataset,
                date: queryDateStr,
                aqs: aqs,
                metric: activeConfig.metric,
                lookback: lookback,
                lookforward: lookforward
            });
            url = `/api/bg?${queryParams.toString()}`;
        }

        const response = await fetch(url, { headers });
        if (!response.ok) {
            if (response.status === 401) {
                showError("Authentication required. Please sign in.");
            } else {
                const text = await response.text();
                showError(`Failed to load profile: ${text || response.statusText}`);
            }
            return;
        }

        const data = await response.json();
        if (!data || data.length === 0) {
            showError(`No data points found for ${activeConfig.productId} on ${queryDateStr}.`);
            return;
        }

        const finalData = data.map(d => ({
            hour: d.hour,
            date: d.date,
            value: d.value,
            displayValue: getDisplayScale(activeConfig.sourceId, d.value)
        }));

        const isHourly = (activeConfig.type === "airnow_hourly" || activeConfig.type === "hourly_raster");
        if (tzToggleGroup) {
            tzToggleGroup.style.display = isHourly ? "flex" : "none";
        }
        const siteIanaZone = getSiteTimezone(lng, lat, detectedStateCode);
        const siteTzAbbr = new Intl.DateTimeFormat("en-US", { timeZone: siteIanaZone, timeZoneName: "short" })
            .formatToParts(new Date())
            .find(p => p.type === "timeZoneName")?.value || "Local";

        state.siteIanaZone = siteIanaZone;
        state.siteTzAbbr = siteTzAbbr;
        if (tzLocalBtn) {
            tzLocalBtn.textContent = `Site Time (${siteTzAbbr})`;
        }
        updateTzToggleUI();

        state.cachedProfileArgs = [finalData, activeConfig, localSelectedDateStr, chartDateStr, targetX, locationLabel, isDaily, isAirnowHourly];

        loadingEl.style.display = "none";
        chartContainer.style.display = "block";

        renderChart(finalData, activeConfig, localSelectedDateStr, chartDateStr, targetX, locationLabel, isDaily, isAirnowHourly);

        if (isVectorDaily) {
            state.activeLookback = (customLookback !== null) ? customLookback : (parseInt(lookbackInput?.value, 10) || 4);
            state.activeLookforward = (customLookforward !== null) ? customLookforward : (parseInt(lookforwardInput?.value, 10) || 4);
            setTSPlotBtnSynced(true);
        }

    } catch (err) {
        console.error("Time-series profile fetch failed:", err);
        showError("An error occurred while loading data from the serverless API.");
    }
}

function showError(msg) {
    loadingEl.style.display = "none";
    chartContainer.style.display = "none";
    if (controlsEl) controlsEl.style.display = "none";
    errorEl.innerHTML = msg;
    errorEl.style.display = "block";
}

function renderChart(data, activeConfig, localSelectedDateStr, utcDateStr, targetX, locationLabel, isDaily, isAirnowHourly) {
    const dom = document.getElementById("TSplotChartContainer");
    dom.style.height = "100%";
    let chart = echarts.getInstanceByDom(dom);
    if (chart) {
        chart.dispose();
    }
    chart = echarts.init(dom);
    activeChart = chart;

    const theme = getPlotTheme();
    const textColor = theme.axisText;
    const bgColor = theme.paper_bgcolor;
    const borderColor = theme.plot_bordercol;
    const gridColor = theme.grid;
    const primaryColor = theme.plot_bordercol;
    const fontSize = theme.fontSize;

    const { title: yTitle, decimals } = getYAxisTitleAndDecimals(activeConfig.sourceId);

    const isLocalTz = (state.selectedTzMode === "LOCAL" && !isDaily);
    const effectiveTzName = isLocalTz ? state.siteTzAbbr : "UTC";

    // Transform points to site local time if Local mode is selected
    const transformedData = data.map(d => {
        let utcDate;
        if (d.date && d.date.includes(" ")) {
            const [dStr, tStr] = d.date.split(" ");
            const [y, m, dt] = dStr.split("-").map(Number);
            const h = parseInt(tStr.split(":")[0], 10);
            utcDate = new Date(Date.UTC(y, m - 1, dt, h, 0, 0));
        } else {
            const h = d.hour !== undefined ? d.hour : 0;
            const [qy, qm, qd] = utcDateStr.split("-").map(Number);
            utcDate = new Date(Date.UTC(qy, qm - 1, qd, h, 0, 0));
        }

        if (isLocalTz) {
            const locDate = new Intl.DateTimeFormat("en-CA", { timeZone: state.siteIanaZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(utcDate);
            const locHStr = new Intl.DateTimeFormat("en-US", { timeZone: state.siteIanaZone, hour: "2-digit", hour12: false }).format(utcDate);
            const locH = parseInt(locHStr, 10) % 24;
            const paddedH = String(locH).padStart(2, "0");
            return {
                ...d,
                chartFullStr: `${locDate} ${paddedH}:00`,
                chartTimeStr: paddedH,
                chartDateStr: locDate,
                chartHour: locH
            };
        } else {
            const paddedH = String(d.hour !== undefined ? d.hour : (d.date?.includes(" ") ? parseInt(d.date.split(" ")[1], 10) : 0)).padStart(2, "0");
            const dPart = d.date?.includes(" ") ? d.date.split(" ")[0] : utcDateStr;
            return {
                ...d,
                chartFullStr: d.date || `${utcDateStr} ${paddedH}:00`,
                chartTimeStr: paddedH,
                chartDateStr: dPart,
                chartHour: parseInt(paddedH, 10)
            };
        }
    });

    const xVals = isDaily
        ? data.map(d => d.date)
        : transformedData.map(d => d.chartFullStr);

    const yVals = data.map(d => d.displayValue);

    const displayName = activeConfig.title || activeConfig.productId;
    const titleText = isDaily
        ? `${displayName} Daily Profile`
        : `${displayName} Time-Series Plot`;
    const subTitleText = isDaily || (isAirnowHourly && data.length > 24)
        ? `Selected: ${localSelectedDateStr} at ${locationLabel}`
        : `${localSelectedDateStr} at ${locationLabel}`;

    // Target reference line
    let finalTargetX = null;
    if (isDaily) {
        finalTargetX = localSelectedDateStr;
    } else if (isLocalTz) {
        const fullTarget = targetX.includes(" ") ? targetX : `${utcDateStr} ${targetX}`;
        const [dStr, tStr] = fullTarget.split(" ");
        const [y, m, dt] = dStr.split("-").map(Number);
        const h = parseInt(tStr.split(":")[0], 10);
        const utcTarget = new Date(Date.UTC(y, m - 1, dt, h, 0, 0));
        const locTargetDate = new Intl.DateTimeFormat("en-CA", { timeZone: state.siteIanaZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(utcTarget);
        const locTargetH = String(parseInt(new Intl.DateTimeFormat("en-US", { timeZone: state.siteIanaZone, hour: "numeric", hour12: false }).format(utcTarget), 10) % 24).padStart(2, "0");
        finalTargetX = `${locTargetDate} ${locTargetH}:00`;
    } else {
        finalTargetX = targetX.includes(" ") ? targetX : `${utcDateStr} ${targetX}`;
    }

    const markLineData = [];

    // Add solid vertical lines at midnight (00:00) date boundaries
    if (!isDaily) {
        xVals.forEach((xVal, idx) => {
            if (idx > 0 && typeof xVal === "string" && (xVal.endsWith("00:00") || xVal.endsWith(" 00"))) {
                markLineData.push({
                    xAxis: xVal,
                    symbol: "none",
                    symbolSize: 0,
                    label: { show: false },
                    lineStyle: {
                        color: textColor,
                        type: "solid",
                        width: 1.5,
                        opacity: 1
                    }
                });
            }
        });
    }

    if (finalTargetX !== null) {
        markLineData.push({
            xAxis: finalTargetX,
            label: {
                show: true,
                formatter: isDaily ? "Selected Date" : "Selected Time",
                position: "end",
                color: "red",
                fontSize: fontSize * 0.8,
                fontWeight: "bold",
                backgroundColor: bgColor,
                padding: [2, 4],
                borderRadius: 3,
                distance: 5
            },
            lineStyle: {
                color: "red",
                type: "dashed",
                width: 2
            }
        });
    }

    // Configure single x-axis: Daily (Date) vs Hourly (Smart Diurnal with Day-boundary at 00:00)
    const step = data.length > 120 ? 12 : (data.length > 24 ? 6 : 3);

    const xAxisOption = isDaily ? {
        type: "category",
        boundaryGap: false,
        triggerEvent: true,
        data: xVals,
        axisLabel: {
            color: textColor,
            fontSize: fontSize * 0.8,
            rotate: 0
        },
        axisLine: { lineStyle: { color: gridColor } },
        splitLine: {
            show: true,
            lineStyle: {
                color: gridColor,
                type: "dashed",
                width: 1
            }
        },
        axisTick: { alignWithLabel: true },
        name: "Date",
        nameLocation: "middle",
        nameGap: 25,
        nameTextStyle: {
            color: textColor,
            fontSize: fontSize * 0.8,
            fontWeight: "bold"
        }
    } : {
        type: "category",
        boundaryGap: false,
        triggerEvent: true,
        data: xVals,
        axisLabel: {
            color: textColor,
            fontSize: fontSize * 0.8,
            rotate: 0,
            interval: 0,
            formatter: function (val, index) {
                if (!val || typeof val !== "string") return "";
                const parts = val.split(" ");
                if (parts.length !== 2) return val;
                const [dateStr, timeStr] = parts;
                const hour = parseInt(timeStr.split(":")[0], 10);

                // Date label on midnight (00:00) OR at the very start of the chart (index === 0)
                if (hour === 0 || index === 0) {
                    return `${dateStr.slice(5)}
${String(hour).padStart(2, "0")}`;
                }
                // Intermediate diurnal interval hours: Show 2-digit hour number only
                if (hour % step === 0) {
                    return String(hour).padStart(2, "0");
                }
                return "";
            }
        },
        splitLine: {
            show: true,
            interval: function (index, value) {
                if (!value || typeof value !== "string") return false;
                const parts = value.split(" ");
                if (parts.length !== 2) return false;
                const hour = parseInt(parts[1].split(":")[0], 10);
                return (hour === 0 || index === 0 || hour % step === 0);
            },
            lineStyle: {
                color: gridColor,
                type: "dashed",
                width: 1
            }
        },
        axisLine: { lineStyle: { color: gridColor } },
        axisTick: {
            alignWithLabel: true,
            interval: function (index, value) {
                if (!value || typeof value !== "string") return false;
                const parts = value.split(" ");
                if (parts.length !== 2) return false;
                const hour = parseInt(parts[1].split(":")[0], 10);
                return (hour === 0 || index === 0 || hour % step === 0);
            }
        },
        name: `Time (${effectiveTzName})`,
        nameLocation: "middle",
        nameGap: 40,
        nameTextStyle: {
            color: textColor,
            fontSize: fontSize * 0.8,
            fontWeight: "bold"
        }
    };

    const option = {
        backgroundColor: "transparent",
        title: {
            text: titleText,
            subtext: subTitleText,
            left: "center",
            top: 10,
            textStyle: {
                color: textColor,
                fontSize: fontSize,
                fontWeight: "bold",
                fontFamily: "Outfit, sans-serif"
            },
            subtextStyle: {
                color: textColor,
                fontSize: fontSize * 0.8,
                fontFamily: "Inter, sans-serif"
            }
        },
        tooltip: {
            trigger: "axis",
            backgroundColor: bgColor,
            borderColor: borderColor,
            borderWidth: 1,
            textStyle: { color: textColor },
            formatter: function (params) {
                if (!params || params.length === 0) return "";
                const headerLabel = isDaily ? `Date: ${params[0].axisValue}` : `${effectiveTzName}: ${params[0].axisValue}`;
                let html = `<b>${headerLabel}</b><br/>`;
                params.forEach(p => {
                    if (p.value !== undefined && p.value !== null) {
                        const formattedVal = Number(p.value).toFixed(decimals);
                        html += `${p.marker} ${p.seriesName}: <b>${formattedVal}</b><br/>`;
                    }
                });
                html += `
                    <div style="color: var(--card-shadow);
                                margin-top: 0.6rem;
                                border-top: 0.2rem solid var(--text-main);
                                padding-top: 0.4rem;
                                text-align: center;">
                        *Click point to navigate map
                    </div>`;
                return html;
            }
        },
        legend: {
            show: false
        },
        toolbox: {
            show: true,
            right: 20,
            top: 20,
            feature: {
                saveAsImage: {
                    show: true,
                    title: "Save Image",
                    name: `smokelyze_${(activeConfig.productId || "timeseries").replace(/[^a-zA-Z0-9_-]/g, "_")}_${utils.currentDate()}`,
                    pixelRatio: 2,
                    backgroundColor: bgColor,
                    iconStyle: {
                        borderColor: textColor
                    },
                    emphasis: {
                        iconStyle: {
                            borderColor: primaryColor
                        }
                    }
                }
            }
        },
        grid: {
            top: 100,
            bottom: isDaily ? 70 : 80,
            left: 55,
            right: 40,
            containLabel: true
        },
        xAxis: xAxisOption,
        yAxis: {
            type: "value",
            scale: true, // Enable auto-scaling (stops forcing 0 as minimum)
            axisLabel: {
                color: textColor,
                fontSize: fontSize * 0.8,
                formatter: function (value) {
                    return Number(value).toFixed(decimals);
                }
            },
            axisLine: { lineStyle: { color: gridColor } },
            splitLine: { lineStyle: { color: gridColor } },
            name: yTitle,
            nameLocation: "middle",
            nameGap: 55,
            nameTextStyle: {
                color: textColor,
                fontSize: fontSize * 0.8,
                fontWeight: "bold"
            }
        },
        series: [
            {
                name: activeConfig.title,
                type: "line",
                data: yVals,
                symbol: "circle",
                symbolSize: 8,
                cursor: "pointer",
                itemStyle: {
                    color: primaryColor,
                    borderColor: bgColor,
                    borderWidth: 2
                },
                lineStyle: {
                    width: 2.5
                },
                markLine: {
                    symbol: "none",
                    symbolSize: 0,
                    data: markLineData
                }
            }
        ]
    };

    chart.setOption(option);

    function handleNavByIndex(ptIndex) {
        if (ptIndex === undefined || ptIndex === null || ptIndex < 0 || ptIndex >= data.length) return;
        const rawPt = data[ptIndex];
        const transPt = transformedData[ptIndex];
        if (!rawPt) return;

        let targetLocalDateStr = "";
        let targetLocalHour = null;
        let displayLabel = "";

        if (isDaily) {
            targetLocalDateStr = rawPt.date;
            displayLabel = targetLocalDateStr;
        } else {
            // Extract UTC timestamp
            let utcDate;
            if (rawPt.date && rawPt.date.includes(" ")) {
                const [dStr, tStr] = rawPt.date.split(" ");
                const [y, m, dt] = dStr.split("-").map(Number);
                const h = parseInt(tStr.split(":")[0], 10);
                utcDate = new Date(Date.UTC(y, m - 1, dt, h, 0, 0));
            } else {
                const h = rawPt.hour !== undefined ? rawPt.hour : 0;
                const [qy, qm, qd] = utcDateStr.split("-").map(Number);
                utcDate = new Date(Date.UTC(qy, qm - 1, qd, h, 0, 0));
            }

            // User browser local date & hour for map datePicker & timePicker
            const localY = utcDate.getFullYear();
            const localM = String(utcDate.getMonth() + 1).padStart(2, "0");
            const localD = String(utcDate.getDate()).padStart(2, "0");
            const localH = String(utcDate.getHours()).padStart(2, "0");
            targetLocalDateStr = `${localY}-${localM}-${localD}`;
            targetLocalHour = localH;

            if (isLocalTz) {
                displayLabel = `${transPt.chartFullStr} (${state.siteTzAbbr})`;
            } else {
                displayLabel = `${transPt.chartFullStr} (UTC)`;
            }
        }

        promptMapNavigation(targetLocalDateStr, targetLocalHour, displayLabel, isDaily);
    }

    // 1. Direct component clicks (series dots, markers, or x-axis labels)
    chart.on("click", function (params) {
        if (!params) return;
        if (params.dataIndex !== undefined) {
            handleNavByIndex(params.dataIndex);
        } else if (params.componentType === "xAxis") {
            const clickedVal = params.value;
            const idx = xVals.indexOf(clickedVal);
            if (idx !== -1) handleNavByIndex(idx);
        }
    });

    // 2. Click anywhere along the vertical time column in the chart grid area
    chart.getZr().on("click", function (event) {
        if (event.target) return; // Handled by chart element click
        const pointInPixel = [event.offsetX, event.offsetY];
        if (chart.containPixel("grid", pointInPixel)) {
            const pointInGrid = chart.convertFromPixel({ seriesIndex: 0 }, pointInPixel);
            if (pointInGrid && pointInGrid[0] !== undefined) {
                const ptIndex = Math.round(pointInGrid[0]);
                handleNavByIndex(ptIndex);
            }
        }
    });
}

