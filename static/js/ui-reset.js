
import { DATA_IMPORT_METHOD } from "./layers-def.js";
import { map, mapConfig } from "./map-init.js";
import { applyLayerToggles } from "./layers-handler.js";
import { EMPTY_FC } from "./layers-constants.js";
import { activeLayerStack } from "./layers-state.js";
import { clearAll, resetGlobalStateColor } from "./ui-state.js";
import { clearHighlight } from "./utils.js";
import { resetLoadedSources } from "./loader.js";
import { resetState as resetBarLine } from "./stats-plot-dy-barline.js";
import { resetState as resetParCoords } from "./stats-plot-dy-parcoords.js";
import { resetState as resetScatter } from "./stats-plot-dy-scatter.js";

function numOr(x, d) { return (typeof x === "number" && isFinite(x)) ? x : d; }

export function resetUIAndData() {
  // 1) 상태 저장소 삭제
  if (clearAll) clearAll();
  if (clearHighlight) clearHighlight();
  if (resetGlobalStateColor) resetGlobalStateColor();
  
  // 2) ★ Loader의 캐시(기록)를 초기화 (이게 없으면 재로딩 안됨)
  if (resetLoadedSources) {
    resetLoadedSources();
  }

  // [Added] Clear plot drill-down states
  if (resetBarLine) resetBarLine();
  if (resetParCoords) resetParCoords();
  if (resetScatter) resetScatter();

  // 3) 체크박스 전부 끄기 + 데이터 비우기
  const ds = DATA_IMPORT_METHOD || {};
  const EMPTY = EMPTY_FC;

  // 모든 체크박스 끄기
  document.querySelectorAll('input[type="checkbox"][id^="layer-"]').forEach(cb => {
    if (cb.checked) {
      cb.checked = false;
      cb.dispatchEvent(new Event("change"));
    }
  });

  // 모든 소스 데이터 비우기 (확실하게)
  const definedSources = new Set();
  Object.values(ds).forEach(d => {
    if (d.source) definedSources.add(d.source);
  });

  definedSources.forEach(srcId => {
    if (map && map.getSource(srcId) && EMPTY) {
      map.getSource(srcId).setData(EMPTY);
    }
  });

  // 4) 가시성도 OFF로 일관화
  if (applyLayerToggles) applyLayerToggles();
  if (activeLayerStack) activeLayerStack.length = 0;

  var searchWrapper = document.getElementById("SiteSearchWrapper");
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

  var padding = { top: 0, bottom: 0, left: 0, right: 0 };
  if (window.innerWidth > 1024 && document.body.classList.contains("FigurePage-drawer-open")) {
    var drawer = document.getElementById("FigurePageDrawer");
    var sidebarWidth = drawer ? drawer.getBoundingClientRect().width : (window.innerWidth * 0.4);
    padding.left = sidebarWidth + 50;
  }

  try {
    map.easeTo({
      center: target.center,
      zoom: target.zoom,
      bearing: target.bearing,
      pitch: target.pitch,
      padding: padding,
      duration: 500
    });
  } catch (e) {
    map.jumpTo({
      center: target.center,
      zoom: target.zoom,
      bearing: target.bearing,
      pitch: target.pitch,
      padding: padding
    });
  }
}

export function resetAccordionDetails() {
  var details = document.querySelectorAll(".accordion details");
  details.forEach(function (el) {
    if (el.hasAttribute("open")) {
      el.removeAttribute("open");
    }
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

    btn.addEventListener("click", () => {
      resetMapViewToDefault();
    });

    const container = document.createElement("div");
    container.className = "maplibregl-ctrl maplibregl-ctrl-group";
    container.appendChild(btn);
    this._container = container;
    return container;
  }

  onRemove() {
    if (this._container?.parentNode) this._container.parentNode.removeChild(this._container);
    this._map = undefined;
  }
}

