
import { map } from "./map-init.js";
import { loadedGeoJSON, loadedSources } from "./loader-state.js";
import { LAYER_TEMPLATES, DATASET_SOURCE_MAP } from "./layers-def.js";
import { pointInGeometry } from "./geo-utils.js";
import { getActiveModelLayers } from "./stats-common.js";
import { setAreaStatsDrawer } from "./ui-toggles.js";
import {
    rasterDataStore,
    TEMPO_CONFIG,
    TROPOMI_CONFIG,
    HRRR_CONFIG,
    GOES_CONFIG
} from "./raster-loader.js";

let draw = null;

const STYLES = `
.draw-stats-panel-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0rem;
  font-size: 1.4rem;
}

.draw-stats-panel-row:not(:last-child) {
  border-bottom: 0.1rem solid var(--border-soft);
  padding-bottom: 0.8rem;
}

.draw-stats-panel-row .label {
  font-weight: 500;
  color: var(--text-main);
  margin-right: 1.5rem;
  word-break: break-word;
}

.draw-stats-panel-row .value {
  font-weight: bold;
  color: var(--card-shadow);
  text-align: right;
  white-space: nowrap;
}

.draw-stats-panel-row-stacked {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-top: 0rem;
  font-size: 1.4rem;
}

.draw-stats-panel-row-stacked:not(:last-child) {
  border-bottom: 0.1rem solid var(--border-soft);
  padding-bottom: 0.8rem;
}

.draw-stats-panel-row-stacked .label {
  font-weight: 500;
  color: var(--text-main);
  margin-bottom: 0.4rem;
  word-break: break-word;
  width: 100%;
}

.draw-stats-panel-row-stacked .value {
  font-weight: bold;
  color: var(--card-shadow);
  text-align: right;
  width: 100%;
}

.draw-stats-panel-no-data {
  font-style: italic;
  color: var(--text-main);
  font-size: 1.3rem;
  text-align: center;
  padding: 1rem 0;
}

/* Custom styled Mapbox Draw Toolbar matching dark glassmorphism theme */
.mapboxgl-ctrl-top-left .mapboxgl-ctrl-group {
  margin-top: 1.2rem !important;
  margin-left: 1.2rem !important;
  border-radius: var(--border-radius-0p8rem) !important;
  background: var(--map-accordion-gradient-start) !important;
  backdrop-filter: blur(8px) !important;
  -webkit-backdrop-filter: blur(8px) !important;
  border: 1px solid var(--border-main) !important;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3) !important;
  overflow: hidden;
}

.mapboxgl-ctrl-top-left .mapboxgl-ctrl-group button {
  background-color: transparent !important;
  border-bottom: 1px solid var(--border-soft) !important;
  transition: background-color 0.2s ease, transform 0.2s ease;
  filter: invert(1) brightness(1.5);
}

.mapboxgl-ctrl-top-left .mapboxgl-ctrl-group button:last-child {
  border-bottom: none !important;
}

.mapboxgl-ctrl-top-left .mapboxgl-ctrl-group button:hover {
  background-color: var(--accent-highlight) !important;
}

.mapboxgl-ctrl-top-left .mapboxgl-ctrl-group button:active {
  background-color: var(--accent-highlight) !important;
}

/* Drawing toolbar button active state in bottom-left MapBtnWrapper */
#MapBtnDraw.active {
  background-color: var(--card-shadow) !important;
  border-color: var(--card-shadow) !important;
  box-shadow: 0 0 1rem var(--card-shadow);
  color: var(--color-bg) !important;
}

.draw-mode-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: radial-gradient(circle, rgba(0, 0, 0, 0.1) 40%, rgba(0, 0, 0, 0.55) 100%);
  pointer-events: none;
  z-index: 998;
  opacity: 0;
  transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.draw-mode-overlay.active {
  opacity: 1;
}

.draw-mode-banner {
  position: fixed;
  top: 1.5rem;
  left: 50%;
  transform: translate(-50%, -20px);
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid #00ffff;
  color: #fff;
  padding: 0.8rem 1.6rem;
  border-radius: 20px;
  font-size: 1.25rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.8rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4), 0 0 15px rgba(0, 255, 255, 0.1);
  z-index: 10000;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.draw-mode-banner.active {
  opacity: 1;
  transform: translate(-50%, 0);
}

.draw-mode-banner .pulse-dot {
  width: 8px;
  height: 8px;
  background-color: #00ffff;
  border-radius: 50%;
  box-shadow: 0 0 0 rgba(0, 255, 255, 0.6);
  animation: draw-pulse-glow 1.5s infinite;
}

@keyframes draw-pulse-glow {
  0% {
    box-shadow: 0 0 0 0px rgba(0, 255, 255, 0.6);
  }
  70% {
    box-shadow: 0 0 0 8px rgba(0, 255, 255, 0);
  }
  100% {
    box-shadow: 0 0 0 0px rgba(0, 255, 255, 0);
  }
}

@media (max-width: 1024px) {
  #MapBtnDraw {
    display: none !important;
  }
}
`;

