
export const APP_DATA_VERSION = "utils-20260814"; // R에서 자동으로 생성된 버전

import { map } from "./map-init.js";
import { state } from "./ui-state.js";
import { generatePopupHTML } from "./layers-tooltip.js";
import { auth } from "./fb-init.js";
import { loadedGeoJSON, loadedSources } from "./loader-state.js";
import { DATA_IMPORT_METHOD, ExcludeLayerGroups } from "./layers-def.js";

export function getCacheBuster(isoDate) {
  const now = new Date();
  const targetDate = new Date(isoDate);
  const daysDiff = Math.floor((now - targetDate) / (24 * 60 * 60 * 1000));

  // 최근 7일치 데이터는 1시간마다 자동 갱신
  if (daysDiff <= 7) {
    return `?v=${Math.floor(Date.now() / 3600000)}`;
  }
  
  // 과거 데이터는 APP_DATA_VERSION 변경 시 전 세계 강제 새로고침
  return `?v=${APP_DATA_VERSION}`;
}

export let onSetNewsDrawer = null;
export function setOnSetNewsDrawer(fn) { onSetNewsDrawer = fn; }

export let onSetStatsDrawer = null;
export function setOnSetStatsDrawer(fn) { onSetStatsDrawer = fn; }

export let onSetDescDrawer = null;
export function setOnSetDescDrawer(fn) { onSetDescDrawer = fn; }

export let onSetMapPostDrawer = null;
export function setOnSetMapPostDrawer(fn) { onSetMapPostDrawer = fn; }

export let onSetHysplitDrawer = null;
export function setOnSetHysplitDrawer(fn) { onSetHysplitDrawer = fn; }

export let onSetAccordionCollapsed = null;
export function setOnSetAccordionCollapsed(fn) { onSetAccordionCollapsed = fn; }

