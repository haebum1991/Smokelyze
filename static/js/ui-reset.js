
import { DATA_IMPORT_METHOD } from "./layers-def.js";
import { map, mapConfig } from "./map-init.js";
import { applyLayerToggles } from "./layers-handler.js";
import { EMPTY_FC } from "./layers-constants.js";
import { activeLayerStack } from "./layers-state.js";
import { clearAll, resetGlobalStateShading, resetGlobalPointLayers, resetGlobalNaShading } from "./ui-state.js";
import { clearHighlight } from "./utils.js";
import { resetLoadedSources } from "./loader.js";
import { resetState as resetBarLine } from "./stats-plot-dy-barline.js";
import { resetState as resetParCoords } from "./stats-plot-dy-parcoords.js";
import { resetState as resetScatter } from "./stats-plot-dy-scatter.js";

function numOr(x, d) { return (typeof x === "number" && isFinite(x)) ? x : d; }

export function resetUIAndData() {
  // 1) Clear states
  clearAll?.();
  clearHighlight?.();
  resetGlobalStateShading?.();
  resetGlobalPointLayers?.();
  resetGlobalNaShading?.();
  
  // 2) Reset Loader cache
  resetLoadedSources?.();

  // 3) Clear plot drill-down states
  resetBarLine?.();
  resetParCoords?.();
  resetScatter?.();

  // 4) Clear checkboxes and data
  const ds = DATA_IMPORT_METHOD || {};
  const EMPTY = EMPTY_FC;

  document.querySelectorAll('input[type="checkbox"][id^="layer-"]').forEach(cb => {
    if (cb.checked) {
      cb.checked = false;
      cb.dispatchEvent(new Event("change"));
    }
  });

  const definedSources = new Set();
  Object.values(ds).forEach(d => {
    if (d.source) definedSources.add(d.source);
  });

  definedSources.forEach(srcId => {
    map?.getSource(srcId)?.setData(EMPTY);
  });

  // 5) Visibility consistency
  applyLayerToggles?.();
  if (activeLayerStack) activeLayerStack.length = 0;

  const searchWrapper = document.getElementById("SiteSearchWrapperPublished");
  if (searchWrapper) searchWrapper.style.display = "none";
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