function injectStyles() {
    if (document.getElementById("map-draw-stats-styles")) return;
    const style = document.createElement("style");
    style.id = "map-draw-stats-styles";
    style.textContent = STYLES;
    document.head.appendChild(style);
}

function showDarkOverlay() {
    let overlay = document.getElementById("draw-mode-overlay");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "draw-mode-overlay";
        overlay.className = "draw-mode-overlay";
        document.body.appendChild(overlay);
    }
    overlay.offsetHeight; // force reflow
    overlay.classList.add("active");
}

function hideDarkOverlay() {
    const overlay = document.getElementById("draw-mode-overlay");
    if (overlay) {
        overlay.classList.remove("active");
        setTimeout(() => {
            if (overlay.parentNode && !overlay.classList.contains("active")) {
                overlay.parentNode.removeChild(overlay);
            }
        }, 300);
    }
}

function showBanner(text, showDot = true) {
    let banner = document.getElementById("draw-mode-banner");
    if (!banner) {
        banner = document.createElement("div");
        banner.id = "draw-mode-banner";
        banner.className = "draw-mode-banner";
        document.body.appendChild(banner);
    }
    banner.innerHTML = `
        ${showDot ? '<span class="pulse-dot"></span>' : ''}
        <span>${text}</span>
    `;
    banner.offsetHeight; // force reflow
    banner.classList.add("active");
}

function hideBanner() {
    const banner = document.getElementById("draw-mode-banner");
    if (banner) {
        banner.classList.remove("active");
        setTimeout(() => {
            if (banner.parentNode && !banner.classList.contains("active")) {
                banner.parentNode.removeChild(banner);
            }
        }, 300);
    }
}

/**
 * Initialize drawing stats functionality
 */
// Custom Mapbox GL Draw mode to draw rectangles with 2 clicks
const DrawRectangle = {
    onSetup: function (opts) {
        const rectangle = this.newFeature({
            type: "Feature",
            properties: {},
            geometry: {
                type: "Polygon",
                coordinates: [[]]
            }
        });
        this.addFeature(rectangle);
        this.clearSelectedFeatures();
        this.updateUIClasses({ mouse: "add" });
        this.setActionableState({
            trash: true
        });
        map.dragPan.disable();
        return {
            rectangleId: rectangle.id,
            startPoint: null
        };
    },

    onClick: function (state, e) {
        if (!state.startPoint) {
            state.startPoint = [e.lngLat.lng, e.lngLat.lat];
        } else {
            this.updateUIClasses({ mouse: "pointer" });
            this.changeMode("simple_select", { featureIds: [state.rectangleId] });
            map.dragPan.enable();
        }
    },

    onMouseMove: function (state, e) {
        if (state.startPoint) {
            const start = state.startPoint;
            const end = [e.lngLat.lng, e.lngLat.lat];
            const coords = [
                [start[0], start[1]],
                [end[0], start[1]],
                [end[0], end[1]],
                [start[0], end[1]],
                [start[0], start[1]]
            ];
            const feature = this.getFeature(state.rectangleId);
            feature.setCoordinates([coords]);
        }
    },

    onTouchMove: function (state, e) {
        return this.onMouseMove(state, e);
    },

    onTouchEnd: function (state, e) {
        if (state.startPoint) {
            this.updateUIClasses({ mouse: "pointer" });
            this.changeMode("simple_select", { featureIds: [state.rectangleId] });
            map.dragPan.enable();
        }
    },

    onKeyUp: function (state, e) {
        if (e.keyCode === 27) { // ESC key
            this.deleteFeature(state.rectangleId, { silent: true });
            this.changeMode("simple_select");
            const drawBtn = document.getElementById("MapBtnDraw");
            if (drawBtn) {
                drawBtn.classList.remove("active");
            }
        }
    },

    toDisplayFeatures: function (state, geojson, display) {
        const isActive = geojson.properties.id === state.rectangleId;
        geojson.properties.active = isActive ? "true" : "false";
        if (!isActive) return display(geojson);
        if (state.startPoint) {
            display(geojson);
        }
    }
};