function triggerDrawerClose() {
  if (onSetNewsDrawer) onSetNewsDrawer(false);
  if (onSetStatsDrawer) onSetStatsDrawer(false);
  if (onSetDescDrawer) onSetDescDrawer(false);
  if (onSetMapPostDrawer) onSetMapPostDrawer(false);
  if (onSetHysplitDrawer) onSetHysplitDrawer(false);
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

export function pad2(n) { return n < 10 ? `0${n}` : String(n); }

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

export function getEffectiveDataset(isoDate) {
  const el = document.getElementById("MapDataSelect");
  let val = el ? el.value : "";
  if (!isoDate) {
    isoDate = currentDate();
  }
  if (isoDate) {
    const year = parseInt(isoDate.split("-")[0], 10);
    if (year >= 2019 && year <= 2024) {
      if (val === "gam-v2-pred") {
        return "gam-v2";
      } else if (val === "pm-cbsa-pred") {
        return "pm-cbsa";
      }
    }
  }
  return val;
}

// Data 추가시 로직 추가 필요 부분**
// url generator for gzfile (published data)
export function urlByDateGZfile(ds, isoDate) {

  const cb = getCacheBuster(isoDate);

  if (["wildfire_inci_curr", "wildfire_peri_curr"].includes(ds?.source)) {
    return `${ds.gzfileBaseUrlDate}/${ds.source}/${ds.prefix}latest.geojson.gz${cb}`;
  }
  
  if (["airfuse_pm25", "airfuse_o3"].includes(ds?.source)) {
    const prod = ds.source === "airfuse_pm25" ? "pm25" : "o3";
    const timeVal = parseInt(document.getElementById("timePicker")?.value || "12", 10);
    const localHour = isNaN(timeVal) ? 12 : timeVal;
    const [y, m, day] = (isoDate || "").split("-").map(Number);
    if (!y || !m || !day) return null;
    const localDate = new Date(y, m - 1, day, localHour);
    const uYear = localDate.getUTCFullYear();
    const uMonth = pad2(localDate.getUTCMonth() + 1);
    const uDay = pad2(localDate.getUTCDate());
    const utcHour = pad2(localDate.getUTCHours());
    const utcIsoDate = `${uYear}-${uMonth}-${uDay}`;
    return `${ds.gzfileBaseUrlDate}/${prod}/${uYear}/${uMonth}/${uDay}/AirFuse_${prod.toUpperCase()}_${utcIsoDate}_${utcHour}T.geojson.gz${cb}`;
  }
  
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return null;
  const yyyy = d.getUTCFullYear();
  const mm = pad2(d.getUTCMonth() + 1);
  const dd = pad2(d.getUTCDate());

  if (["smoke", "fire", "airnow_daily", "airnow_hourly"].includes(ds.source)) {
    // /gzfileBaseUrlDate/YYYY/PREFIX_YYYY-MM-DD.geojson
    return `${ds.gzfileBaseUrlDate}/${yyyy}/${ds.prefix}${yyyy}-${mm}-${dd}.geojson.gz${cb}`;
  } else if (["wildfire_news", "wildfire_inci", "wildfire_peri"].includes(ds.source)) {
    // /gzfileBaseUrlDate/source/YYYY/PREFIX_YYYY-MM-DD.geojson.gz
    return `${ds.gzfileBaseUrlDate}/${ds.source}/${yyyy}/${ds.prefix}${yyyy}-${mm}-${dd}.geojson.gz${cb}`;
  } else {
    // /gzfileBaseUrlDate/source/PREFIX_YYYY-MM-DD.geojson.gz
    return `${ds.gzfileBaseUrlDate}/${ds.source}/${yyyy}/${ds.prefix}${yyyy}-${mm}-${dd}.geojson.gz${cb}`;
  }
}

// url generator for geojson (daily)
export function urlByDateGeo(ds, isoDate) {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return null;
  const yyyy = d.getUTCFullYear();
  const mm = pad2(d.getUTCMonth() + 1);
  const dd = pad2(d.getUTCDate());

  // /geoBaseUrlDate/YYYY/PREFIX_YYYY-MM-DD.geojson
  return `${ds.geoBaseUrlDate}/${yyyy}/${ds.prefix}${yyyy}-${mm}-${dd}.geojson${getCacheBuster(isoDate)}`;
}

// url generator for json (daily)
export function urlByDateJson(ds, isoDate) {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return null;
  const yyyy = d.getUTCFullYear();
  const mm = pad2(d.getUTCMonth() + 1);
  const dd = pad2(d.getUTCDate());

  // /statsBaseUrlDate/YYYY/PREFIX_YYYY-MM-DD.json
  return `${ds.statsBaseUrlDate}/${yyyy}/${ds.prefix}${yyyy}-${mm}-${dd}.json${getCacheBuster(isoDate)}`;
}

// url generator for json (yearly)
export function urlByYearJson(ds, isoDate) {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return null;
  const yyyy = d.getUTCFullYear();

  // /statsBaseUrlYear/PREFIX_YYYY.json
  return `${ds.statsBaseUrlYear}/${ds.prefix}${yyyy}.json${getCacheBuster(isoDate)}`;
}

// url generator for png of TEMPO
export function urlPngTempo(isoDate, hour, productId) {
  const [y, m, d] = isoDate.split("-");
  const formattedHour = String(hour).padStart(2, "0");
  const folder = `/tempo_date_png/${productId}/${y}/${m}/${d}`;
  const baseName = `${productId}_${isoDate}_${formattedHour}T`;

  return {
    jsonUrl: `${folder}/${baseName}.json`,
    pngUrl: `${folder}/${baseName}.png`
  };
}

// url generator for png of TROPOMI
export function urlPngTropomi(isoDate, productId) {
  const [y] = isoDate.split("-");
  const folder = `/tropomi_date_png/${productId}/${y}`;
  const baseName = `${productId}_${isoDate}`;

  return {
    jsonUrl: `${folder}/${baseName}.json`,
    pngUrl: `${folder}/${baseName}.png`
  };
}

// url generator for png of HRRR
export function urlPngHRRR(isoDate, hour, productId) {
  const [y, m, d] = isoDate.split("-");
  const formattedHour = String(hour).padStart(2, "0");
  const folder = `/hrrr_date_png/${productId}/${y}/${m}/${d}`;
  const baseName = `${productId}_${isoDate}_${formattedHour}T`;

  return {
    jsonUrl: `${folder}/${baseName}.json`,
    pngUrl: `${folder}/${baseName}.png`
  };
}

// url generator for png of GOES AOD / GeoColor
export function urlPngGOES(isoDate, hour, productId) {
  const [y, m, d] = isoDate.split("-");
  const formattedHour = String(hour).padStart(2, "0");
  const folder = `/goes_date_png/${productId}/${y}/${m}/${d}`;
  const baseName = `${productId}_${isoDate}_${formattedHour}T`;
  const ext = productId.includes("GeoColor") ? "webp" : "png";

  return {
    jsonUrl: `${folder}/${baseName}.json`,
    pngUrl: `${folder}/${baseName}.${ext}`
  };
}

// url generator for VIIRS daily composites
export function urlPngVIIRS(isoDate, productId) {
  const [y] = isoDate.split("-");
  const folder = `/goes_date_png/${productId}/${y}`;
  const baseName = `${productId}_${isoDate}`;

  return {
    jsonUrl: `${folder}/${baseName}.json`,
    pngUrl: `${folder}/${baseName}.webp`
  };
}

// url generator for png of NASA GEOS-CF
export function urlPngGEOSCF(isoDate, hour, productId) {
  const [y, m, d] = isoDate.split("-");
  const formattedHour = String(hour).padStart(2, "0");
  const folder = `/geoscf_date_png/${productId}/${y}/${m}/${d}`;
  const baseName = `GEOS_CF_${productId}_${isoDate}_${formattedHour}T`;

  return {
    jsonUrl: `${folder}/${baseName}.json`,
    pngUrl: `${folder}/${baseName}.png`
  };
}

// Convert EPSG:3857 (Web Mercator meters) to EPSG:4326 (LngLat degrees)
export function mercatorToLngLat(x, y) {
  const lon = (x / 20037508.34) * 180;
  const lat = (Math.atan(Math.exp((y / 20037508.34) * Math.PI)) * 360 / Math.PI) - 90;
  return [lon, lat];
}


const NEGATIVE_CACHE_TTL = 15 * 60 * 1000; // 15 minutes
export const failedUrls = new Map();

export function isRecentlyFailed(url) {
  if (!failedUrls.has(url)) return false;
  if (Date.now() - failedUrls.get(url) < NEGATIVE_CACHE_TTL) return true;
  failedUrls.delete(url);
  return false;
}

export async function fetchJson(url, fallback) {
  if (isRecentlyFailed(url)) {
    return Promise.resolve(fallback);
  }

  const fetchOptions = {};
  if (auth?.currentUser) {
    try {
      const idToken = await auth.currentUser.getIdToken();
      fetchOptions.headers = {
        "Authorization": `Bearer ${idToken}`
      };
    } catch (tokenError) {
      console.warn("Could not get ID token for fetchJson:", tokenError);
    }
  }

  try {
    const res = await fetch(url, fetchOptions);
    if (!res.ok) {
      failedUrls.set(url, Date.now());
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.error("Error fetching", url, err);
    failedUrls.set(url, Date.now());
    return fallback;
  }
}

export function debounce(fn, wait) {
  let t;
  return function (...args) {
    clearTimeout(t);
    const ctx = this;
    t = setTimeout(() => fn.apply(ctx, args), wait);
  };
}

export function clearHighlight() {
  const mapLocal = map;
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

  const tooltip = document.getElementById("MapTooltip");
  if (tooltip) {
    tooltip.style.display = "none";
    tooltip.style.pointerEvents = "none";
  }

  // Clean up map listener
  if (state.mapClickListener) {
    if (mapLocal) mapLocal.off("click", state.mapClickListener);
    state.mapClickListener = null;
  }
  
  // Clear raster hover bounding box
  if (mapLocal?.getSource("raster-hover-box")) {
    mapLocal.getSource("raster-hover-box").setData({ type: "FeatureCollection", features: [] });
  }
}

export function refreshHighlight() {
  if (!state?.currentHighlight) return;
  if (!loadedGeoJSON) return;
  if (!state.tooltipLocked) return;

  const h = state.currentHighlight;
  
  if (ExcludeLayerGroups.pngLayers.includes(h.dataSource)) {
    return;
  }

  // Resolve actual data key (helpful for versioned data like AirNow)
  let actualDS = h.dataSource;
  const dsInfo = DATA_IMPORT_METHOD[h.dataSource];

  if (dsInfo?.duration === "hourly" && loadedSources?.[h.dataSource]) {
    actualDS = loadedSources[h.dataSource];
  }

  const geoData = loadedGeoJSON[actualDS];

  // If the target point dataset is still loading for the new date, wait and do NOT clear highlight
  if (!geoData?.features) {
    return;
  }

  const f1 = geoData.features;
  let match = null;

  // 1. Try ID match if available (Robust against tile quantization)
  if (h.idKey && h.idVal) {
    for (let i = 0; i < f1.length; i++) {
      const f2 = f1[i];
      if (f2.properties && f2.properties[h.idKey] === h.idVal) {
        match = f2;
        break;
      }
    }
  }

  // 2. Fallback to Coordinate match if no ID or ID match failed
  if (!match) {
    const [targetLon, targetLat] = h.coords;
    const epsilon = 0.0001; // ~11 meters

    for (let i = 0; i < f1.length; i++) {
      const f2 = f1[i];
      if (f2.geometry?.type === "Point") {
        const c = f2.geometry.coordinates;
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

    const tooltip = document.getElementById("MapTooltip");
    if (tooltip && generatePopupHTML) {
      tooltip.innerHTML = generatePopupHTML(match.properties, h.dataSource, state.tooltipLocked);
      tooltip.style.display = "block";
    }
  } else {
    // Only clear highlight if the dataset is confirmed loaded for the current date, but this specific point wasn't found
    const targetDate = document.getElementById("datePicker")?.value;
    if (loadedSources[actualDS] === targetDate) {
      clearHighlight();
    }
  }
}

export function highlightLocation(coords, p, dataSource, targetZoom = 8) {
  const mapLocal = map;
  if (!mapLocal) return;

  const currentZoom = mapLocal.getZoom();
  let inBounds = false;
  try {
    const point = mapLocal.project(coords);
    const canvas = mapLocal.getCanvas();
    const width = canvas.clientWidth || (canvas.width / (window.devicePixelRatio || 1));
    const height = canvas.clientHeight || (canvas.height / (window.devicePixelRatio || 1));
    const padX = width * 0.10; // 10% horizontal margin
    const padY = height * 0.10; // 10% vertical margin

    inBounds = (
      point.x >= padX &&
      point.x <= width - padX &&
      point.y >= padY &&
      point.y <= height - padY
    );
  } catch (e) {
    inBounds = false;
  }

  // Fly if the location is outside the central 80% viewport, OR if current zoom is less than targetZoom
  const shouldFly = !inBounds || (currentZoom < targetZoom);

  // Close drawers on mobile only when flying to a new location
  if (shouldFly && window.innerWidth <= 1024) {
    triggerDrawerClose();
  }

  if (p && coords) {
    p.lon = coords[0];
    p.lat = coords[1];
  }

  let idKey = null;
  let idVal = null;
  if (p) {
    if (p.AQS) { idKey = "AQS"; idVal = p.AQS; }
    else if (p.AQS_O3) { idKey = "AQS_O3"; idVal = p.AQS_O3; }
    else if (p.AQS_PM) { idKey = "AQS_PM"; idVal = p.AQS_PM; }
    else if (p.ID) { idKey = "ID"; idVal = p.ID; }
    else if (p.IrwinID || p.poly_IRWINID || p.attr_IRWINID) { idKey = p.IrwinID ? "IrwinID" : (p.poly_IRWINID ? "poly_IRWINID" : "attr_IRWINID"); idVal = p.IrwinID || p.poly_IRWINID || p.attr_IRWINID; }
    else if (p.poly_IncidentName || p.IncidentName) { idKey = p.poly_IncidentName ? "poly_IncidentName" : "IncidentName"; idVal = p.poly_IncidentName || p.IncidentName; }
    else if (p.attr_UniqueFireIdentifier || p.UniqueFireIdentifier) { idKey = p.attr_UniqueFireIdentifier ? "attr_UniqueFireIdentifier" : "UniqueFireIdentifier"; idVal = p.attr_UniqueFireIdentifier || p.UniqueFireIdentifier; }
    else if (p.site_name) { idKey = "site_name"; idVal = p.site_name; }
    else if (p.link) { idKey = "link"; idVal = p.link; }
    else if (p.docId) { idKey = "docId"; idVal = p.docId; }
  }

  state.currentHighlight = {
    coords,
    dataSource,
    dsKey: null,
    idKey,
    idVal
  };

  if (shouldFly) {
    // If moving to an off-screen target while already zoomed in, retain current high zoom level
    const zoomToUse = inBounds ? targetZoom : Math.max(currentZoom, targetZoom);

    const flyOptions = {
      center: coords,
      zoom: zoomToUse,
      essential: true,
      speed: 2.4,
      curve: 1.0
    };

    if (window.innerWidth <= 1024) {
      flyOptions.padding = { top: 325, bottom: 0, left: 200, right: 0 };
    } else {
      if (document.body.classList.contains("FigurePage-drawer-open")) {
        const drawer = document.getElementById("FigurePageDrawer");
        const sidebarWidth = drawer ? drawer.getBoundingClientRect().width : (window.innerWidth * 0.4);
        flyOptions.padding = { top: 0, bottom: 0, left: sidebarWidth + 50, right: 0 };
      } else {
        flyOptions.padding = { top: 0, bottom: 0, left: 250, right: 0 };
      }
    }

    mapLocal.flyTo(flyOptions);
  }

  // Clear any existing highlight first
  clearHighlight();

  if (window.maplibregl?.Marker) {
    const marker = new window.maplibregl.Marker()
      .setLngLat(coords)
      .addTo(mapLocal);

    const markerEl = marker.getElement();
    markerEl.style.cursor = "pointer";
    markerEl.insertAdjacentHTML("beforeend", `
      <button class="marker-context-btn" 
              title="Quick Actions" 
              style="position:absolute; 
                     top:-1.5rem; 
                     right:-1.5rem; 
                     width:2.5rem; 
                     height:2.5rem; 
                     border-radius:50%; 
                     background:var(--card-shadow); 
                     color:var(--color-bg); 
                     border:0.1rem solid var(--color-bg); 
                     font-size:2rem; 
                     display:flex; 
                     align-items:center; 
                     justify-content:center; 
                     cursor:pointer; 
                     padding:0; 
                     z-index:5;">
        +
      </button>
    `);

    const btn = markerEl.querySelector(".marker-context-btn");
    if (btn) {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const lngLat = new window.maplibregl.LngLat(coords[0], coords[1]);
        const point = mapLocal.project(coords);
        const rect = mapLocal.getCanvas().getBoundingClientRect();

        mapLocal.fire("contextmenu", {
          lngLat: lngLat,
          point: point,
          preventDefault: () => { },
          defaultPrevented: false,
          originalEvent: {
            clientX: rect.left + point.x + 15,
            clientY: rect.top + point.y - 15,
            preventDefault: () => { }
          }
        });
      });
    }

    markerEl.addEventListener("click", (e) => {
      e.stopPropagation();
      clearHighlight();
    });

    state.existingMarker = marker;

    // [Added] Reuse Global Tooltip (Freeze/Lock)
    if (p && dataSource && generatePopupHTML) {
      const tooltip = document.getElementById("MapTooltip");
      if (tooltip) {
        state.tooltipLocked = true;
        tooltip.style.pointerEvents = "auto";
        tooltip.innerHTML = generatePopupHTML(p, dataSource, true);
        tooltip.style.display = "block";

        // Sync position function
        const syncTooltip = function () {
          const point = mapLocal.project(coords);
          const canvas = mapLocal.getCanvas();
          const rect = canvas.getBoundingClientRect();

          let x = rect.left + point.x + 15; // Offset 1.5rem right
          let y = rect.top + point.y + 15;  // Offset 1.5rem down

          if (x + 320 > window.innerWidth) x = rect.left + point.x - 330;
          if (y + 400 > window.innerHeight) y = rect.top + point.y - 410;

          tooltip.style.left = `${x / 10}rem`;
          tooltip.style.top = `${y / 10}rem`;
        };

        // Initial position update
        syncTooltip();

        // Bind sync listener
        state.tooltipSyncListener = syncTooltip;
        mapLocal.on("move", state.tooltipSyncListener);
        mapLocal.on("moveend", state.tooltipSyncListener);
      }
    }

    state.mapClickListener = (e) => {
      if (e.defaultPrevented) return;
      clearHighlight();
    };

    mapLocal.on("click", state.mapClickListener);
  }
}

export function ESML(str) {
  // if (!str) return "";
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Global Unified Formatter for tabular cells, popups, and tooltips.
 * Safely unwraps nested objects, removes [object Object], and cleans null/undefined/empty values for UI display.
 */
export function sanitizeDisplayValue(v, fallback = "-", suffix = "") {
  if (v === undefined || v === null) return fallback;
  if (typeof v === "object") {
    if (Array.isArray(v)) return v.length ? v.join(", ") + suffix : fallback;
    if (v.value !== undefined && v.value !== null) v = v.value;
    else if (v.name !== undefined && v.name !== null) v = v.name;
    else if (v.label !== undefined && v.label !== null) v = v.label;
    else if (v.text !== undefined && v.text !== null) v = v.text;
    else {
      const keys = Object.keys(v);
      if (keys.length === 0) return fallback;
      v = JSON.stringify(v);
    }
  }
  let s = String(v).trim();
  if (s === "" || s === "{}" || s === "{ }" || s === "[object Object]" || s.toUpperCase() === "NA") return fallback;

  return s + suffix;
}

