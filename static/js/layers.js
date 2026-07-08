
/**
 * 레이어 통합 컨트롤러: 레이어 모듈들을 종합하여 초기화하고, 위치 검색 및 레이어 관련 유틸리티 기능을 제공
 */
import { clearHighlight, highlightLocation } from "./utils.js";
import { restoreView, bindViewAutosave } from "./ui-state.js";
import { getLoadedNewsFeatures } from "./loader.js";
import { iconPulsingNews, iconPulsingFire, iconPulsingAlert } from "./layers-icon.js";
import { initGlobalTooltip, stateHoverHTML } from "./layers-tooltip.js";
import { updateLayerToggleColors, updateStateShading } from "./layers-colors.js";
import { ensureLayers, applyLayerToggles, getAllInteractiveLayerIds } from "./layers-handler.js";
import { map, _cachedActiveLayerIds } from "./layers-state.js";
import { logUserAction } from "./fb-logging.js";

initGlobalTooltip();

if (restoreView) restoreView(map);
if (bindViewAutosave) bindViewAutosave(map);

// [Added] Current Location (Geolocate) Control
export const geolocate = (typeof maplibregl !== "undefined") ? new maplibregl.GeolocateControl({
  positionOptions: {
    enableHighAccuracy: true
  },
  trackUserLocation: true,
  showUserHeading: true,
  fitBoundsOptions: {
    maxZoom: 9
  }
}) : null;

// [Added] Map Coordinate Display
(() => {
  const mapContainer = document.getElementById("map");
  if (!mapContainer) return;

  const coordsDiv = document.createElement("div");
  coordsDiv.id = "map-coordinate-display";
  mapContainer.appendChild(coordsDiv);

  if (map) {
    map.on("mousemove", (e) => {
      coordsDiv.style.display = "block";
      coordsDiv.innerText = `Lat: ${e.lngLat.lat.toFixed(3)}
Lon: ${e.lngLat.lng.toFixed(3)}`;
    });

    map.on("mouseout", () => {
      coordsDiv.style.display = "none";
    });
  }
})();

if (map) {
  const onMapLoad = () => {
    // Register functional pulsing symbols
    if (iconPulsingNews) {
      map.addImage("pulsing-news", iconPulsingNews(map, 60));
    }
    if (iconPulsingFire) {
      map.addImage("pulsing-fire", iconPulsingFire(map, 60));
    }
    if (iconPulsingAlert) {
      map.addImage("pulsing-alert", iconPulsingAlert(map, 60));
    }

    if (!map.getSource("states-source")) {
      map.addSource("states-source", {
        type: "geojson",
        data: "/map_boundaries.geojson"
      });
    }

    if (!map.getLayer("states-fill")) {
      map.addLayer({
        id: "states-fill",
        type: "fill",
        source: "states-source",
        paint: {
          "fill-color": "#000000",
          "fill-opacity": 0
        }
      });
    }

    if (!map.getLayer("states-line")) {
      map.addLayer({
        id: "states-line",
        type: "line",
        source: "states-source",
        paint: {
          "line-color": "#ffffff",
          "line-width": 1
        }
      });
    }

    if (!map.getLayer("states-hover")) {
      map.addLayer({
        id: "states-hover",
        type: "line",
        source: "states-source",
        paint: {
          "line-color": "#ff0000",
          "line-width": 2,
          "line-opacity": 1
        },
        filter: ["==", ["get", "ID"], ""]
      });
    }

    const hoverPopup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false
    });

    map.on("mousemove", "states-fill", (e) => {
    
      if (window.isDrawActive?.()) {
        map.getCanvas().style.cursor = "";
        map.setFilter("states-hover", ["==", ["get", "ID"], ""]);
        hoverPopup.remove();
        return;
      }
      
      let allPriorityIds = getAllInteractiveLayerIds();
      allPriorityIds = allPriorityIds.filter(id => id !== "smoke-fill" && id !== "burn-fill" && map.getLayer(id));

      const f1 = map.queryRenderedFeatures(e.point, { layers: allPriorityIds });

      if (f1?.length > 0) {
        map.getCanvas().style.cursor = "pointer";
        map.setFilter("states-hover", ["==", ["get", "ID"], ""]);
        hoverPopup.remove();
        return;
      }

      map.getCanvas().style.cursor = "pointer";
      const f2 = e.features?.[0];
      if (!f2) return;

      const p = f2.properties || {};
      const { ID: id } = p;

      map.setFilter("states-hover", ["==", ["get", "ID"], id]);

      if (typeof stateHoverHTML === "function") {
        hoverPopup.setLngLat(e.lngLat).setHTML(stateHoverHTML(p, _cachedActiveLayerIds)).addTo(map);
      }
    });

    map.on("mouseleave", "states-fill", () => {
      map.getCanvas().style.cursor = "";
      map.setFilter("states-hover", ["==", ["get", "ID"], ""]);
      hoverPopup.remove();
    });

    ensureLayers();
    applyLayerToggles();
    addDayNightLayer();
  };

  if (map.loaded() || map.isStyleLoaded()) {
    onMapLoad();
  } else {
    map.once("style.load", onMapLoad);
  }

  // Event Delegation for Map Popups
  document.body.addEventListener("click", (e) => {
    const target = e.target;

    // Close Popup
    if (target.closest(".action-close-popup")) {
      e.stopPropagation();
      if (clearHighlight) {
        clearHighlight();
      }
      return;
    }

    // Read News
    const newsBtn = target.closest(".action-read-news");
    if (newsBtn) {
      e.stopPropagation();
      
      const url = newsBtn.getAttribute("data-link") || "";
      logUserAction("view", {
        dataset: "wildfire_news",
        layer: "news_read",
        filename: url.substring(0, 100)
      });
      
      if (url?.startsWith("http")) {
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        console.warn("Blocked potentially unsafe URL:", url);
        alert("Navigation blocked: Unsafe URL");
      }
      return;
    }

    // News Location
    const newsLocBtn = target.closest(".action-news-location");
    if (newsLocBtn) {
      e.stopPropagation();

      // Ensure the layer is ON before moving
      const toggle = document.getElementById("layer-wildfire-news");
      let toggleWasOff = false;
      if (toggle && !toggle.checked) {
        toggleWasOff = true;
        toggle.checked = true;
        // Trigger the change manually since we set .checked via JS
        toggle.dispatchEvent(new Event("change", { bubbles: true }));
      }

      const lon = parseFloat(newsLocBtn.getAttribute("data-lon"));
      const lat = parseFloat(newsLocBtn.getAttribute("data-lat"));
      const idx = parseInt(newsLocBtn.getAttribute("data-idx"));
      const feats = getLoadedNewsFeatures();
      const featTitle = feats?.[idx]?.properties?.title || "";

      logUserAction("view", {
        dataset: "wildfire_news",
        layer: "news_location",
        filename: featTitle.substring(0, 100)
      });

      if (toggleWasOff) {
        // Wait for the debounced updateAllActiveSources (300ms) to finish clearing the map
        setTimeout(() => {
          if (highlightLocation && feats) {
            highlightLocation([lon, lat], feats[idx].properties, "wildfire_news");
          }
        }, 300); // 300ms is safe for 300ms debounce
      } else {
        if (highlightLocation && feats) {
          highlightLocation([lon, lat], feats[idx].properties, "wildfire_news");
        }
      }
      return;
    }
  });
}

