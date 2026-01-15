
import { map } from "./map-init.js";
import { state } from "./ui-state.js";
import { generatePopupHTML } from "./layers-tooltip.js";
import { loadedGeoJSON, loadedSources } from "./loader-state.js";
import { DATA_IMPORT_METHOD } from "./layers-def.js";

function getCacheBuster(isoDate) {
  var now = new Date();
  var y = now.getFullYear();
  var m = pad2(now.getMonth() + 1);
  var d = pad2(now.getDate());
  var today = y + "-" + m + "-" + d;

  if (isoDate === today) {
    return "?v=" + Math.floor(Date.now() / 3600000);
  }
  return "";
}

export let onSetNewsDrawer = null;
export function setOnSetNewsDrawer(fn) { onSetNewsDrawer = fn; }

export let onSetStatsDrawer = null;
export function setOnSetStatsDrawer(fn) { onSetStatsDrawer = fn; }

export let onSetDescDrawer = null;
export function setOnSetDescDrawer(fn) { onSetDescDrawer = fn; }

export let onSetMapPostDrawer = null;
export function setOnSetMapPostDrawer(fn) { onSetMapPostDrawer = fn; }

export let onSetAccordionCollapsed = null;
export function setOnSetAccordionCollapsed(fn) { onSetAccordionCollapsed = fn; }

function triggerDrawerClose() {
  if (onSetNewsDrawer) onSetNewsDrawer(false);
  if (onSetStatsDrawer) onSetStatsDrawer(false);
  if (onSetDescDrawer) onSetDescDrawer(false);
  if (onSetMapPostDrawer) onSetMapPostDrawer(false);
  if (onSetAccordionCollapsed) onSetAccordionCollapsed(true);
}

/**
 * AuthOverlay를 표시하는 유틸리티 함수
 * 사용자 이벤트 핸들러 내에서 호출해야 팝업 블록을 피할 수 있음
 */
export function showAuthOverlay() {
  const authOverlay = document.getElementById("AuthOverlay");
  if (authOverlay && authOverlay.style.display === "none") {
    authOverlay.style.display = "flex";
  }
}

export function pad2(n) { return (n < 10 ? "0" + n : String(n)); }