export function initMapDrawStats() {
    injectStyles();
    
    if (typeof MapboxDraw === "undefined") {
        console.log("Waiting for MapboxDraw library...");
        setTimeout(initMapDrawStats, 50);
        return;
    }
    if (!map) return;

    // Construct drawStyles with custom solid black and neon green styling
    const drawStyles = [
        {
            "id": "gl-draw-polygon-fill-active",
            "type": "fill",
            "filter": ["all", ["==", "$type", "Polygon"], ["==", "active", "true"]],
            "paint": {
                "fill-color": "#000000",
                "fill-opacity": 0.1
            }
        },
        {
            "id": "gl-draw-polygon-stroke-active-glow", // Outer neon glow layer
            "type": "line",
            "filter": ["all", ["==", "$type", "Polygon"], ["==", "active", "true"]],
            "layout": {
                "line-cap": "round",
                "line-join": "round"
            },
            "paint": {
                "line-color": "#00ffff", // neon cyan glow color
                "line-width": 12,
                "line-blur": 5
            }
        },
        {
            "id": "gl-draw-polygon-stroke-active-core", // Inner core solid black layer
            "type": "line",
            "filter": ["all", ["==", "$type", "Polygon"], ["==", "active", "true"]],
            "layout": {
                "line-cap": "round",
                "line-join": "round"
            },
            "paint": {
                "line-color": "#000000", // solid black core
                "line-width": 3
            }
        },
        {
            "id": "gl-draw-polygon-fill-inactive",
            "type": "fill",
            "filter": ["all", ["==", "$type", "Polygon"], ["==", "active", "false"]],
            "paint": {
                "fill-color": "#000000",
                "fill-opacity": 0.1
            }
        },
        {
            "id": "gl-draw-polygon-stroke-inactive",
            "type": "line",
            "filter": ["all", ["==", "$type", "Polygon"], ["==", "active", "false"]],
            "layout": {
                "line-cap": "round",
                "line-join": "round"
            },
            "paint": {
                "line-color": "#000000", // solid black when fixed
                "line-width": 3,
                "line-blur": 0
            }
        },
        {
            "id": "gl-draw-line-active-glow",
            "type": "line",
            "filter": ["all", ["==", "$type", "LineString"], ["==", "active", "true"]],
            "layout": {
                "line-cap": "round",
                "line-join": "round"
            },
            "paint": {
                "line-color": "#00ffff", // neon cyan glow color
                "line-width": 12,
                "line-blur": 5
            }
        },
        {
            "id": "gl-draw-line-active-core",
            "type": "line",
            "filter": ["all", ["==", "$type", "LineString"], ["==", "active", "true"]],
            "layout": {
                "line-cap": "round",
                "line-join": "round"
            },
            "paint": {
                "line-color": "#000000",
                "line-width": 3
            }
        },
        {
            "id": "gl-draw-line-inactive",
            "type": "line",
            "filter": ["all", ["==", "$type", "LineString"], ["==", "active", "false"]],
            "layout": {
                "line-cap": "round",
                "line-join": "round"
            },
            "paint": {
                "line-color": "#000000",
                "line-width": 3,
                "line-blur": 0
            }
        },
        {
            "id": "gl-draw-polygon-and-line-vertex-stroke-active",
            "type": "circle",
            "filter": ["all", ["==", "meta", "vertex"], ["==", "$type", "Point"], ["==", "active", "true"]],
            "paint": {
                "circle-radius": 0,
                "circle-opacity": 0
            }
        },
        {
            "id": "gl-draw-polygon-and-line-vertex-inactive",
            "type": "circle",
            "filter": ["all", ["==", "meta", "vertex"], ["==", "$type", "Point"], ["==", "active", "false"]],
            "paint": {
                "circle-radius": 0,
                "circle-opacity": 0
            }
        },
        {
            "id": "gl-draw-polygon-midpoint",
            "type": "circle",
            "filter": ["all", ["==", "$type", "Point"], ["==", "meta", "midpoint"]],
            "paint": {
                "circle-radius": 0,
                "circle-opacity": 0
            }
        },
        {
            "id": "gl-draw-point-stroke-active",
            "type": "circle",
            "filter": ["all", ["==", "$type", "Point"], ["==", "active", "true"], ["!=", "meta", "vertex"], ["!=", "meta", "midpoint"]],
            "paint": {
                "circle-radius": 0,
                "circle-opacity": 0
            }
        },
        {
            "id": "gl-draw-point-active",
            "type": "circle",
            "filter": ["all", ["==", "$type", "Point"], ["==", "active", "true"], ["!=", "meta", "vertex"], ["!=", "meta", "midpoint"]],
            "paint": {
                "circle-radius": 0,
                "circle-opacity": 0
            }
        },
        {
            "id": "gl-draw-point-inactive",
            "type": "circle",
            "filter": ["all", ["==", "$type", "Point"], ["==", "active", "false"], ["!=", "meta", "vertex"], ["!=", "meta", "midpoint"]],
            "paint": {
                "circle-radius": 0,
                "circle-opacity": 0
            }
        }
    ];

    // Extend default modes with our custom rectangle mode and disable direct_select (no edit handles)
    const modes = {
        ...MapboxDraw.modes,
        draw_rectangle: DrawRectangle,
        direct_select: MapboxDraw.modes.simple_select
    };

    // Create the Mapbox Draw control with custom solid black styling and rectangle mode
    draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: {
            trash: true
        },
        modes: modes,
        styles: drawStyles
    });
    map.addControl(draw, "top-left");

    let lastSelectedId = null;

    // Register drawing events
    map.on("draw.create", (e) => {
        const drawBtn = document.getElementById("MapBtnDraw");
        if (drawBtn) {
            drawBtn.classList.add("active");
        }
        hideDarkOverlay();
        hideBanner();
        bringDrawLayersToFront();
        updateAverages();
    });

    map.on("draw.update", () => {
        bringDrawLayersToFront();
        updateAverages();
    });
    
    map.on("draw.modechange", (e) => {
        if (e.mode !== "draw_rectangle") {
            hideDarkOverlay();
            if (draw.getSelectedIds().length === 0) {
                hideBanner();
            }
        }
    });

    map.on("draw.delete", () => {
        hideDarkOverlay();
        hideBanner();
        clearAverages();
        const drawBtn = document.getElementById("MapBtnDraw");
        if (drawBtn) {
            drawBtn.classList.remove("active");
        }
        lastSelectedId = null;
    });

    map.on("draw.selectionchange", (e) => {
        if (e.features.length > 0) {
            const id = e.features[0].id;
            if (lastSelectedId === id) {
                // Clicked selected shape again -> deselect/fix it!
                draw.changeMode("simple_select", { featureIds: [] });
                lastSelectedId = null;
                hideBanner();
            } else {
                lastSelectedId = id;
                showBanner("Area Selected: Drag to move, press Backspace/Delete to remove, click map to lock", true);
            }
        } else {
            lastSelectedId = null;
            hideBanner();
        }
        bringDrawLayersToFront();
        updateAverages();
    });


    // Expose update function globally for window-based events (like stats refresh)
    window.updateDrawStatsAverages = updateAverages;
    window.isDrawActive = () => {
        if (!draw) return false;
        try {
            const mode = draw.getMode();
            const selected = draw.getSelectedIds() || [];
            return mode === "draw_rectangle" || selected.length > 0;
        } catch (e) {
            return false;
        }
    };

    // Listen to custom drawer show/hide events
    window.addEventListener("areastats-drawer-opened", () => {
        if (draw) {
            draw.deleteAll();
            draw.changeMode("draw_rectangle");
        }
        showDarkOverlay();
        showBanner("Drawing Mode: Click map to start, move, then click again to finish drawing", true);
        const guideHtml = `
            <div style="display: flex; align-items: center; gap: 0.8rem; font-size: 1.3rem; color: var(--text-main); line-height: 1.4; padding: 1rem;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--card-shadow)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
                <span>Click on the map to set the starting point, move the mouse, and click once more to complete the area.</span>
            </div>
        `;
        showStatsPanelHTML(guideHtml);
    });

    window.addEventListener("areastats-drawer-closed", () => {
        hideDarkOverlay();
        hideBanner();
        clearAverages();
        if (draw) {
            draw.deleteAll();
            draw.changeMode("simple_select");
        }
        lastSelectedId = null;
    });

    // Recalculate averages dynamically when any layer checkbox is toggled
    const accordionPage = document.getElementById("AccordionPage");
    if (accordionPage) {
        accordionPage.addEventListener("change", (e) => {
            if (e.target && e.target.type === "checkbox") {
                // Tiny timeout to let activeSources and loader states sync
                setTimeout(updateAverages, 50);
            }
        });
    }

    // Global keyboard listener to delete selected drawings reliably on Delete/Backspace press
    document.addEventListener("keydown", (e) => {
        if (!draw) return;
        // Dont intercept if typing in input fields or textareas
        if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable) {
            return;
        }
        if (e.key === "Delete" || e.key === "Backspace") {
            const selectedIds = draw.getSelectedIds();
            if (selectedIds.length > 0) {
                e.preventDefault();
                draw.delete(selectedIds);
                setAreaStatsDrawer(false); // Closes drawer, triggers event, clears all averages automatically!
            }
        }
    });
}