// Init colors on DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
  const dsSelect = document.getElementById("MapDataSelect");
  if (dsSelect) {
    dsSelect.addEventListener("change", () => {
      setTimeout(updateLayerToggleColors, 50);
      if (updateStateShading) setTimeout(updateStateShading, 100);
    });
  }
  setTimeout(updateLayerToggleColors, 100);
});

// --- Day/Night Terminator Calculations ---
function getSelectedAppDate() {
    const dp = document.getElementById("datePicker");
    const tp = document.getElementById("timePicker");
    if (!dp || !tp) return new Date();

    const [y, m, d] = dp.value.split("-").map(Number);
    const hr = parseInt(tp.value) || 0;
    
    return new Date(y, m - 1, d, hr, 0, 0);
}

function getNightPolygon(date) {
    const now = date || new Date();
    const startOfYear = new Date(now.getUTCFullYear(), 0, 1);
    const dayOfYear = Math.floor((now - startOfYear) / (24 * 3600 * 1000)) + 1;

    // Solar declination (approximate in radians)
    const dec = 23.44 * Math.sin((360 / 365.24) * (dayOfYear - 80) * Math.PI / 180) * Math.PI / 180;
    
    // Subsolar longitude in degrees
    const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
    const sunLon = 180 - (utcHours / 24) * 360;

    const coords = [];
    const step = 2; // Degrees step

    const safeDec = Math.abs(dec) < 0.0001 ? 0.0001 : dec;

    for (let lon = -180; lon <= 180; lon += step) {
        const lonRad = lon * Math.PI / 180;
        const sunLonRad = sunLon * Math.PI / 180;
        const latRad = Math.atan(-Math.cos(lonRad - sunLonRad) / Math.tan(safeDec));
        coords.push([lon, latRad * 180 / Math.PI]);
    }

    if (dec > 0) {
        coords.push([180, -90]);
        coords.push([-180, -90]);
    } else {
        coords.push([180, 90]);
        coords.push([-180, 90]);
    }
    coords.push(coords[0]);

    return {
        type: "Feature",
        properties: {},
        geometry: {
            type: "Polygon",
            coordinates: [coords]
        }
    };
}

export function addDayNightLayer() {
    if (!map) return;
    
    if (!map.getSource("daynight-source")) {
        map.addSource("daynight-source", {
            type: "geojson",
            data: getNightPolygon(getSelectedAppDate())
        });
    }
    
    if (!map.getLayer("daynight-layer")) {
        const beforeId = map.getLayer("states-fill") ? "states-fill" : undefined;
        map.addLayer({
            id: "daynight-layer",
            type: "fill",
            source: "daynight-source",
            paint: {
                "fill-color": "#000000",
                "fill-opacity": 0.4
            },
            layout: {
                visibility: "none"
            }
        }, beforeId);
    }
}

export function updateDayNightData() {
    if (!map) return;
    const src = map.getSource("daynight-source");
    if (src) {
        src.setData(getNightPolygon(getSelectedAppDate()));
    }
}

export function setDayNightVisibility(visible) {
    if (!map) return;
    const isChecked = document.getElementById("MapBtnDayNight")?.checked ?? true;
    const layoutVisible = (visible && isChecked) ? "visible" : "none";
    if (map.getLayer("daynight-layer")) {
      map.setLayoutProperty("daynight-layer", "visibility", layoutVisible);
    }
}

// Attach event listeners for dynamic updates when the date or time changes
(() => {
    const datePicker = document.getElementById("datePicker");
    const timePicker = document.getElementById("timePicker");
    if (datePicker) datePicker.addEventListener("change", updateDayNightData);
    if (timePicker) timePicker.addEventListener("change", updateDayNightData);
})();

