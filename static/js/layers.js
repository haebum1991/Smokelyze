
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
  map.on("load", () => {
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
  });

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
      const url = newsBtn.getAttribute("data-link");
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
      const lon = parseFloat(newsLocBtn.getAttribute("data-lon"));
      const lat = parseFloat(newsLocBtn.getAttribute("data-lat"));
      const idx = parseInt(newsLocBtn.getAttribute("data-idx"));
      const feats = getLoadedNewsFeatures();
      if (highlightLocation && feats) {
        highlightLocation([lon, lat], feats[idx].properties, "wildfire_news");
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