/**
 * Calculates bounding box of a GeoJSON polygon
 */
export function getPolygonBBox(geometry) {
    let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90;
    
    if (geometry.type === "Polygon") {
        const outerRing = geometry.coordinates[0];
        outerRing.forEach(([lng, lat]) => {
            if (lng < minLng) minLng = lng;
            if (lng > maxLng) maxLng = lng;
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
        });
    } else if (geometry.type === "MultiPolygon") {
        geometry.coordinates.forEach(polygon => {
            const outerRing = polygon[0];
            outerRing.forEach(([lng, lat]) => {
                if (lng < minLng) minLng = lng;
                if (lng > maxLng) maxLng = lng;
                if (lat < minLat) minLat = lat;
                if (lat > maxLat) maxLat = lat;
            });
        });
    }
    
    return { minLng, maxLng, minLat, maxLat };
}

/**
 * Get active raster layers currently visible on the map (excluding GeoColor / VIIRS truecolor)
 */
export function getActiveRasterLayers() {
    if (!map) return [];
    const list = [];
    const configs = [
        ...Object.values(TEMPO_CONFIG),
        ...Object.values(TROPOMI_CONFIG),
        ...Object.values(HRRR_CONFIG),
        ...Object.values(GOES_CONFIG)
    ];

    configs.forEach(cfg => {
        // Skip GeoColor since it is an RGB base map, not a parameter metric
        if (cfg.sourceId.includes("geocolor") || cfg.sourceId.includes("truecolor")) return;
        if (!map.getLayer(cfg.mapLayerId)) return;

        const isVisible = map.getLayoutProperty(cfg.mapLayerId, "visibility") === "visible";
        if (isVisible) {
            let label = cfg.sourceId;
            if (cfg.sourceId.includes("tempo")) {
                label = cfg.productId.includes("NO2") ? "TEMPO-NO2VCD (hourly)" : "TEMPO-HCHOVCD (hourly)";
            } else if (cfg.sourceId.includes("tropomi")) {
                label = cfg.productId.includes("NO2") ? "TROPOMI-NO2VCD" : "TROPOMI-HCHOVCD";
            } else if (cfg.sourceId.includes("hrrr")) {
                label = cfg.sourceId.includes("colmd") ? "HRRR-smokeVCD (hourly)" : "HRRR-smoke8m (hourly)";
            } else if (cfg.sourceId.includes("goes")) {
                label = cfg.sourceId === "goes-aod-east" ? "GOES-AOD-East (hourly)" : "GOES-AOD-West (hourly)";
            }
            list.push({ sourceId: cfg.sourceId, label });
        }
    });
    return list;
}

