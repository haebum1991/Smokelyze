
/**
 * 레이어 실행 제어: 지도에 레이어를 추가, 삭제하거나 체크박스에 따른 가시성 토글 로직을 관리
 */

import { DATA_IMPORT_METHOD, ExcludeLayerGroups, DATASET_SOURCE_MAP, LAYER_DEFS, makeStepExpr } from "./layers-def.js";
import { highlightLocation, getEffectiveDataset, currentDate } from "./utils.js";
import { state } from "./ui-state.js";
import { EMPTY_FC } from "./layers-constants.js";
import { updateLegend, updateStateShading } from "./layers-colors.js";
import {
    map,
    activeLayerStack,
    _cachedActiveLayerIds,
    setCachedActiveLayerIds,
    setActiveLayerStack,
    PointLayersEnabled,
    NaShadingEnabled,
    closedLegendIds
} from "./layers-state.js";
import { logUserAction } from "./fb-logging.js";
import { setLegendDrawer } from "./ui-toggles.js";
import { getRasterTooltipInfo, updateRasterHoverBox } from "./raster-loader.js";

function addSourceIfMissing(sourceId) {
    if (!map.getSource(sourceId)) {
        if (ExcludeLayerGroups.pngLayers.includes(sourceId)) {
            // [Architecture Fix] Use [image] source instead of [canvas] source.
            // MapLibre CanvasSource is highly unstable with dynamic resizing and 
            // WebGL context restorations. ImageSource is much more stable and memory-efficient.
            map.addSource(sourceId, {
                type: "image",
                url: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", // 1x1 transparent
                coordinates: [
                    [-1, 1], [-0.9, 1], [-0.9, 0.9], [-1, 0.9]
                ]
            });
        } else {
            map.addSource(sourceId, { type: "geojson", data: EMPTY_FC, generateId: true });
        }
    }
}

function addLayerIfMissing(layerSpec, sourceId) {
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
}

