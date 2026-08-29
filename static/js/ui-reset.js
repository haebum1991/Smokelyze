
import { DATA_IMPORT_METHOD } from "./layers-def.js";
import { map, mapConfig } from "./map-init.js";
import { applyLayerToggles } from "./layers-handler.js";
import { EMPTY_FC } from "./layers-constants.js";
import { activeLayerStack } from "./layers-state.js";
import { clearAll, resetGlobalStateShading, resetGlobalPointLayers, resetGlobalNaShading } from "./ui-state.js";
import { clearHighlight } from "./utils.js";
import { resetLoadedSources } from "./loader.js";
import { resetLookbackState } from "./bq-lookback.js";
import { resetState as resetBarLine } from "./stats-plot-dy-barline.js";
import { resetState as resetParCoords } from "./stats-plot-dy-parcoords.js";
import { resetState as resetScatter } from "./stats-plot-dy-scatter.js";
import { clearModelStats } from "./loader.js";
import { hideTimeControls } from "./ui-time.js";
import { clearAllRaster } from "./raster-loader.js";
import { updateAllActiveSources } from "./loader.js";
import { 
  setStatsDrawer, 
  setDescDrawer, 
  setNewsDrawer, 
  setMapPostDrawer, 
  setLegendDrawer, 
  setHysplitDrawer, 
  setAerscreenDrawer,
  setAreaStatsDrawer,
  setBoundarySettings
} from "./ui-toggles.js";

function numOr(x, d) { return (typeof x === "number" && isFinite(x)) ? x : d; }

export function resetUIAndData() {
  // 1) Clear states
  clearAll?.();
  clearHighlight?.();
  resetGlobalStateShading?.();
  resetGlobalPointLayers?.();
  resetGlobalNaShading?.();
  setBoundarySettings?.();
  clearModelStats?.();
  hideTimeControls?.();
  closeAllDrawersExceptAccordion();

  // 2) Reset Loader cache and Lookback states
  resetLoadedSources?.();
  resetLookbackState?.();

  // 3) Clear plot drill-down states
  resetBarLine?.();
  resetParCoords?.();
  resetScatter?.();

  // 4) Clear checkboxes and data
  const ds = DATA_IMPORT_METHOD || {};
  const EMPTY = EMPTY_FC;

  document.querySelectorAll('input[type="checkbox"][id^="layer-"]').forEach(cb => {
    cb.checked = false;
  });

  const definedSources = new Set();
  Object.values(ds).forEach(d => {
    if (d.source) definedSources.add(d.source);
  });

  definedSources.forEach(srcId => {
    const source = map?.getSource(srcId);
    if (source && source.type === "geojson") {
      source.setData(EMPTY);
    }
  });

  // 5) Clear TEMPO Canvas layers explicitly & reset raster opacities to default (0.9)
  clearAllRaster?.();
  const rasterLayerIds = [
    "tempo-no2-raster",
    "tempo-hcho-raster",
    "tropomi-no2-raster", 
    "tropomi-hcho-raster",
    "hrrr-colmd-raster",
    "hrrr-massden-raster",
    "goes-aod-east-raster", 
    "goes-aod-west-raster",
    "goes-geocolor-east-raster", 
    "goes-geocolor-west-raster",
    "viirs-truecolor-raster",
    "geoscf-o3-raster",
    "geoscf-co-raster",
    "geoscf-no2-raster",
    "geoscf-hcho-raster",
    "geoscf-pm25-raster",
    "geoscf-pm25oc-raster"
  ];
  rasterLayerIds.forEach(id => {
    if (map && map.getLayer(id)) {
      try {
        map.setPaintProperty(id, "raster-opacity", 0.9);
      } catch (e) {}
    }
  });
  
  
  const airfuseLayerIds = ["airfuse-pm25-fill", "airfuse-o3-fill"];
  airfuseLayerIds.forEach(id => {
    if (map && map.getLayer(id)) {
      try {
        map.setPaintProperty(id, "fill-opacity", 0.5);
        const lineId = id.replace("-fill", "-line");
        if (map.getLayer(lineId)) {
          map.setPaintProperty(lineId, "line-opacity", 0.25);
        }
      } catch (e) {}
    }
  });


  // 6) Visibility & Data Synchronization
  applyLayerToggles?.();
  if (activeLayerStack) activeLayerStack.length = 0;

  const searchWrapper = document.getElementById("SiteSearchWrapperPublished");
  if (searchWrapper) searchWrapper.style.display = "none";

  // Final single refresh for loaders/UI
  updateAllActiveSources?.();
  
  // 7) Clear HYSPLIT, AERSCREEN & TSPlot from Map (Decoupled via events)
  document.dispatchEvent(new CustomEvent("smokelyze-reset-hysplit", { detail: { deleteHistory: false } }));
  document.dispatchEvent(new CustomEvent("smokelyze-reset-aerscreen"));
  document.dispatchEvent(new CustomEvent("smokelyze-reset-tsplot"));
}

/**
 * Closes all side drawers except the main Layers accordion.
 */
export function closeAllDrawersExceptAccordion() {
  // 1) Use the setter functions to ensure button states & body classes are synced
  setStatsDrawer?.(false);
  setDescDrawer?.(false);
  setNewsDrawer?.(false);
  setMapPostDrawer?.(false);
  setLegendDrawer?.(false);
  setHysplitDrawer?.(false);
  setAerscreenDrawer?.(false);
  setAreaStatsDrawer?.(false);

  // 2) AI Copilot Modal
  const aiModal = document.getElementById("AiCopilotModalOverlay");
  const aiToggleBtn = document.getElementById("AiCopilotToggle");
  if (aiModal) aiModal.style.display = "none";
  if (aiToggleBtn) aiToggleBtn.classList.remove("active");
}

// 맵뷰를 리셋
export function resetMapViewToDefault() {
  if (!map) return;

  const cfg = mapConfig || {};
  const target = {
    center: Array.isArray(cfg.center) ? cfg.center : [-98.5, 39.8],
    zoom: numOr(cfg.zoom, 3.5),
    bearing: numOr(cfg.bearing, 0),
    pitch: numOr(cfg.pitch, 0)
  };

  const padding = { top: 0, bottom: 0, left: 0, right: 0 };
  if (window.innerWidth > 1024 && document.body.classList.contains("FigurePage-drawer-open")) {
    const drawer = document.getElementById("FigurePageDrawer");
    const sidebarWidth = drawer ? drawer.getBoundingClientRect().width : (window.innerWidth * 0.4);
    padding.left = sidebarWidth + 50;
  }

  try {
    map.easeTo({
      ...target,
      padding,
      duration: 500
    });
  } catch (e) {
    map.jumpTo({
      ...target,
      padding
    });
  }
}

export function resetAccordionDetails() {
  document.querySelectorAll(".accordion details").forEach(el => {
    if (el.hasAttribute("open")) el.removeAttribute("open");
  });
}

export class resetViewControl {
  onAdd(map) {
    this._map = map;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "maplibregl-ctrl-icon";
    btn.setAttribute("aria-label", "Reset view");
    btn.title = "Reset view";
    btn.textContent = "↺";
    btn.addEventListener("click", () => resetMapViewToDefault());

    const container = document.createElement("div");
    container.className = "maplibregl-ctrl maplibregl-ctrl-group";
    container.appendChild(btn);
    this._container = container;
    return container;
  }

  onRemove() {
    this._container?.parentNode?.removeChild(this._container);
    this._map = undefined;
  }
}

