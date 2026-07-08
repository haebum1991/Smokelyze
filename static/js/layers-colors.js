
/**
  * 색상 및 범례 관리: 데이터 값에 따른 지도 레이어의 색상 스타일(Shading)과 범례(Legend) 생성
  */
import { ExcludeLayerGroups, LAYER_TEMPLATES, LAYER_DEFS } from "./layers-def.js";
import { 
  map, 
  activeLayerStack, 
  regionStats, 
  StateShadingEnabled, 
  NaShadingEnabled, 
  PointLayersEnabled, 
  closedLegendIds 
} from "./layers-state.js";
import { getEffectiveDataset, currentDate } from "./utils.js";


/**
 * 범례(Legend) 렌더링 함수 (최종 수정됨)
 */
export function updateLegend(activeStack = activeLayerStack) {
    const container = document.getElementById("LegendDrawerList");
    if (!container) return;

    if (!activeStack || activeStack.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding: 2rem; color:var(--text-main); font-size:1.4rem;">No active legends</div>`;
        return;
    }

    const currentDataset = getEffectiveDataset(currentDate());

    // Filter layers that have legends
    let legendLayers = [...activeStack].filter(id => {
        const targetKey = LAYER_DEFS[id] ? id : (id + "-" + currentDataset);
        return LAYER_DEFS[targetKey] && LAYER_DEFS[targetKey].legend;
    });

    if (legendLayers.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding: 2rem; color:var(--text-main); font-size:1.4rem;">No active legends</div>`;
        return;
    }

    // 아코디언처럼 범례 순서가 위아래로 점프하지 않도록, 사이드바 메뉴(DOM)의 고정 순서대로 정렬합니다.
    const allCheckboxes = Array.from(document.querySelectorAll("input[type=checkbox][id^='layer-']")).map(cb => cb.id.replace("layer-", ""));
    legendLayers.sort((a, b) => {
        let idxA = allCheckboxes.indexOf(a);
        let idxB = allCheckboxes.indexOf(b);
        if (idxA === -1) idxA = 999;
        if (idxB === -1) idxB = 999;
        return idxA - idxB;
    });

    // 현재 켜진 범례들 중에서, 실제 지도상 가장 윗단(Top)에 있는 레이어 ID를 찾아 아코디언을 열어줍니다.
    const topLegendLayerId = [...activeStack].reverse().find(id => legendLayers.includes(id));

    let finalHtml = "";

    legendLayers.forEach((id) => {
        const fullKey = LAYER_DEFS[id] ? id : `${id}-${currentDataset}`;
        const layerDef = LAYER_DEFS[fullKey];
        const conf = layerDef?.legend;
        if (!conf) return;
        
        // Dynamic rendering flags
        let renderShading = true;
        let renderPoints = true;
        let headerTitle = conf.title;

        // If a layer has BOTH Shading (colors) and Point (sizeLegend) components,
        // we can automatically sync its legend display with the global toggles!
        if (conf.sizeLegend && conf.colors && conf.colors.length > 0) {
            if (!StateShadingEnabled) renderShading = false;
            if (!PointLayersEnabled) renderPoints = false;

            // Adjust main header title if only one is showing
            if (!renderShading && renderPoints) {
                headerTitle = conf.sizeLegend.title || headerTitle;
            } else if (renderShading && !renderPoints) {
                headerTitle = conf.title;
            } else if (!renderShading && !renderPoints) {
                headerTitle = `${conf.title.split(' ')[0]} (Disabled)`;
            }
        }

        // Is this legend manually opened? (By default, checked layers are open, unless explicitly closed)
        const isOpen = !closedLegendIds.has(id);

        let displayTitle = headerTitle;
        if (conf.unit && !headerTitle.includes("(Disabled)")) {
            if (conf.continuous) {
                displayTitle = `<span style="display:flex; flex-direction:column; line-height:1.2;">
                                    <span>${headerTitle}</span>
                                    <span>(${conf.unit})</span>
                                </span>`;
            } else {
                displayTitle = `${headerTitle} (${conf.unit})`;
            }
        }

        let sectionHtml = `<div class="legend-section ${isOpen ? 'is-top' : ''}" data-layer-id="${id}">`;
        sectionHtml += `<div class="legend-header" onclick="window.toggleLegendState('${id}')">
                           <span class="legend-title">${displayTitle}</span>
                           <span class="legend-badge"></span>
                        </div>`;

        sectionHtml += `<div class="legend-content">`;
        
        // headerOnly mode: show toggle header but no color scale (for true-color imagery layers)
        if (conf.headerOnly) {
            const mapLayerId = layerDef?.layers?.[0]?.id || `${id}-raster`;
            let currentOpacity = 0.9;
            if (map && map.getLayer(mapLayerId)) {
                try {
                    const val = map.getPaintProperty(mapLayerId, "raster-opacity");
                    if (typeof val === "number") currentOpacity = val;
                } catch (e) {}
            }
            const pct = Math.round(currentOpacity * 100);

            sectionHtml += `<div class="legend-item" style="display:flex; flex-direction:column; gap:0.4rem; padding: 0.4rem 0.2rem; width:100%; align-items:stretch;">
                                <div style="display:flex; justify-content:space-between; width:100%; font-size:1.2rem; color:var(--text-main);">
                                    <span>Opacity</span>
                                    <span class="opacity-val-${id}" style="font-weight:bold;">${pct}%</span>
                                </div>
                                <input type="range" class="legend-opacity-slider" data-layer-id="${mapLayerId}" data-id="${id}" min="0" max="100" value="${pct}" style="width:100%; cursor:pointer; accent-color:var(--card-shadow); margin: 0.2rem 0;">
                            </div>`;
            sectionHtml += `</div></div>`;
            finalHtml += sectionHtml;
            return; // skip rest of this iteration
        }
        
        // Point data (circle layers) → round swatches, others (fill/polygon) → square
        const isCircleLayer = layerDef?.layers?.[0]?.type === "circle" && !conf.sizeLegend;
        const swatchClass = isCircleLayer ? "legend-color-circle" : "legend-color-rect";

        if (conf.continuous) {
            const { min, max, colors, breaks, unit } = conf;
            const legendBreaks = breaks || [];
            const grad = `linear-gradient(to right, ${colors.join(", ")})`;
            
            // 가로형에서는 왼쪽에서 오른쪽으로 라벨 배치
            const tickHtml = legendBreaks.map(b => {
                return `<div style="flex:1; text-align:center;">
                            <span style="font-size:1.1rem; color:var(--text-main);">${b}</span>
                        </div>`;
            }).join("");

            // Determine descriptive label (e.g., Amount of NO2)
            const substance = id.includes("no2") ? "NO₂" : id.includes("hcho") ? "HCHO" : "";

            sectionHtml += `
                <div class="legend-item-continuous">
                    <!-- 컬러바 -->
                    <div style="height:1.6rem; background-image:${grad}; background-repeat:no-repeat; background-size:100% 100%; border: 0.1rem solid rgba(255,255,255,0.2); margin-bottom: 0.2rem;"></div>
                    
                    <!-- 수치 라벨 -->
                    <div style="display:flex; justify-content:space-between; color:var(--text-main); padding: 0 0.2rem;">
                        ${tickHtml}
                    </div>
                </div>
            `;
            
        } else if (conf.labels) {
            const offset = Math.max(0, conf.colors.length - conf.labels.length);
            conf.labels.forEach((label, i) => {
                const color = conf.colors[i + offset];
                if (color) {
                    sectionHtml += `<div class="legend-item">
                                        <span class="${swatchClass}" style="background:${color}"></span>
                                        <span>${label}</span>
                                    </div>`;
                }
            });
        } else {
        
            const { breaks, colors } = conf;
            
            if (renderShading) {
                if (!breaks || breaks.length === 0) {
                    sectionHtml += `<div class="legend-item">
                                        <span class="${swatchClass}" style="background:${colors[0]}"></span>
                                        <span>${conf.title}</span>
                                    </div>`;
                } else if (id.startsWith("pm25-smoke")) {
                    sectionHtml += `<div class="legend-item">
                                        <span class="${swatchClass}" style="background:#CCCCCC; border:0.1rem solid var(--text-main);"></span>
                                        <span>0</span>
                                    </div>`;
                    sectionHtml += `<div class="legend-item">
                                        <span class="${swatchClass}" style="background:${colors[0]}"></span>
                                        <span>> 0 to &lt; ${breaks[0]}</span>
                                    </div>`;
                    for (let i = 0; i < breaks.length - 1; i++) {
                        sectionHtml += `<div class="legend-item">
                                            <span class="${swatchClass}" style="background:${colors[i + 1]}"></span>
                                            <span>${breaks[i]} to &lt; ${breaks[i + 1]}</span>
                                        </div>`;
                    }
                    sectionHtml += `<div class="legend-item">
                                        <span class="${swatchClass}" style="background:${colors[colors.length - 1]}"></span>
                                        <span>&ge; ${breaks[breaks.length - 1]}</span>
                                    </div>`;
                } else {
                    sectionHtml += `<div class="legend-item">
                                        <span class="${swatchClass}" style="background:${colors[0]}"></span>
                                        <span>&lt; ${breaks[0]}</span>
                                    </div>`;
                    for (let i = 0; i < breaks.length - 1; i++) {
                        sectionHtml += `<div class="legend-item">
                                            <span class="${swatchClass}" style="background:${colors[i + 1]}"></span>
                                            <span>${breaks[i]} to &lt; ${breaks[i + 1]}</span>
                                        </div>`;
                    }
                    sectionHtml += `<div class="legend-item">
                                        <span class="${swatchClass}" style="background:${colors[colors.length - 1]}"></span>
                                        <span>&ge; ${breaks[breaks.length - 1]}</span>
                                    </div>`;
                }
            }
        }

        // Add Size Legend Section if exists
        if (conf.sizeLegend && renderPoints) {
            
            if (conf.colors && conf.colors.length > 0 && renderShading) {
                sectionHtml += `<hr class="legend-divider">`;
            }
            
            if (renderShading) {
                sectionHtml += `<div class="legend-header-sub">${conf.sizeLegend.title}</div>`;
            }
            
            conf.sizeLegend.items.forEach(item => {
                const sizeRem = (item.radius * 2 / 10) + "rem";
                sectionHtml += `<div class="legend-item" style="align-items: center;">
                                   <span style="display:inline-block; width:2.6rem; text-align:center; margin-right:0.4rem;">
                                     <span style="display:inline-block; border-radius:50%; background:${conf.sizeLegend.color}; width:${sizeRem}; height:${sizeRem}; border:0.3rem solid ${conf.sizeLegend.strokeColor}; vertical-align:middle;"></span>
                                   </span>
                                   <span>${item.label}</span>
                                 </div>`;
            });
        }

        // Add NA indicator if enabled
        const skipNALayers = [...(ExcludeLayerGroups.satelliteLayers || []), ...ExcludeLayerGroups.liveUpdateLayers];
        if (!skipNALayers.includes(id) && NaShadingEnabled) {
            sectionHtml += `<hr class="legend-divider">
                             <div class="legend-item">
                               <span class="${swatchClass}" style="background:#ffffff; border: 0.1rem solid var(--text-main);"></span>
                               <span>N/A</span>
                             </div>`;
        }

        sectionHtml += `</div></div>`; // End of legend-content and legend-section
        finalHtml += sectionHtml;
    });

    container.innerHTML = finalHtml;
    container.style.display = "block";
    
    // Bind events to opacity sliders
    const sliders = container.querySelectorAll(".legend-opacity-slider");
    sliders.forEach(slider => {
        slider.addEventListener("input", (e) => {
            const val = parseFloat(e.target.value) / 100;
            const lyrId = e.target.getAttribute("data-layer-id");
            const rawId = e.target.getAttribute("data-id");

            if (map && map.getLayer(lyrId)) {
                try {
                    map.setPaintProperty(lyrId, "raster-opacity", val);
                } catch (err) {
                    console.error("Failed to set raster opacity", err);
                }
            }

            const label = container.querySelector(`.opacity-val-${rawId}`);
            if (label) {
                label.textContent = `${e.target.value}%`;
            }
        });
    });
}