/**
 * Recalculates and displays averages of loaded station points inside the drawn area
 */
export function updateAverages() {
    if (!draw) return;
    const selectedFeatures = draw.getAll().features;
    if (selectedFeatures.length === 0) {
        clearAverages();
        return;
    }

    // Compute averages for the latest drawn/modified shape
    const shape = selectedFeatures[selectedFeatures.length - 1];
    const activeLayers = getActiveModelLayers().filter(layer => {
        const id = layer.id;
        return !id.startsWith("tempo-") && !id.startsWith("tropomi-") && !id.startsWith("hrrr-") && !id.startsWith("goes-");
    });
    const activeRasterLayers = getActiveRasterLayers();

    const isNifcActive = document.getElementById("layer-wildfire-nifc")?.checked &&
        document.getElementById("layer-wildfire-nifc")?.closest("label")?.style.display !== "none";
    const isFireActive = document.getElementById("layer-fire")?.checked &&
        document.getElementById("layer-fire")?.closest("label")?.style.display !== "none";

    if (activeLayers.length === 0 && activeRasterLayers.length === 0 && !isNifcActive && !isFireActive) {
        showStatsPanelHTML("<div class='draw-stats-panel-no-data'>No active layers checked in panel.</div>");
        return;
    }

    const currentDataset = document.getElementById("MapDataSelect")?.value;
    let html = "";

    // 1. Process Vector Layers (Points)
    activeLayers.forEach(layer => {
        const tmpl = LAYER_TEMPLATES.find(t => t.id === layer.id);
        if (!tmpl) return;

        // Resolve data source key
        let sourceKey = null;
        if (layer.id.startsWith("airnow-hourly-")) {
            sourceKey = loadedSources["airnow_hourly"];
        } else if (layer.id.startsWith("airnow-daily-")) {
            sourceKey = "airnow_daily";
        } else {
            sourceKey = DATASET_SOURCE_MAP[currentDataset];
        }

        if (!sourceKey) return;
        const fc = loadedGeoJSON[sourceKey];
        if (!fc || !fc.features) return;

        // Resolve property field name
        const fieldDef = tmpl.field;
        const fieldName = (typeof fieldDef === "function") ? fieldDef(currentDataset) : fieldDef;

        let sum = 0;
        let count = 0;

        fc.features.forEach(feat => {
            if (!feat.geometry) return;

            let coords = null;
            if (feat.geometry.type === "Point") {
                coords = feat.geometry.coordinates;
            } else if (feat.properties && feat.properties.lon !== undefined && feat.properties.lat !== undefined) {
                coords = [parseFloat(feat.properties.lon), parseFloat(feat.properties.lat)];
            }

            if (!coords || isNaN(coords[0]) || isNaN(coords[1])) return;

            // Check containment
            if (pointInGeometry(coords, shape.geometry)) {
                const val = feat.properties[fieldName];
                if (val !== undefined && val !== null && val !== "" && !isNaN(val)) {
                    sum += parseFloat(val);
                    count++;
                }
            }
        });

        if (count > 0) {
            const resolvedUnit = (typeof tmpl.unit === "function") ? tmpl.unit(currentDataset) : tmpl.unit;
            const unit = resolvedUnit ? " " + resolvedUnit : "";

            if (tmpl.cal_type === "count") {
                // Binary/categorical: show count of positive values (≥1) / total sites in area
                const positiveCount = Math.round(sum);
                html += `
                    <div class="draw-stats-panel-row">
                        <span class="label">${layer.label}</span>
                        <span class="value">${positiveCount} / ${count}<span style="color: var(--text-main); font-weight: normal;"> sites</span></span>
                    </div>
                `;
            } else {
                // Numeric: show mean
                const avg = (sum / count).toFixed(tmpl.decimals !== undefined ? tmpl.decimals : 1);
                html += `
                    <div class="draw-stats-panel-row">
                        <span class="label">${layer.label}</span>
                        <span class="value">${avg}<span style="color: var(--text-main); font-weight: normal;">${unit}</span> <small style="color: var(--text-main); font-size: 1.1rem; font-weight: normal;">(${count} sites)</small></span>
                    </div>
                `;
            }
        } else {
            html += `
                <div class="draw-stats-panel-row">
                    <span class="label">${layer.label}</span>
                    <span class="value" style="color: var(--card-shadow);">No data in area</span>
                </div>
            `;
        }
    });
    
    // 1b. Process NIFC Wildfire Incidents (Count)
    if (isNifcActive) {
        const fc = loadedGeoJSON["wildfire_nifc"];
        let wfCount = 0;
        if (fc && fc.features) {
            fc.features.forEach(feat => {
                if (!feat.geometry) return;
                let coords = null;
                if (feat.geometry.type === "Point") {
                    coords = feat.geometry.coordinates;
                } else if (feat.properties && feat.properties.lon !== undefined && feat.properties.lat !== undefined) {
                    coords = [parseFloat(feat.properties.lon), parseFloat(feat.properties.lat)];
                }
                if (!coords || isNaN(coords[0]) || isNaN(coords[1])) return;

                if (pointInGeometry(coords, shape.geometry)) {
                    wfCount++;
                }
            });
        }
        html += `
            <div class="draw-stats-panel-row">
                <span class="label">WF incidents location</span>
                <span class="value">${wfCount}<span style="color: var(--text-main); font-weight: normal;"> incidents</span></span>
            </div>
        `;
    }

    // 1c. Process HMS-fire Points (Count)
    if (isFireActive) {
        const fc = loadedGeoJSON["fire"];
        let fireCount = 0;
        let frpSum = 0;
        let frpCount = 0;
        if (fc && fc.features) {
            fc.features.forEach(feat => {
                if (!feat.geometry) return;
                let coords = null;
                if (feat.geometry.type === "Point") {
                    coords = feat.geometry.coordinates;
                } else if (feat.properties && feat.properties.lon !== undefined && feat.properties.lat !== undefined) {
                    coords = [parseFloat(feat.properties.lon), parseFloat(feat.properties.lat)];
                }
                if (!coords || isNaN(coords[0]) || isNaN(coords[1])) return;

                if (pointInGeometry(coords, shape.geometry)) {
                    fireCount++;
                    const frpVal = parseFloat(feat.properties["FRP"]);
                    if (!isNaN(frpVal)) {
                        frpSum += frpVal;
                        frpCount++;
                    }
                }
            });
        }
        html += `
            <div class="draw-stats-panel-row">
                <span class="label">HMS-fire</span>
                <span class="value">${fireCount}<span style="color: var(--text-main); font-weight: normal;"> points</span></span>
            </div>
        `;
        if (frpCount > 0) {
            const frpAvg = (frpSum / frpCount).toFixed(1);
            html += `
                <div class="draw-stats-panel-row">
                    <span class="label">HMS-fire FRP</span>
                    <span class="value">${frpAvg}<span style="color: var(--text-main); font-weight: normal;"> MW</span></span>
                </div>
            `;
        }
    }

    // 2. Process Raster Layers (Image grids)
    activeRasterLayers.forEach(rasterLayer => {
        const store = rasterDataStore[rasterLayer.sourceId];
        if (!store || !store.grayscale) return;

        const { minLng, maxLng, minLat, maxLat } = getPolygonBBox(shape.geometry);

        // Check if polygon overlaps with the raster extent
        if (maxLng < store.xmin || minLng > store.xmax || maxLat < store.ymin || minLat > store.ymax) {
            html += `
                <div class="draw-stats-panel-row-stacked">
                    <div class="label">${rasterLayer.label}</div>
                    <div class="value" style="color: var(--text-soft); font-weight: normal;">Outside coverage</div>
                </div>
            `;
            return;
        }

        // Clamp bounding box to raster extent
        const clampLngMin = Math.max(minLng, store.xmin);
        const clampLngMax = Math.min(maxLng, store.xmax);
        const clampLatMin = Math.max(minLat, store.ymin);
        const clampLatMax = Math.min(maxLat, store.ymax);

        // Convert coordinates to pixel bounds
        const minPxX = Math.max(0, Math.floor(((clampLngMin - store.xmin) / store.lngRange) * store.imgW));
        const maxPxX = Math.min(store.imgW - 1, Math.ceil(((clampLngMax - store.xmin) / store.lngRange) * store.imgW));

        const latToMercY = (l) => Math.log(Math.tan((Math.PI / 4) + (l * Math.PI / 360)));
        const mercYMinClamped = latToMercY(clampLatMin);
        const mercYMaxClamped = latToMercY(clampLatMax);

        const maxPxY = Math.min(store.imgH - 1, Math.ceil(((store.mercYMax - mercYMinClamped) / store.mercYRange) * store.imgH));
        const minPxY = Math.max(0, Math.floor(((store.mercYMax - mercYMaxClamped) / store.mercYRange) * store.imgH));

        let sum = 0;
        let count = 0;

        const totalPixels = (maxPxX - minPxX) * (maxPxY - minPxY);
        let step = 1;
        if (totalPixels > 50000) {
            // Adaptive sampling step to avoid browser freeze on extremely large rectangles
            step = Math.ceil(Math.sqrt(totalPixels / 50000));
        }

        for (let pxY = minPxY; pxY <= maxPxY; pxY += step) {
            const mercY = store.mercYMax - (pxY / store.imgH) * store.mercYRange;
            const lat = (360 / Math.PI) * Math.atan(Math.exp(mercY)) - 90;

            for (let pxX = minPxX; pxX <= maxPxX; pxX += step) {
                const lng = store.xmin + (pxX / store.imgW) * store.lngRange;

                if (pointInGeometry([lng, lat], shape.geometry)) {
                    const gray = store.grayscale[pxY * store.imgW + pxX];
                    if (gray && gray !== 0) {
                        const realValue = store.metadata.min_val + (gray / 255) * (store.metadata.max_val - store.metadata.min_val);
                        let displayValue = realValue;
                        if (rasterLayer.sourceId.includes("tempo") || rasterLayer.sourceId.includes("tropomi")) {
                            displayValue = realValue / 1e14;
                        } else if (rasterLayer.sourceId.includes("hrrr-colmd")) {
                            displayValue = realValue / 1e3;
                        }
                        sum += displayValue;
                        count++;
                    }
                }
            }
        }

        if (count > 0) {
            const avg = (sum / count).toFixed(2);
            const tmpl = LAYER_TEMPLATES.find(t => t.id === rasterLayer.sourceId);
            let unit = "";
            if (tmpl && tmpl.unit) {
                if (tmpl.unit.startsWith("10")) {
                    unit = " ×" + tmpl.unit;
                } else {
                    unit = " " + tmpl.unit;
                }
            }
            html += `
                <div class="draw-stats-panel-row-stacked">
                    <div class="label">${rasterLayer.label}</div>
                    <div class="value">${avg}<span style="color: var(--text-main); font-weight: normal;">${unit}</span> <small style="color: var(--text-main); font-size: 1.1rem; font-weight: normal;">(${count} cells)</small></div>
                </div>
            `;
        } else {
            html += `
                <div class="draw-stats-panel-row-stacked">
                    <div class="label">${rasterLayer.label}</div>
                    <div class="value" style="color: var(--text-soft); font-weight: normal;">No data in area</div>
                </div>
            `;
        }
    });

    if (!html) {
        html = "<div class='draw-stats-panel-no-data'>No data inside the drawn area.</div>";
    }

    showStatsPanelHTML(html);
}

