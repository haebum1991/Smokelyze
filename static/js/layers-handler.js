
/**
 * 레이어 실행 제어: 지도에 레이어를 추가, 삭제하거나 체크박스에 따른 가시성 토글 로직을 관리
 */
 
import { DATA_IMPORT_METHOD, ExcludeLayerGroups, DATASET_SOURCE_MAP, LAYER_DEFS } from "./layers-def.js";
import { highlightLocation } from "./utils.js";
import { state } from "./ui-state.js";
import { EMPTY_FC } from "./layers-constants.js";
import { updateLegend, updateStateColors } from "./layers-colors.js";
import { map, activeLayerStack, setCachedActiveLayerIds, setActiveLayerStack } from "./layers-state.js";

export function addSourceIfMissing(sourceId) {
    if (!map.getSource(sourceId)) {
        map.addSource(sourceId, { type: "geojson", data: EMPTY_FC, generateId: true });
    }
}

export function addLayerIfMissing(layerSpec, sourceId) {
    if (!map.getLayer(layerSpec.id)) {
        var def = {
            id: layerSpec.id,
            type: layerSpec.type,
            source: sourceId,
            layout: { visibility: "none" }
        };
        if (layerSpec.paint) def.paint = layerSpec.paint;
        if (layerSpec.layout) Object.assign(def.layout, layerSpec.layout);
        map.addLayer(def);
    }
}

export function bindHover(layerId, getHTML) {
    var tooltip = document.getElementById("MapTooltip");
    if (!tooltip) return;

    map.on("mousemove", layerId, function (e) {
        if (state && state.tooltipLocked) return;
        map.getCanvas().style.cursor = "pointer";

        var f = e.features && e.features[0];
        if (!f) return;

        var p = f.properties || {};
        if (f.geometry && f.geometry.type === "Point") {
            p.lon = f.geometry.coordinates[0];
            p.lat = f.geometry.coordinates[1];
        }

        tooltip.innerHTML = getHTML(p);
        tooltip.style.display = "block";

        var x = e.originalEvent.clientX + 15;
        var y = e.originalEvent.clientY + 15;

        if (x + 320 > window.innerWidth) {
            x = e.originalEvent.clientX - 330;
        }
        if (y + 400 > window.innerHeight) {
            y = e.originalEvent.clientY - 410;
        }

        tooltip.style.left = (x / 10) + "rem";
        tooltip.style.top = (y / 10) + "rem";
    });

    map.on("mouseleave", layerId, function () {
        if (state && state.tooltipLocked) return;
        map.getCanvas().style.cursor = "";
        if (tooltip) tooltip.style.display = "none";
    });
}

export function bindClick(layerId, dataSource) {
    map.on("click", layerId, function (e) {
        e.preventDefault();
        var f = e.features && e.features[0];
        if (!f) return;

        var coords = null;
        if (f.geometry.type === "Point") {
            coords = f.geometry.coordinates;
        } else {
            return;
        }

        var sourceKey = dataSource;
        if (DATASET_SOURCE_MAP[dataSource]) {
            sourceKey = DATASET_SOURCE_MAP[dataSource];
        }

        if (highlightLocation) {
            highlightLocation(coords, f.properties, sourceKey);
        }
    });
}

export function getAllInteractiveLayerIds() {
    var ids = [];
    Object.keys(LAYER_DEFS).forEach(function (key) {
        var def = LAYER_DEFS[key];
        if (def && def.layers) {
            def.layers.forEach(function (l) {
                ids.push(l.id);
            });
        }
    });
    return ids;
}

export function ensureLayers() {
    if (!map) return;
    
    // ---- [External data] AirNow ----
    addSourceIfMissing("airnow-pm25");
    addSourceIfMissing("airnow-ozone");
    addSourceIfMissing("airnow-no2");
    // ---- [External data] AirNow ----
    
    var keys = Object.keys(DATA_IMPORT_METHOD);
    var backgroundLayers = ExcludeLayerGroups.satelliteLayers;

    keys.sort(function (a, b) {
        var aIsBg = backgroundLayers.includes(a);
        var bIsBg = backgroundLayers.includes(b);
        if (aIsBg && !bIsBg) return -1;
        if (!aIsBg && bIsBg) return 1;
        return 0;
    });

    keys.forEach(function (key) {
        var ds = DATA_IMPORT_METHOD[key];
        var def = LAYER_DEFS[key];
        if (!ds || !def) return;

        addSourceIfMissing(ds.source);

        def.layers.forEach(function (l) {
            if (!map.getLayer(l.id)) {
                addLayerIfMissing(l, ds.source);
            }
        });

        if (def.hoverOn && def.hoverHTML) {
            if (!map._hoverBound) map._hoverBound = {};
            if (!map._hoverBound[def.hoverOn]) {
                bindHover(def.hoverOn, def.hoverHTML);
                bindClick(def.hoverOn, def.dsKey);
                map._hoverBound[def.hoverOn] = true;
            }
        }
    });
}