export function formatDate(d) {
  if (!d || isNaN(d.getTime())) return "NA";
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const min = pad2(d.getMinutes());
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

// get date from datePicker
export function currentDate() {
  const el = document.getElementById("datePicker");
  if (el && el.value) return el.value;

  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Data 추가시 로직 추가 필요 부분**
// url generator for gzfile (published data)
export function urlByDateGZfile(ds, isoDate) {
  var d = new Date(isoDate);
  if (isNaN(d.getTime())) return null;
  var yyyy = d.getUTCFullYear();
  var mm = pad2(d.getUTCMonth() + 1);
  var dd = pad2(d.getUTCDate());

  var cb = getCacheBuster(isoDate);
  if (["smoke", "fire"].includes(ds.source)) {
    // /gzfileBaseUrlDate/YYYY/PREFIX_YYYY-MM-DD.geojson
    return ds.gzfileBaseUrlDate + "/" + yyyy + "/" + ds.prefix + yyyy + "-" + mm + "-" + dd + ".geojson.gz" + cb;
  } else if (["wildfire_news", "wildfire_nifc"].includes(ds.source)) {
    // /gzfileBaseUrlDate/source/YYYY/PREFIX_YYYY-MM-DD.geojson.gz
    return ds.gzfileBaseUrlDate + "/" + ds.source + "/" + yyyy + "/" + ds.prefix + yyyy + "-" + mm + "-" + dd + ".geojson.gz" + cb;
  } else {
    // /gzfileBaseUrlDate/source/PREFIX_YYYY-MM-DD.geojson.gz
    return ds.gzfileBaseUrlDate + "/" + ds.source + "/" + ds.prefix + yyyy + "-" + mm + "-" + dd + ".geojson.gz" + cb;
  }
}

// url generator for geojson (daily)
export function urlByDateGeo(ds, isoDate) {
  var d = new Date(isoDate);
  if (isNaN(d.getTime())) return null;
  var yyyy = d.getUTCFullYear();
  var mm = pad2(d.getUTCMonth() + 1);
  var dd = pad2(d.getUTCDate());

  // /geoBaseUrlDate/YYYY/PREFIX_YYYY-MM-DD.geojson
  return ds.geoBaseUrlDate + "/" + yyyy + "/" + ds.prefix + yyyy + "-" + mm + "-" + dd + ".geojson" + getCacheBuster(isoDate);
}

// url generator for json (daily)
export function urlByDateJson(ds, isoDate) {
  var d = new Date(isoDate);
  if (isNaN(d.getTime())) return null;
  var yyyy = d.getUTCFullYear();
  var mm = pad2(d.getUTCMonth() + 1);
  var dd = pad2(d.getUTCDate());

  // /statsBaseUrlDate/YYYY/PREFIX_YYYY-MM-DD.json
  return ds.statsBaseUrlDate + "/" + yyyy + "/" + ds.prefix + yyyy + "-" + mm + "-" + dd + ".json" + getCacheBuster(isoDate);
}

// url generator for json (yearly)
export function urlByYearJson(ds, isoDate) {
  var d = new Date(isoDate);
  if (isNaN(d.getTime())) return null;
  var yyyy = d.getUTCFullYear();

  // /statsBaseUrlYear/PREFIX_YYYY.json
  return ds.statsBaseUrlYear + "/" + ds.prefix + yyyy + ".json";
}

const NEGATIVE_CACHE_TTL = 15 * 60 * 1000; // 15 minutes
export const failedUrls = new Map();

export function isRecentlyFailed(url) {
  if (!failedUrls.has(url)) return false;
  if (Date.now() - failedUrls.get(url) < NEGATIVE_CACHE_TTL) return true;
  failedUrls.delete(url);
  return false;
}

export function fetchJson(url, fallback) {
  if (isRecentlyFailed(url)) {
    return Promise.resolve(fallback);
  }
  return fetch(url)
    .then(function (res) {
      if (!res.ok) {
        failedUrls.set(url, Date.now());
        throw new Error("HTTP " + res.status);
      }
      return res.json();
    })
    .catch(function (err) {
      console.error("Error fetching", url, err);
      failedUrls.set(url, Date.now());
      return fallback;
    });
}

export function debounce(fn, wait) {
  var t;
  return function () {
    clearTimeout(t);
    var ctx = this, args = arguments;
    t = setTimeout(function () { fn.apply(ctx, args); }, wait);
  };
}

export function clearHighlight() {
  var mapLocal = map;
  if (!mapLocal) return;


  // Remove marker
  if (state.existingMarker) {
    state.existingMarker.remove();
    state.existingMarker = null;
  }

  // Unlock and hide tooltip
  if (state.tooltipSyncListener) {
    mapLocal.off("move", state.tooltipSyncListener);
    mapLocal.off("moveend", state.tooltipSyncListener);
    state.tooltipSyncListener = null;
  }
  state.tooltipLocked = false;

  var tooltip = document.getElementById("MapTooltip");
  if (tooltip) {
    tooltip.style.display = "none";
    tooltip.style.pointerEvents = "none";
  }

  // Clean up map listener
  if (state.mapClickListener) {
    if (mapLocal) mapLocal.off("click", state.mapClickListener);
    state.mapClickListener = null;
  }
}

export function refreshHighlight() {
  if (!state || !state.currentHighlight) return;
  if (!loadedGeoJSON) return;
  if (!state.tooltipLocked) return;

  var h = state.currentHighlight;

  // Resolve actual data key (helpful for versioned data like AirNow)
  var actualDS = h.dataSource;
  var dsInfo = DATA_IMPORT_METHOD[h.dataSource];
  
  if (dsInfo && dsInfo.duration === "hourly" && loadedSources && loadedSources[h.dataSource]) {
    actualDS = loadedSources[h.dataSource];
  }

  var geoData = loadedGeoJSON[actualDS];
  
  if (!geoData || !geoData.features) {
    clearHighlight();
    return;
  }

  var f1 = geoData.features;
  var match = null;

  // 1. Try ID match if available (Robust against tile quantization)
  if (h.idKey && h.idVal) {
    for (var i = 0; i < f1.length; i++) {
      var f2 = f1[i];
      if (f2.properties && f2.properties[h.idKey] === h.idVal) {
        match = f2;
        break;
      }
    }
  }

  // 2. Fallback to Coordinate match if no ID or ID match failed
  if (!match) {
    var targetLon = h.coords[0];
    var targetLat = h.coords[1];
    var epsilon = 0.0001; // ~11 meters

    for (var i = 0; i < f1.length; i++) {
      var f2 = f1[i];
      if (f2.geometry && f2.geometry.type === "Point") {
        var c = f2.geometry.coordinates;
        if (Math.abs(c[0] - targetLon) < epsilon && Math.abs(c[1] - targetLat) < epsilon) {
          match = f2;
          break;
        }
      }
    }
  }

  if (match) {
    // Ensure lon/lat are present in properties for display
    match.properties.lon = match.geometry.coordinates[0];
    match.properties.lat = match.geometry.coordinates[1];

    var tooltip = document.getElementById("MapTooltip");
    if (tooltip && generatePopupHTML) {
      tooltip.innerHTML = generatePopupHTML(match.properties, h.dataSource, state.tooltipLocked);
    }
  } else {
    clearHighlight();
  }
}

export function highlightLocation(coords, p, dataSource) {
  var mapLocal = map;
  if (!mapLocal) return;

  // Close drawers on mobile
  if (window.innerWidth <= 1024) {
    triggerDrawerClose();
  }

  if (p && coords) {
    p.lon = coords[0];
    p.lat = coords[1];
  }

  var idKey = null;
  var idVal = null;
  if (p) {
    if (p.AQS) { idKey = "AQS"; idVal = p.AQS; }
    else if (p.AQS_O3) { idKey = "AQS_O3"; idVal = p.AQS_O3; }
    else if (p.AQS_PM) { idKey = "AQS_PM"; idVal = p.AQS_PM; }
    else if (p.ID) { idKey = "ID"; idVal = p.ID; }
    else if (p.site_name) { idKey = "site_name"; idVal = p.site_name; }
    else if (p.link) { idKey = "link"; idVal = p.link; }
    else if (p.docId) { idKey = "docId"; idVal = p.docId; }
  }

  state.currentHighlight = {
    coords: coords,
    dataSource: dataSource,
    dsKey: null,
    idKey: idKey,
    idVal: idVal
  };

  var flyOptions = {
    center: coords,
    zoom: 8,
    essential: true,
    speed: 2.4,
    curve: 1.0
  };


  if (window.innerWidth <= 1024) {
    flyOptions.padding = { top: 325, bottom: 0, left: 200, right: 0 };
  } else {
    if (document.body.classList.contains("FigurePage-drawer-open")) {
      var drawer = document.getElementById("FigurePageDrawer");
      var sidebarWidth = drawer ? drawer.getBoundingClientRect().width : (window.innerWidth * 0.4);
      flyOptions.padding = { top: 0, bottom: 0, left: sidebarWidth + 50, right: 0 };
    } else {
      flyOptions.padding = { top: 0, bottom: 0, left: 250, right: 0 };
    }
  }

  mapLocal.flyTo(flyOptions);

  // Clear any existing highlight first
  clearHighlight();

  if (window.maplibregl && window.maplibregl.Marker) {
    var marker = new window.maplibregl.Marker()
      .setLngLat(coords)
      .addTo(mapLocal);

    // Allow clicking the marker itself to clear selection
    marker.getElement().addEventListener("click", function (e) {
      e.stopPropagation(); // Prevent map click
      clearHighlight();
    });

    state.existingMarker = marker;

    // [Added] Reuse Global Tooltip (Freeze/Lock)
    if (p && dataSource && generatePopupHTML) {
      var tooltip = document.getElementById("MapTooltip");
      if (tooltip) {
        state.tooltipLocked = true;
        tooltip.style.pointerEvents = "auto";
        tooltip.innerHTML = generatePopupHTML(p, dataSource, true);
        tooltip.style.display = "block";

        // Sync position function
        var syncTooltip = function () {
          var point = mapLocal.project(coords);
          var canvas = mapLocal.getCanvas();
          var rect = canvas.getBoundingClientRect();

          var x = rect.left + point.x + 15; // Offset 1.5rem right
          var y = rect.top + point.y + 15;  // Offset 1.5rem down

          if (x + 320 > window.innerWidth) x = rect.left + point.x - 330;
          if (y + 400 > window.innerHeight) y = rect.top + point.y - 410;

          tooltip.style.left = (x / 10) + "rem";
          tooltip.style.top = (y / 10) + "rem";
        };

        // Initial position update
        syncTooltip();

        // Bind sync listener
        state.tooltipSyncListener = syncTooltip;
        mapLocal.on("move", state.tooltipSyncListener);
        mapLocal.on("moveend", state.tooltipSyncListener);
      }
    }

    state.mapClickListener = function (e) {
      if (e.defaultPrevented) return;
      clearHighlight();
    };

    mapLocal.on("click", state.mapClickListener);
  }
}

export function ESML(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

