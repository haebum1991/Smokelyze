
/**
  * 색상 및 범례 관리: 데이터 값에 따른 지도 레이어의 색상 스타일(Shading)과 범례(Legend) 생성
  */
import { ExcludeLayerGroups, LAYER_TEMPLATES, LAYER_DEFS } from "./layers-def.js";
import { map, activeLayerStack, regionStats, StateShadingEnabled, NaShadingEnabled } from "./layers-state.js";

/**
 * 범례(Legend) 렌더링 함수 (최종 수정됨)
 */
export function updateLegend(activeStack) {
    const container = document.getElementById("MapLegend");
    if (!container) return;

    if (!activeStack || activeStack.length === 0) {
        container.style.display = "none";
        container.innerHTML = "";
        return;
    }

    const currentDataset = document.getElementById("MapDataSelect")?.value;

    // Filter layers that have legends
    const legendLayers = [...activeStack].reverse().filter(id => {
        const targetKey = LAYER_DEFS[id] ? id : (id + "-" + currentDataset);
        return LAYER_DEFS[targetKey] && LAYER_DEFS[targetKey].legend;
    });

    if (legendLayers.length === 0) {
        container.style.display = "none";
        container.innerHTML = "";
        return;
    }

    let finalHtml = "";

    legendLayers.forEach((id, index) => {
        const fullKey = LAYER_DEFS[id] ? id : `${id}-${currentDataset}`;
        const layerDef = LAYER_DEFS[fullKey];
        const conf = layerDef?.legend;
        if (!conf) return;

        // Is this the very top layer in the stack? (index 0 because we reversed)
        const isTop = index === 0;

        let sectionHtml = `<div class="legend-section ${isTop ? 'is-top' : ''}" data-layer-id="${id}">`;
        sectionHtml += `<div class="legend-header" onclick="window.moveLayerToTop('${id}')">
                           <span class="legend-title">${conf.title}</span>
                           <span class="legend-badge">${(isTop && legendLayers.length >= 2) ? 'TOP' : ''}</span>
                        </div>`;

        sectionHtml += `<div class="legend-content">`;

        // Point data (circle layers) → round swatches, others (fill/polygon) → square
        const isCircleLayer = layerDef?.layers?.[0]?.type === "circle" && !conf.sizeLegend;
        const swatchClass = isCircleLayer ? "legend-color-circle" : "legend-color-rect";

        if (conf.labels) {
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
            if (!breaks || breaks.length === 0) {
                sectionHtml += `<div class="legend-item">
                                    <span class="${swatchClass}" style="background:${colors[0]}"></span>
                                    <span>${conf.title}</span>
                                </div>`;
            } else {
                sectionHtml += `<div class="legend-item">
                                    <span class="${swatchClass}" style="background:${colors[0]}"></span>
                                    <span>&lt; ${breaks[0]}</span>
                                </div>`;
                for (let i = 0; i < breaks.length - 1; i++) {
                    sectionHtml += `<div class="legend-item">
                                        <span class="${swatchClass}" style="background:${colors[i + 1]}"></span>
                                        <span>${breaks[i]} to ${breaks[i + 1]}</span>
                                    </div>`;
                }
                sectionHtml += `<div class="legend-item">
                                    <span class="${swatchClass}" style="background:${colors[colors.length - 1]}"></span>
                                    <span>&ge; ${breaks[breaks.length - 1]}</span>
                                </div>`;
            }
        }

        // Add Size Legend Section if exists
        if (conf.sizeLegend) {
            sectionHtml += `<hr class="legend-divider">`;
            sectionHtml += `<h4>${conf.sizeLegend.title}</h4>`;
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
}

/**
 * Feature: Layer Color Indicators
 */
export function updateLayerToggleColors() {
    const dataset = document.getElementById("MapDataSelect")?.value;
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
    if (!map) return;
    if (!activeLayerStack || activeLayerStack.length === 0 || !StateShadingEnabled) {
        if (map.getLayer("states-fill")) map.setPaintProperty("states-fill", "fill-opacity", 0);
        return;
    }

    const EXCLUDED = ExcludeLayerGroups.stateShading;
    const stack = activeLayerStack.filter(id => !EXCLUDED.includes(id));

    if (stack.length === 0) {
        if (map.getLayer("states-fill")) map.setPaintProperty("states-fill", "fill-opacity", 0);
        return;
    }
    const topId = stack[stack.length - 1];

    const dataset = document.getElementById("MapDataSelect")?.value;
    const fullKey = LAYER_DEFS[topId] ? topId : `${topId}-${dataset}`;
    const def = LAYER_DEFS[fullKey];

    if (!def?.legend?.breaks || !def?.legend?.colors) {
        if (map.getLayer("states-fill")) map.setPaintProperty("states-fill", "fill-opacity", 0);
        return;
    }

    const { breaks, colors } = def.legend;

    const getColor = (val) => {
        if (val === null || val === undefined || isNaN(val)) return null;
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