export function applyLayerToggles() {
    if (!map) return;
    // 1. Hide all layers first
    Object.values(LAYER_DEFS).forEach(def => {
        def.layers.forEach(l => {
            if (map.getLayer(l.id) && map.getLayoutProperty(l.id, "visibility") !== "none") {
                map.setLayoutProperty(l.id, "visibility", "none");
            }
        });
    });

    // 2. Identify currently checked IDs
    const currentCheckedIds = Array.from(document.querySelectorAll("input[type=checkbox][id^='layer-']:checked"))
        .filter(cb => !cb.parentElement || cb.parentElement.style.display !== "none")
        .map(cb => cb.id.replace("layer-", ""));

    setCachedActiveLayerIds(currentCheckedIds.map(id => "layer-" + id));

    // 3. Handle Special Background Layers
    const EXCLUDED = ExcludeLayerGroups.legend;
    EXCLUDED.forEach(key => {
        if (currentCheckedIds.includes(key) && LAYER_DEFS[key]) {
            LAYER_DEFS[key].layers.forEach(l => {
                if (map.getLayer(l.id)) {
                    map.setLayoutProperty(l.id, "visibility", "visible");
                    map.moveLayer(l.id);
                }
            });
        }
    });

    // 4. Update Wildfire News Drawer & MapPost Drawer (Interaction with ui-toggles logic)
    const wfDrawer = document.getElementById("WFnewsDrawer");
    const wfToggle = document.getElementById("WFnewsToggle");
    if (wfDrawer) {
        if (currentCheckedIds.includes("wildfire-news")) {
            if (wfToggle) wfToggle.style.display = wfDrawer.classList.contains("open") ? "none" : "block";
        } else {
            wfDrawer.classList.remove("open");
            document.body.classList.remove("WFnews-drawer-open");
            if (wfToggle) wfToggle.style.display = "none";
        }
    }

    const MapPostDrawer = document.getElementById("MapPostDrawer");
    const MapPostToggle = document.getElementById("MapPostToggle");
    if (MapPostDrawer) {
        if (currentCheckedIds.includes("MapPost")) {
            if (MapPostToggle) MapPostToggle.style.display = MapPostDrawer.classList.contains("open") ? "none" : "block";
        } else {
            MapPostDrawer.classList.remove("open");
            document.body.classList.remove("MapPost-drawer-open");
            if (MapPostToggle) MapPostToggle.style.display = "none";
        }
    }

    // 5. Build and Update Active Layer Stack
    let newStack = activeLayerStack.filter(id => currentCheckedIds.includes(id));
    currentCheckedIds.forEach(id => {
        if (!EXCLUDED.includes(id) && !newStack.includes(id)) {
            newStack.push(id);
        }
    });
    setActiveLayerStack(newStack);

    const currentDataset = document.getElementById("MapDataSelect")?.value;
    let legendWillShow = false;

    newStack.forEach(shortId => {
        const targetKey = LAYER_DEFS[shortId] ? shortId : (shortId + "-" + currentDataset);
        if (LAYER_DEFS[targetKey]) {
            if (LAYER_DEFS[targetKey].legend) legendWillShow = true;
            LAYER_DEFS[targetKey].layers.forEach(l => {
                if (map.getLayer(l.id)) {
                    map.setLayoutProperty(l.id, "visibility", "visible");
                    map.moveLayer(l.id);
                }
            });
        }
    });

    if (legendWillShow) {
        if (wfDrawer && wfDrawer.classList.contains("open")) {
            wfDrawer.classList.remove("open");
            document.body.classList.remove("WFnews-drawer-open");
            if (wfToggle) wfToggle.style.display = "block";
        }
        if (MapPostDrawer && MapPostDrawer.classList.contains("open")) {
            MapPostDrawer.classList.remove("open");
            document.body.classList.remove("MapPost-drawer-open");
            if (MapPostToggle) MapPostToggle.style.display = "block";
        }
    }

    updateLegend(newStack);
    
    if (typeof updateStateColors === "function") {
        updateStateColors();
    }
}