/**
 * Feature: Layer Color Indicators
 */
export function updateLayerToggleColors() {
    const dataset = getEffectiveDataset(currentDate());
    if (!dataset) return;

    const getGradientStyle = (colors) => {
        if (!colors || colors.length === 0) return "transparent";
        let valid = colors.filter(c => !c.includes("rgba") || !c.includes(", 0)"));
        if (valid.length === 0 && colors.length > 0) valid = [colors[colors.length - 1]];
        if (valid.length === 1) return valid[0];
        return `linear-gradient(to right, ${valid.join(", ")})`;
    };

    const checkboxes = document.querySelectorAll("input[type=checkbox][id^='layer-']");
    checkboxes.forEach(cb => {
        const shortId = cb.id.replace("layer-", "");
        const dot = cb.parentElement.querySelector(".layer-dot");
        if (!dot) return;

        const fullKey = LAYER_DEFS[shortId] ? shortId : `${shortId}-${dataset}`;
        const layerDef = LAYER_DEFS[fullKey];

        if (layerDef?.legend?.colors) {
            dot.style.background = getGradientStyle(layerDef.legend.colors);
        } else {
            dot.style.background = "transparent";
        }
    });
}

/**
 * Feature: State Shading (Coloring)
 */
export function updateStateShading() {
    if (!map) { console.log("[STATE-SHADING] No map"); return; }
    if (!activeLayerStack || activeLayerStack.length === 0 || !StateShadingEnabled) {
        console.log("[STATE-SHADING] Disabled or no active layers.", { stackLen: activeLayerStack?.length, enabled: StateShadingEnabled });
        if (map.getLayer("states-fill")) map.setPaintProperty("states-fill", "fill-opacity", 0);
        return;
    }

    const EXCLUDED = ExcludeLayerGroups.stateShading;
    const stack = activeLayerStack.filter(id => {
        if (EXCLUDED.includes(id)) return false;
        if (closedLegendIds.has(id)) return false;
        return true;
    });

    if (stack.length === 0) {
        console.log("[STATE-SHADING] After exclusion, stack is empty. activeLayerStack:", [...activeLayerStack], "excluded:", EXCLUDED);
        if (map.getLayer("states-fill")) map.setPaintProperty("states-fill", "fill-opacity", 0);
        return;
    }
    const topId = stack[stack.length - 1];

    const dataset = getEffectiveDataset(currentDate());
    const fullKey = LAYER_DEFS[topId] ? topId : `${topId}-${dataset}`;
    const def = LAYER_DEFS[fullKey];

    console.log("[STATE-SHADING] topId:", topId, "fullKey:", fullKey, "def exists:", !!def, "regionStats keys:", Object.keys(regionStats).length);

    if (!def?.legend?.breaks || !def?.legend?.colors) {
        console.log("[STATE-SHADING] No legend breaks/colors for", fullKey);
        if (map.getLayer("states-fill")) map.setPaintProperty("states-fill", "fill-opacity", 0);
        return;
    }

    const { breaks, colors } = def.legend;

    const getColor = (val) => {
        if (val === null || val === undefined || isNaN(val)) return null;
        if (topId.startsWith("pm25-smoke") && val <= 0) {
            return "#CCCCCC";
        }
        for (let i = 0; i < breaks.length; i++) {
            if (val < breaks[i]) return colors[i];
        }
        return colors[colors.length - 1];
    };

    const rules = [];
    let hasData = false;

    Object.keys(regionStats).forEach(stateName => {
        const stats = regionStats[stateName];
        if (!stats) return;

        const tmpl = LAYER_TEMPLATES.find(t => t.id === topId);
        const key = tmpl?.manualLayer ? tmpl.field : topId;
        const val = stats[key];

        if (val === null || val === undefined || val === "" || val === "NA") return;
        if (typeof val === "string" && val.includes("/")) return;

        const numVal = Number(val);
        const c = getColor(numVal);
        if (c) {
            rules.push(stateName);
            rules.push(c);
            hasData = true;
        }
    });

    console.log("[STATE-SHADING] Result:", { hasData, rulesCount: rules.length / 2, topId });

    if (hasData) {
        const matchExpr = ["match", ["coalesce", ["get", "ID"], ["get", "name"], ["get", "NAME"], ["get", "STUSPS"], ""]];
        rules.forEach(r => matchExpr.push(r));
        matchExpr.push(NaShadingEnabled ? "#FFFFFF" : "rgba(0,0,0,0)"); // Default (NA) color

        if (map.getLayer("states-fill")) {
            map.setPaintProperty("states-fill", "fill-color", matchExpr);
            map.setPaintProperty("states-fill", "fill-opacity", 0.4);
        }
    } else {
        if (map.getLayer("states-fill")) map.setPaintProperty("states-fill", "fill-opacity", 0);
    }
}

document.addEventListener("legendUpdate", () => {
    updateLegend();
});

