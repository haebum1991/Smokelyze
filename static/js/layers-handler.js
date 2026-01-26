
/**
 * 레이어 실행 제어: 지도에 레이어를 추가, 삭제하거나 체크박스에 따른 가시성 토글 로직을 관리
 */

import { DATA_IMPORT_METHOD, ExcludeLayerGroups, DATASET_SOURCE_MAP, LAYER_DEFS } from "./layers-def.js";
import { highlightLocation } from "./utils.js";
import { state } from "./ui-state.js";
import { EMPTY_FC } from "./layers-constants.js";
import { updateLegend, updateStateColors } from "./layers-colors.js";
import { map, activeLayerStack, setCachedActiveLayerIds, setActiveLayerStack } from "./layers-state.js";

export const addSourceIfMissing = (sourceId) => {
    if (!map.getSource(sourceId)) {
        map.addSource(sourceId, { type: "geojson", data: EMPTY_FC, generateId: true });
    }
};

export const addLayerIfMissing = (layerSpec, sourceId) => {
    if (!map.getLayer(layerSpec.id)) {
        const def = {
            ...layerSpec,
            id: layerSpec.id,
            type: layerSpec.type,
            source: sourceId,
            layout: { visibility: "none", ...(layerSpec.layout || {}) }
        };
        map.addLayer(def);
    }
};

export const bindHover = (layerId, getHTML) => {
    const tooltip = document.getElementById("MapTooltip");
    if (!tooltip) return;

    map.on("mousemove", layerId, (e) => {
        if (state?.tooltipLocked) return;
        map.getCanvas().style.cursor = "pointer";

        const f = e.features?.[0];
        if (!f) return;

        const p = { ...f.properties };
        if (f.geometry?.type === "Point") {
            [p.lon, p.lat] = f.geometry.coordinates;
        }

        tooltip.innerHTML = getHTML(p);
        tooltip.style.display = "block";

        let x = e.originalEvent.clientX + 15;
        let y = e.originalEvent.clientY + 15;

        if (x + 320 > window.innerWidth) x = e.originalEvent.clientX - 330;
        if (y + 400 > window.innerHeight) y = e.originalEvent.clientY - 410;

        tooltip.style.left = `${x / 10}rem`;
        tooltip.style.top = `${y / 10}rem`;
    });

    map.on("mouseleave", layerId, () => {
        if (state?.tooltipLocked) return;
        map.getCanvas().style.cursor = "";
        tooltip.style.display = "none";
    });
};

export const bindClick = (layerId, dataSource) => {
    map.on("click", layerId, (e) => {
        e.preventDefault();
        const f = e.features?.[0];
        if (f?.geometry?.type !== "Point") return;

        const coords = f.geometry.coordinates;
        const sourceKey = DATASET_SOURCE_MAP[dataSource] || dataSource;

        highlightLocation?.(coords, f.properties, sourceKey);
    });
};

export const getAllInteractiveLayerIds = () => {
    const ids = [];
    Object.values(LAYER_DEFS).forEach(def => {
        def?.layers?.forEach(l => ids.push(l.id));
    });
    return ids;
};

export const ensureLayers = () => {
    if (!map) return;

    // External data sources
    ["airnow-pm25", "airnow-ozone", "airnow-no2"].forEach(src => addSourceIfMissing(src));

    const backgroundLayers = ExcludeLayerGroups.satelliteLayers;
    const keys = Object.keys(DATA_IMPORT_METHOD).sort((a, b) => {
        const aIsBg = backgroundLayers.includes(a);
        const bIsBg = backgroundLayers.includes(b);
        return aIsBg === bIsBg ? 0 : aIsBg ? -1 : 1;
    });

    keys.forEach(key => {
        const ds = DATA_IMPORT_METHOD[key];
        const def = LAYER_DEFS[key];
        if (!ds || !def) return;

        addSourceIfMissing(ds.source);
        def.layers.forEach(l => {
            if (!map.getLayer(l.id)) addLayerIfMissing(l, ds.source);
        });

        if (def.hoverOn && def.hoverHTML) {
            map._hoverBound = map._hoverBound || {};
            if (!map._hoverBound[def.hoverOn]) {
                bindHover(def.hoverOn, def.hoverHTML);
                bindClick(def.hoverOn, def.dsKey);
                map._hoverBound[def.hoverOn] = true;
            }
        }
    });
};

export const applyLayerToggles = () => {
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

    setCachedActiveLayerIds(currentCheckedIds.map(id => `layer-${id}`));

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

    // 4. Update Drawers Logic
    const updateDrawerUI = (shortId, drawerId, toggleId, bodyCls) => {
        const drawer = document.getElementById(drawerId);
        const toggle = document.getElementById(toggleId);
        if (!drawer) return;

        if (currentCheckedIds.includes(shortId)) {
            if (toggle) toggle.style.display = drawer.classList.contains("open") ? "none" : "block";
        } else {
            drawer.classList.remove("open");
            if (bodyCls) document.body.classList.remove(bodyCls);
            if (toggle) toggle.style.display = "none";
        }
    };

    updateDrawerUI("wildfire-news", "WFnewsDrawer", "WFnewsToggle", "WFnews-drawer-open");
    updateDrawerUI("MapPost", "MapPostDrawer", "MapPostToggle", "MapPost-drawer-open");

    // 5. Build and Update Active Layer Stack
    const newStack = activeLayerStack.filter(id => currentCheckedIds.includes(id));
    currentCheckedIds.forEach(id => {
        if (!EXCLUDED.includes(id) && !newStack.includes(id)) newStack.push(id);
    });
    setActiveLayerStack(newStack);

    const currentDataset = document.getElementById("MapDataSelect")?.value;
    let legendWillShow = false;

    newStack.forEach(shortId => {
        const targetKey = LAYER_DEFS[shortId] ? shortId : `${shortId}-${currentDataset}`;
        const def = LAYER_DEFS[targetKey];
        if (def) {
            if (def.legend) legendWillShow = true;
            def.layers.forEach(l => {
                if (map.getLayer(l.id)) {
                    map.setLayoutProperty(l.id, "visibility", "visible");
                    map.moveLayer(l.id);
                }
            });
        }
    });

    if (legendWillShow) {
        // Auto-close drawers if legend is shown
        ["WFnewsDrawer", "MapPostDrawer"].forEach(id => {
            const dr = document.getElementById(id);
            if (dr?.classList.contains("open")) {
                dr.classList.remove("open");
                const toggle = document.getElementById(id === "WFnewsDrawer" ? "WFnewsToggle" : "MapPostToggle");
                const bodyCls = id === "WFnewsDrawer" ? "WFnews-drawer-open" : "MapPost-drawer-open";
                document.body.classList.remove(bodyCls);
                if (toggle) toggle.style.display = "block";
            }
        });
    }

    updateLegend(newStack);
    updateStateColors?.();
};