/**
 * Hides stats panel
 */
function clearAverages() {
    const content = document.getElementById("AreaStatsDrawerList");
    if (content) {
        content.innerHTML = `
            <div style="padding: 2rem; text-align: center; color: var(--text-main); font-size: 1.4rem;">
                No area drawn yet.<br>Use the toolbar button below to draw.
            </div>
        `;
    }
    const drawer = document.getElementById("AreaStatsDrawer");
    if (drawer && drawer.classList.contains("open")) {
        setAreaStatsDrawer(false);
    }
}

/**
 * Render markup inside stats panel and show it
 */
function showStatsPanelHTML(html) {
    const content = document.getElementById("AreaStatsDrawerList");
    if (content) {
        content.innerHTML = html;
    }
    const drawer = document.getElementById("AreaStatsDrawer");
    if (drawer && !drawer.classList.contains("open")) {
        setAreaStatsDrawer(true);
    }
}

function onSelectionChange() {
    updateAverages();
}

/**
 * Move all Mapbox Draw layers to the top of the map layer stack so they are drawn on top of raster layers
 */
function bringDrawLayersToFront() {
    if (!map || !draw) return;
    const style = map.getStyle();
    if (!style || !style.layers) return;

    const drawLayers = style.layers.filter(l => l.id.startsWith("gl-draw-"));
    drawLayers.forEach(layer => {
        if (map.getLayer(layer.id)) {
            map.moveLayer(layer.id);
        }
    });
}