function bindHover(layerId, getHTML) {
    const tooltip = document.getElementById("MapTooltip");
    if (!tooltip) return;

    map.on("mousemove", layerId, (e) => {
        if (state?.tooltipLocked) return;
        
        if (window.isDrawActive?.()) {
            map.getCanvas().style.cursor = "";
            tooltip.style.display = "none";
            return;
        }
        
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
}


const layerDataMap = {}; // Tracks { layerId: dataSource } for global click detection
function bindClick(layerId, dataSource) {
    // [Refactored] Instead of per-layer listeners, we register the layer as "interactive"
    // and handle clicks globally once to ensure top-most accuracy.
    layerDataMap[layerId] = dataSource;

    // Register a one-time global click listener if not already present
    if (!map._globalInteractionBound) {
    
        const ExcludeHighlight = ["smoke"];
        
        map.on("click", (e) => {
            
            if (window.isDrawActive?.()) return;
            const interactiveLayerIds = Object.keys(layerDataMap);
            const features = map.queryRenderedFeatures(e.point, { layers: interactiveLayerIds });

            if (features.length > 0) {
                // Mapbox guarantees features[0] is the top-most rendered feature
                const topF = features[0];
                const fullKey = layerDataMap[topF.layer.id];
                const def = LAYER_DEFS[fullKey];
                const dsKey = def?.dsKey || fullKey;
                const mapping = DATASET_SOURCE_MAP[dsKey];
                const sourceKey = (mapping && typeof mapping === "object") ? mapping.source : (mapping || dsKey);

                let coords = topF.geometry.type === "Point" ? topF.geometry.coordinates : (e.lngLat ? [e.lngLat.lng, e.lngLat.lat] : null);
                if (!coords && topF.geometry.coordinates) {
                    coords = (topF.geometry.type === "Polygon") ? topF.geometry.coordinates[0][0] : topF.geometry.coordinates[0][0][0];
                }
                if (coords && !ExcludeHighlight.includes(sourceKey)) {
                    updateRasterHoverBox?.(null);
                    highlightLocation?.(coords, topF.properties, sourceKey);
                }
                e.preventDefault();

                // [Report to Brain]
                const props = topF.properties;
                const cleanLayerId = fullKey.replace(`-${dsKey}`, "");
                
                if (sourceKey === "wildfire_news") {
                    logUserAction("view", {
                        dataset: "wildfire_news",
                        layer: "news_location",
                        filename: (props.title || "").substring(0, 100)
                    });
                } else {
                    logUserAction("click_point", {
                        dataset: sourceKey,
                        layer: cleanLayerId,
                        aqs: props.AQS || props.AQS_O3 || props.AQS_PM || props.UniqueFireIdentifier || props.attr_UniqueFireIdentifier,
                        state: props.state || "N/A"
                    });
                }
                
            } else if (e.lngLat) {
                // Raster layer fallback: iterate visible raster layers from top to bottom
                const rasterStack = (activeLayerStack || []).slice().reverse().filter(id => ExcludeLayerGroups.pngLayers.includes(id));
                for (const topRaster of rasterStack) {
                    const info = getRasterTooltipInfo?.(topRaster, e.lngLat.lng, e.lngLat.lat);
                    if (info) {
                        const coords = [info.gridLon, info.gridLat];
                        highlightLocation?.(coords, { lon: coords[0], lat: coords[1], _rawHtml: info.html }, topRaster);
                        updateRasterHoverBox?.(info, true);
                        e.preventDefault();
                        break;
                    }
                }
            }
        });
        map._globalInteractionBound = true;
    }
}

export function getAllInteractiveLayerIds() {
    const ids = [];
    Object.values(LAYER_DEFS).forEach(def => {
        def?.layers?.forEach(l => ids.push(l.id));
    });
    return ids;
}

export function ensureLayers() {
    if (!map) return;

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
                bindClick(def.hoverOn, key);
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
    
    // Check if ANY NEW actual layer (excluding hysplit) was added since last time
    // If a layer is newly checked, ALWAYS ensure its legend drawer is expanded.
    const newlyAddedIds = currentCheckedIds.filter(id => 
        id !== "hysplit" && !_cachedActiveLayerIds.includes(`layer-${id}`)
    );
    
    newlyAddedIds.forEach(id => {
        if (closedLegendIds.has(id)) {
            closedLegendIds.delete(id);
        }
    });

    const newLayerAdded = newlyAddedIds.length > 0;
    
    // [New] Participatory pseudo-layers (managed externally)
    if (window.isHysplitVisible?.()) currentCheckedIds.push("hysplit");
    
    setCachedActiveLayerIds(currentCheckedIds.map(id => `layer-${id}`));

    // 3. Handle Special Background Layers
    const EXCLUDED = ExcludeLayerGroups.liveUpdateLayers;
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

    // 4. Update Drawers Logic (removed)

    // 5. Build and Update Active Layer Stack
    const newStack = activeLayerStack.filter(id => currentCheckedIds.includes(id));
    currentCheckedIds.forEach(id => {
        if (!EXCLUDED.includes(id) && !newStack.includes(id)) newStack.push(id);
    });
    setActiveLayerStack(newStack);

    const currentDataset = getEffectiveDataset(currentDate());

    // Determine all layers that have legends
    const legendLayers = newStack.filter(id => {
        const targetKey = LAYER_DEFS[id] ? id : (id + "-" + currentDataset);
        return LAYER_DEFS[targetKey] && LAYER_DEFS[targetKey].legend;
    });

    let legendWillShow = false;

    newStack.forEach(shortId => {
        
        if (shortId === "hysplit") {
            window.moveHysplitToTop?.();
            return;
        }
        
        const targetKey = LAYER_DEFS[shortId] ? shortId : `${shortId}-${currentDataset}`;
        const def = LAYER_DEFS[targetKey];
        if (def) {
            let categoryAllowed = true;

            const isLegendLayer = legendLayers.includes(shortId);
            const isOpen = !closedLegendIds.has(shortId);

            // 핵심 수정: 살아남은 범례(Legend) 중, 현재 "아코디언이 열려있는" 모든 범례들을 지도에 보여줍니다.
            // 위성, 산불 등도 예외 없이 무조건 아코디언이 열려있어야만 지도에 보입니다.
            if (isLegendLayer && !isOpen) {
                categoryAllowed = false;
            }

            if (def.legend && categoryAllowed) legendWillShow = true;

            def.layers.forEach(l => {
                if (map.getLayer(l.id)) {
                    // Check if Point Layers are disabled and this is a point layer
                    const isPointLayer = l.type === "circle";
                    const shouldShow = (!isPointLayer || PointLayersEnabled) && categoryAllowed;

                    map.setLayoutProperty(l.id, "visibility", shouldShow ? "visible" : "none");
                    if (shouldShow) {
                        if (l.type === "raster") {
                            const anchorId = map.getStyle().layers.find(ly => 
                                ly.type === "symbol" || ly.id.includes("road") || ly.id.includes("bridge") || ly.id.includes("highway") || 
                                ly.id === "states-line" || ly.id === "states-fill" || ly.id === "states-hover"
                            )?.id;
                            map.moveLayer(l.id, anchorId);
                        } else {
                            map.moveLayer(l.id);
                        }

                        // Dynamic NA filter & shading for Point Layers
                        if (isPointLayer && l._fieldName) {
                            // 1. Color: If NA is shown, it's white. If hidden, it's transparent.
                            const naColor = NaShadingEnabled ? "#FFFFFF" : "rgba(0,0,0,0)";
                            const newColor = makeStepExpr(l._fieldName, l._breaks, l._colors, naColor);
                            map.setPaintProperty(l.id, "circle-color", newColor);

                            // 2. Stroke & Filter: If NA is hidden, also hide stroke and filter out features
                            if (!NaShadingEnabled) {
                                // Hide features that have null, undefined, or explicitly "NA/null" values
                                map.setFilter(l.id, [
                                    "all",
                                    ["has", l._fieldName],
                                    ["!=", ["get", l._fieldName], null],
                                    ["!=", ["to-number", ["get", l._fieldName], -999], -999] // Filter out NaN/null converted to -999
                                ]);
                            } else {
                                // Restore filter
                                map.setFilter(l.id, null);
                            }
                        }
                    }
                }
            });
        }
    });

    if (legendWillShow) {
        const legendDrawer = document.getElementById("LegendDrawer");
        const newsDrawer = document.getElementById("WFnewsDrawer");
        const mapPostDrawer = document.getElementById("MapPostDrawer");
        const hysplitDrawer = document.getElementById("HysplitDrawer");
        const statsDrawer = document.getElementById("FigurePageDrawer");
        const areaStatsDrawer = document.getElementById("AreaStatsDrawer");
        
        const isAreaStatsOpen = areaStatsDrawer?.classList.contains("open");
        
        const isOthersOpen = newsDrawer?.classList.contains("open") ||
            mapPostDrawer?.classList.contains("open") ||
            hysplitDrawer?.classList.contains("open") ||
            statsDrawer?.classList.contains("open");

        // UI Refinement:
        // 1. If a NEW layer checkbox was just selected, ALWAYS open the legend (per user request).
        // 2. Otherwise, only auto-open if no other drawer (that overlaps) is blocking it.
        // 3. Exception: If the Area Statistics drawer is active, NEVER auto-open the legend.
        if (legendDrawer && !legendDrawer.classList.contains("open") && !isAreaStatsOpen) {
            if (newLayerAdded || !isOthersOpen) {
                setLegendDrawer(true);
            }
        }
    } else if (legendLayers.length === 0) {
        const legendDrawer = document.getElementById("LegendDrawer");
        if (legendDrawer && legendDrawer.classList.contains("open")) {
            setLegendDrawer(false);
        }
    }

    updateLegend(newStack);
    updateStateShading?.();
}

/**
 * 전역 유틸리티: 특정 레이어를 스택의 가장 위로 이동시킴
 * @param {string} layerId 
 */
export function moveLayerToTop(layerId) {
    const stack = [...activeLayerStack];
    const idx = stack.indexOf(layerId);
    if (idx !== -1) {
        stack.splice(idx, 1);
        stack.push(layerId);
        setActiveLayerStack(stack);
        applyLayerToggles();
    }
}

// Expose to window for inline onclick handlers in Legend
if (typeof window !== "undefined") {
    window.moveLayerToTop = moveLayerToTop;
}

/**
 * 범례 아코디언 열기/닫기 개별 토글
 * @param {string} layerId 
 */
export function toggleLegendState(layerId) {
    if (closedLegendIds.has(layerId)) {
        closedLegendIds.delete(layerId);
        // 열렸으므로 맵의 맨 위로 올림 (ux 선택사항)
        moveLayerToTop(layerId);
    } else {
        closedLegendIds.add(layerId);
        applyLayerToggles();
    }
}

// Expose to window for inline onclick handlers in Legend
if (typeof window !== "undefined") {
    window.moveLayerToTop = moveLayerToTop;
    window.toggleLegendState = toggleLegendState;
}

