
import { ExcludeLayerGroups, LAYER_TEMPLATES, DATASET_SOURCE_MAP } from "./layers-def.js";
import { resetUIAndData, resetAccordionDetails, resetMapViewToDefault } from "./ui-reset.js";
import * as utils from "./utils.js";

export let onCurrentPlotHide = null;
export function setOnCurrentPlotHide(fn) { onCurrentPlotHide = fn; }

export let selectedRegionsByMetric = {};
export let onRenderLinePlot = null;
export function setOnRenderLinePlot(fn) { onRenderLinePlot = fn; }

export let onUpdateDailyStats = null;
export function setOnUpdateDailyStats(fn) { onUpdateDailyStats = fn; }

export let onUpdateYearStats = null;
export function setOnUpdateYearStats(fn) { onUpdateYearStats = fn; }

export let currentMonthKey = "all";
export function setCurrentMonthKey(k) { currentMonthKey = k; }

const expandState = {
    date: { us: false, ca: false },
    year: { us: false, ca: false }
};

export const usStates = [
    "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "District of Columbia", 
    "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland",
    "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
    "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania",
    "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
    "West Virginia", "Wisconsin", "Wyoming"
];

export const caStates = [
    "Alberta", "British Columbia", "Manitoba", "New Brunswick", "Newfoundland and Labrador", "Northwest Territories",
    "Nova Scotia", "Nunavut", "Ontario", "Prince Edward Island", "Quebec", "Saskatchewan", "Yukon"
];

export const regionIDs = ["US_conus", "US", ...usStates, "Canada", ...caStates, "Mexico"];

export function createBurnStats(regionIDs) { const out = {}; regionIDs.forEach(id => { out[id] = null; }); return out; }
export function createSmokeStats(regionIDs) { const out = {}; regionIDs.forEach(id => { out[id] = { light: null, medium: null, heavy: null }; }); return out; }
export function createFireStats(regionIDs) { const out = {}; regionIDs.forEach(id => { out[id] = { count: null, frpTotal: null, n: 0 }; }); return out; }
export function createModelStats(regionIDs) { const out = {}; regionIDs.forEach(id => { out[id] = {}; }); return out; }

export function setupExpandControls(tbody, scopeKey) {
    const applyExpand = (target, expanded) => {
        const selector = `.stats-expand-btn[stats-data-target='${target}']`;
        const btn = tbody.querySelector(selector);
        const rows = target === "us" ? tbody.querySelectorAll("tr.stats-state-row-us") : tbody.querySelectorAll("tr.stats-state-row-ca");
        if (!btn) return;
        rows.forEach(tr => {
            if (expanded) tr.classList.add("show");
            else tr.classList.remove("show");
        });
        btn.classList.toggle("expanded", expanded);
        btn.textContent = expanded ? "↑" : "↓";
    };

    const state = expandState[scopeKey] || { us: false, ca: false };
    applyExpand("us", state.us);
    applyExpand("ca", state.ca);

    tbody.querySelectorAll(".stats-expand-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const target = btn.getAttribute("stats-data-target");
            const expanding = !btn.classList.contains("expanded");
            expandState[scopeKey][target] = expanding;
            applyExpand(target, expanding);
        });
    });
}

export function setupPlotClickHandlers(tbody, scopeKey) {
    if (scopeKey !== "year") return;
    if (currentMonthKey !== "all") return;

    tbody.querySelectorAll(".stats-plot-for-line-year").forEach(cell => {
        const regionId = cell.getAttribute("data-region");
        const metric = cell.getAttribute("data-metric");
        if (!regionId) return;

        if (!selectedRegionsByMetric[metric]) selectedRegionsByMetric[metric] = [];
        const list = selectedRegionsByMetric[metric];

        if (list.indexOf(regionId) !== -1) cell.classList.add("active");

        cell.style.cursor = "pointer";
        cell.title = "Click to toggle plot";
        cell.addEventListener("click", () => {
            const arr = selectedRegionsByMetric[metric] || [];
            const idx = arr.indexOf(regionId);
            if (idx === -1) {
                arr.push(regionId);
                cell.classList.add("active");
            } else {
                arr.splice(idx, 1);
                cell.classList.remove("active");
            }
            selectedRegionsByMetric[metric] = arr;

            let hasSelection = false;
            const allMetrics = Object.keys(selectedRegionsByMetric);
            for (let i = 0; i < allMetrics.length; i++) {
                if (selectedRegionsByMetric[allMetrics[i]].length > 0) {
                    hasSelection = true;
                    break;
                }
            }

            const panel = cell.closest(".stats-plot-tab-panel");
            if (panel) {
                const lineTab = panel.querySelector(".stats-plot-tab-sub[stats-plot-target='stats-plot-for-line-year']");
                if (lineTab) {
                    lineTab.style.display = hasSelection ? "inline-block" : "none";
                }
            }

            if (onRenderLinePlot) onRenderLinePlot("stats-plot-for-line-year");
        });
    });
}


/**
 * Get all active layers for the Model Stats table, grouped by their category (e.g., Dataset or AirNow).
 */
export function getActiveModelLayers() {
    const layers = [];
    const templates = LAYER_TEMPLATES || [];

    const select = document.getElementById("MapDataSelect");
    let currentDatasetLabel = "Model statistics";
    if (select?.selectedOptions?.length > 0) {
        currentDatasetLabel = select.selectedOptions[0].text.split("(")[0].trim();
    }

    document.querySelectorAll("input[type=checkbox][id^='layer-']").forEach(cb => {
        const lbl = cb.closest("label");
        if (!lbl || lbl.style.display === "none") return;
        if (!cb.checked) return;

        const shortId = cb.id.replace("layer-", "");
        const tmpl = templates.find(t => t.id === shortId);

        const EXCLUDED = ExcludeLayerGroups.modelTable;
        if (EXCLUDED.includes(shortId)) return;

        if (tmpl) {
            const rawLabel = (lbl.innerText || lbl.textContent || shortId).trim();
            let group = currentDatasetLabel;
            if (shortId.startsWith("airnow-") || tmpl.hourly) {
                group = "AirNow";
            }

            layers.push({ id: shortId, label: rawLabel, group: group });
        }
    });
    return layers;
}


/**
 * Rebuilds the thead element for the stats table based on active layers.
 * Groups columns logically and uses rowspans/colspans for a clean look.
 */
export function rebuildStatsHeader(thead, activeModelLayers) {
    thead.innerHTML = "";

    const tr1 = document.createElement("tr");
    const tr2 = document.createElement("tr");

    // 1. Region Column (Fixed)
    const thRegion = document.createElement("th");
    thRegion.rowSpan = 2;
    thRegion.textContent = "Region";
    tr1.appendChild(thRegion);

    // 2. Model & AirNow Group Headers
    if (activeModelLayers.length > 0) {
        const groups = [];
        activeModelLayers.forEach(layer => {
            const lastGroup = groups[groups.length - 1];
            if (lastGroup && lastGroup.name === layer.group) {
                lastGroup.count++;
            } else {
                groups.push({ name: layer.group, count: 1 });
            }
        });

        groups.forEach(group => {
            const thGroup = document.createElement("th");
            thGroup.colSpan = group.count;
            thGroup.textContent = group.name;
            thGroup.className = "col-model-head";
            tr1.appendChild(thGroup);
        });

        activeModelLayers.forEach(layer => {
            const thSub = document.createElement("th");
            thSub.textContent = layer.label;
            thSub.title = layer.label;
            thSub.className = "col-model-head";
            tr2.appendChild(thSub);
        });
    }

    // 3. Satellite Data Groups (Unified)
    const satConfigs = [
        { id: "burn", group: "burn", label: "Area burned (km²)", subLabels: [""] },
        { id: "smoke", group: "smoke", label: "Smoke area (km²)", subLabels: ["L", "M", "H"] },
        { id: "fire", group: "fire", label: "HMS-fire", subLabels: ["Fire points", "FRP (MW)"] }
    ];

    satConfigs.forEach(cfg => {
        const cb = document.getElementById(`layer-${cfg.id}`);
        if (!cb || !cb.checked) return;

        const th1 = document.createElement("th");
        th1.textContent = cfg.label;
        th1.className = "col-" + cfg.group;

        if (cfg.subLabels.length > 1 || cfg.subLabels[0] !== "") {
            th1.colSpan = cfg.subLabels.length;
            tr1.appendChild(th1);
            cfg.subLabels.forEach(function (sub) {
                const th2 = document.createElement("th");
                th2.textContent = sub;
                th2.className = "col-" + cfg.group;
                tr2.appendChild(th2);
            });
        } else {
            th1.rowSpan = 2;
            tr1.appendChild(th1);
        }
    });

    thead.appendChild(tr1);
    thead.appendChild(tr2);
}

export function getModelStatsCells(regionID, modelStats, activeLayers) {
    let html = "";
    const stats = modelStats[regionID] || {};

    activeLayers.forEach(layer => {
        const value = stats[layer.id];
        let formattedValue = "NA";
        if (value !== null && value !== undefined) {
            if (typeof value === "number") {
                let decimals = 0;
                const tmpl = LAYER_TEMPLATES.find(t => t.id === layer.id);

                if (tmpl && tmpl.decimals !== undefined) {
                    decimals = tmpl.decimals;
                }

                formattedValue = utils.ESML(value.toFixed(decimals));

            } else {
                formattedValue = utils.ESML(String(value));
            }
        }

        // [Added] Special formatting for Exceedance layers (Green | Red)
        if (layer.id.startsWith("ExcDays")) {
            const c1 = stats[`${layer.id}_c1`];
            const c2 = stats[`${layer.id}_c2`];
            const all = (c1 || 0) + (c2 || 0);

            if (c1 !== undefined || c2 !== undefined) {
                formattedValue = `
                      <span style="font-weight:bold;">${utils.ESML(String(all))}</span> | 
                      <span style="color:green; font-weight:bold;">${utils.ESML(String(c1 || 0))}</span> | 
                      <span style="color:red; font-weight:bold;">${utils.ESML(String(c2 || 0))}</span>
                    `;
            }
        }

        html += `<td class='slot-cell col-model'><span class='slot-roll'>${formattedValue}</span></td>`;
    });
    return html;
}

export function renderStatsTable(regionIDs, burnStats, smokeStats, fireStats, tableID, modelStats) {
    const tbody = document.getElementById(tableID);
    if (!tbody) return;
    const thead = tbody.previousElementSibling;
    const theme = getPlotTheme();

    modelStats = modelStats || {};

    const isDailyTable = (tableID === "StatsRegionBodyDate");
    let activeModelLayers = [];

    if (isDailyTable) {
        activeModelLayers = getActiveModelLayers();
        if (thead) rebuildStatsHeader(thead, activeModelLayers);
    }

    const ChkBoxBurn = document.getElementById("layer-burn");
    const ChkBoxSmoke = document.getElementById("layer-smoke");
    const ChkBoxFire = document.getElementById("layer-fire");
    const showBurn = !ChkBoxBurn || ChkBoxBurn.checked;
    const showSmoke = !ChkBoxSmoke || ChkBoxSmoke.checked;
    const showFire = !ChkBoxFire || ChkBoxFire.checked;
    const showModel = activeModelLayers.length > 0;

    const tableWrapper = tbody.closest(".stats-table-responsive-date, .stats-table-responsive-year");
    const container = tableWrapper ? tableWrapper.parentElement : null;
    if (!container) return;

    let msgBox = container.querySelector(".stats-empty-msg-table");

    const hasContent = showBurn || showSmoke || showFire || showModel;
    if (!hasContent) {
        if (tableWrapper) tableWrapper.style.display = "none";
        if (!msgBox) {
            msgBox = document.createElement("div");
            msgBox.className = "stats-empty-msg-table";
            container.appendChild(msgBox);
        }
        msgBox.style.display = "block";
        renderPlotMessage(msgBox, theme.messages.table);
        return;
    }
    if (tableWrapper) tableWrapper.style.display = "block";
    if (msgBox) {
        msgBox.style.display = "none";
        msgBox.innerHTML = "";
    }


    const applyColDisplay = (cls, show) => {
        document.querySelectorAll(`.${cls}`).forEach(el => { el.style.display = show ? "" : "none"; });
    };
    applyColDisplay("col-burn", showBurn);
    applyColDisplay("col-smoke", showSmoke);
    applyColDisplay("col-fire", showFire);

    const breakIdsBot = ["US", "Canada", "Wyoming", "Yukon"];
    let html = "";
    const isYear = (tableID === "StatsRegionBodyYear");

    regionIDs.forEach(id => {
        const burn = (burnStats[id] !== undefined) ? burnStats[id] : null;
        const smoke = smokeStats[id] || { light: null, medium: null, heavy: null };
        const fire = fireStats[id] || { count: null, frpTotal: null, n: 0 };
        const fireFrp = (fire.n > 0 && fire.frpTotal !== null) ? fire.frpTotal / fire.n : null;

        const fmt = (val, dec) => {
            if (val === null || val === undefined) return "NA";
            return val.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec });
        };

        const isUSState = usStates.indexOf(id) !== -1;
        const isCAState = caStates.indexOf(id) !== -1;
        const classList = [];
        if (breakIdsBot.indexOf(id) !== -1) classList.push("stats-section-break-bot");
        if (isUSState) classList.push("stats-state-row-us");
        if (isCAState) classList.push("stats-state-row-ca");
        const trClassAttr = classList.length ? ` class='${classList.join(" ")}'` : "";

        const regionLabelBase = utils.ESML(id);
        let regionLabel = regionLabelBase;
        if (id === "US") regionLabel += " <button type='button' class='stats-expand-btn' stats-data-target='us'>↓</button>";
        if (id === "Canada") regionLabel += " <button type='button' class='stats-expand-btn' stats-data-target='ca'>↓</button>";

        const modelCells = isDailyTable ? getModelStatsCells(id, modelStats, activeModelLayers) : "";

        const burnDec = getMetricInfo("burn").decimals;
        const smokeLightDec = getMetricInfo("smokeLight").decimals;
        const smokeMediumDec = getMetricInfo("smokeMedium").decimals;
        const smokeHeavyDec = getMetricInfo("smokeHeavy").decimals;
        const fireCountDec = getMetricInfo("fireCount").decimals;
        const fireFrpDec = getMetricInfo("fireFrp").decimals;

        if (isYear) {
            const enablePlotClick = currentMonthKey === "all";
            const baseClass = `slot-cell${enablePlotClick ? " stats-plot-for-line-year" : ""}`;

            html += `
                <tr${trClassAttr}>
                    <td>${regionLabel}</td>
                    <td class='${baseClass} col-burn' data-region='${utils.ESML(id)}' data-metric='burn'><span class='slot-roll'>${utils.ESML(fmt(burn, burnDec))}</span></td>
                    <td class='${baseClass} col-smoke' data-region='${utils.ESML(id)}' data-metric='smokeLight'><span class='slot-roll'>${utils.ESML(fmt(smoke.light, smokeLightDec))}</span></td>
                    <td class='${baseClass} col-smoke' data-region='${utils.ESML(id)}' data-metric='smokeMedium'><span class='slot-roll'>${utils.ESML(fmt(smoke.medium, smokeMediumDec))}</span></td>
                    <td class='${baseClass} col-smoke' data-region='${utils.ESML(id)}' data-metric='smokeHeavy'><span class='slot-roll'>${utils.ESML(fmt(smoke.heavy, smokeHeavyDec))}</span></td>
                    <td class='${baseClass} col-fire' data-region='${utils.ESML(id)}' data-metric='fireCount'><span class='slot-roll'>${utils.ESML(fmt(fire.count, fireCountDec))}</span></td>
                    <td class='${baseClass} col-fire' data-region='${utils.ESML(id)}' data-metric='fireFrp'><span class='slot-roll'>${utils.ESML(fmt(fireFrp, fireFrpDec))}</span></td>
                </tr>`;
        } else {
            html += `
                <tr${trClassAttr}>
                    <td>${regionLabel}</td>
                    ${modelCells}
                    <td class='slot-cell col-burn'><span class='slot-roll'>${utils.ESML(fmt(burn, burnDec))}</span></td>
                    <td class='slot-cell col-smoke'><span class='slot-roll'>${utils.ESML(fmt(smoke.light, smokeLightDec))}</span></td>
                    <td class='slot-cell col-smoke'><span class='slot-roll'>${utils.ESML(fmt(smoke.medium, smokeMediumDec))}</span></td>
                    <td class='slot-cell col-smoke'><span class='slot-roll'>${utils.ESML(fmt(smoke.heavy, smokeHeavyDec))}</span></td>
                    <td class='slot-cell col-fire'><span class='slot-roll'>${utils.ESML(fmt(fire.count, fireCountDec))}</span></td>
                    <td class='slot-cell col-fire'><span class='slot-roll'>${utils.ESML(fmt(fireFrp, fireFrpDec))}</span></td>
                </tr>`;
        }
    });

    tbody.innerHTML = html;

    const scopeKey = isYear ? "year" : "date";
    setupExpandControls(tbody, scopeKey);
    setupPlotClickHandlers(tbody, scopeKey);

    applyColDisplay("col-burn", showBurn);
    applyColDisplay("col-smoke", showSmoke);
    applyColDisplay("col-fire", showFire);

    setTimeout(updateStickyHeaderOffsets, 0);
}

export function clearPlotSelectionForLayer(layerId) {
    if (!selectedRegionsByMetric) return;
    let metricsToClear = [];
    if (layerId === "layer-burn") metricsToClear = ["burn"];
    else if (layerId === "layer-smoke") metricsToClear = ["smokeLight", "smokeMedium", "smokeHeavy"];
    else if (layerId === "layer-fire") metricsToClear = ["fireCount", "fireFrp"];
    metricsToClear.forEach(m => { delete selectedRegionsByMetric[m]; });
}

export function updateStickyHeaderOffsets() {
    const tables = document.querySelectorAll(".stats-region-table-date, .stats-region-table-year");
    tables.forEach(table => {
        const thead = table.querySelector("thead");
        if (!thead) return;

        const rows = thead.querySelectorAll("tr");
        if (rows.length < 2) return;

        const h = rows[0].offsetHeight;
        if (h > 0) {
            rows[1].querySelectorAll("th").forEach(th => {
                th.style.top = `${h / 10}rem`;
            });
        }
    });
}

export function setupDrawerResizer() {
    const resizer = document.getElementById("DrawerResizer");
    const drawer = document.getElementById("FigurePageDrawer");
    if (!resizer || !drawer) return;

    resizer.addEventListener("mousedown", e => {
        e.preventDefault();
        document.addEventListener("mousemove", resize);
        document.addEventListener("mouseup", stopResize);
        document.body.style.cursor = "col-resize";
    });

    const resize = (e) => {
        let newWidth = e.clientX;
        // Clamp width
        if (newWidth < 300) newWidth = 300;
        if (newWidth > window.innerWidth * 0.9) newWidth = window.innerWidth * 0.9;

        document.documentElement.style.setProperty("--FigurePage-drawer-width", `${newWidth / 10}rem`);
    };

    const stopResize = () => {
        document.removeEventListener("mousemove", resize);
        document.removeEventListener("mouseup", stopResize);
        document.body.style.cursor = "";
    };
}

export function updateAllStats(isoDate, regionIDs, monthKey) {
    if (onUpdateDailyStats) onUpdateDailyStats(isoDate, regionIDs);
    if (onUpdateYearStats) onUpdateYearStats(isoDate, regionIDs, monthKey);
}

// [추가] 외부에서 테이블 갱신을 트리거하기 위한 함수
export function triggerRefresh() {
    const isoDate = utils.currentDate();
    const activeMonthBtn = document.querySelector(".stats-tab-month-main .stats-tab-month-sub.active");
    const monthKey = activeMonthBtn ? activeMonthBtn.getAttribute("stats-table-month") : "all";
    updateAllStats(isoDate, regionIDs, monthKey);
}

function bindEventsStats() {
    // Tabs logic
    const tabs = document.querySelectorAll(".stats-tab-sub");
    const panels = document.querySelectorAll(".stats-container");
    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            const target = tab.getAttribute("stats-tab-sub-data");
            if (!target) return;
            tabs.forEach(t => { t.classList.toggle("active", t === tab); });
            panels.forEach(p => { p.classList.toggle("active", p.getAttribute("stats-data-panel") === target); });
            updateStickyHeaderOffsets();
        });
    });

    // Month tabs logic
    const monthTabs = document.querySelectorAll(".stats-tab-month-main .stats-tab-month-sub");
    monthTabs.forEach(btn => {
        btn.addEventListener("click", () => {
            const monthKey = btn.getAttribute("stats-table-month");
            const val = utils.currentDate();
            if (!monthKey) return;
            monthTabs.forEach(b => { b.classList.toggle("active", b === btn); });
            if (monthKey !== "all" && onCurrentPlotHide) onCurrentPlotHide();
            if (onUpdateYearStats) onUpdateYearStats(val, regionIDs, monthKey);
        });
    });

    const resetBtn = document.getElementById("MapBtnReset");
    if (resetBtn) {
        resetBtn.addEventListener("click", () => {
            if (resetUIAndData) resetUIAndData();
            if (resetAccordionDetails) resetAccordionDetails();
            if (resetMapViewToDefault) resetMapViewToDefault();

            document.querySelectorAll(".stats-drill-back-btn").forEach(el => { el.remove(); });

            selectedRegionsByMetric = {};
            if (onCurrentPlotHide) onCurrentPlotHide();

            document.getElementById("StatsRegionBodyDate").innerHTML = "";
            document.getElementById("StatsRegionBodyYear").innerHTML = "";

            const val = utils.currentDate();
            const allMonth = document.querySelector(".stats-tab-month-main .stats-tab-month-sub[stats-table-month='all']");
            if (allMonth) allMonth.click();
            updateAllStats(val, regionIDs, "all");

            document.documentElement.style.removeProperty("--FigurePage-drawer-width");
        });
    }
}

// Plot tabs logic
export function setupPlotTabs() {
    const plotTabs = document.querySelectorAll(".stats-plot-tab-sub");
    const activeTab = document.querySelector(".stats-plot-tab-sub.active");
    if (activeTab) {
        const targetId = activeTab.getAttribute("stats-plot-target");
        if (targetId) document.body.setAttribute("data-stats-active-tab", targetId);
    }

    plotTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            const targetId = tab.getAttribute("stats-plot-target");
            if (!targetId) return;

            document.body.setAttribute("data-stats-active-tab", targetId);

            // Find the parent panel to scope this action
            const panel = tab.closest(".stats-plot-tab-panel");
            if (!panel) return;

            // Update tabs within this panel only
            const panelTabs = panel.querySelectorAll(".stats-plot-tab-sub");
            panelTabs.forEach(t => { t.classList.toggle("active", t === tab); });

            // Update containers within this panel only
            const panelContainers = panel.querySelectorAll(".stats-plot-tab-sub-container");
            panelContainers.forEach(container => {
                if (container.id === targetId) {
                    container.classList.add("active");
                    const plotDiv = container;
                    if (plotDiv && plotDiv.data && plotDiv.layout) {
                        Plotly.Plots.resize(plotDiv);
                    }
                } else {
                    container.classList.remove("active");
                }
            });
        });
    });
}

window.addEventListener("themeChanged", () => {
    const selector = [
        "#stats-plot-for-barline-date",
        "#stats-plot-for-parcoords-date",
        "#stats-plot-for-scatter-date",
        "#stats-plot-for-heatmap-year",
        "#stats-plot-for-line-year"
    ].join(", ");
    const targets = document.querySelectorAll(selector);

    targets.forEach(el => {
        el.style.transition = "opacity 0.3s ease";
        el.style.opacity = "0";
    });

    setTimeout(() => {
        if (typeof triggerRefresh === "function") triggerRefresh();

        setTimeout(() => {
            const activeTargets = document.querySelectorAll(selector);
            activeTargets.forEach(el => {
                el.style.opacity = "1";
            });
        }, 150);
    }, 300);
});

document.addEventListener("DOMContentLoaded", () => {
    if (setupDrawerResizer) {
        setupDrawerResizer();
    }
});

// ----------------------------------------------------
// Common Plot Logic (Theme, Metrics, Config)
// ----------------------------------------------------

export function getPlotTheme() {
    const styles = getComputedStyle(document.documentElement);
    const v = (name) => styles.getPropertyValue(name).trim();

    const fsRaw = v("--stats-plot-font-size");
    let fs = parseFloat(fsRaw) || 14;
    if (fsRaw.indexOf("rem") !== -1) fs *= 10;

    return {
        paper_bgcolor: v("--color-bg"),
        plot_bgcolor: v("--color-bg"),
        plot_bordercol: v("--card-shadow"),
        axisText: v("--text-main"),
        grid: v("--border-soft"),
        legendBg: v("--color-bg"),
        fontSize: fs,

        // Guide messages
        messages: {
            table: `
                    If you see this message, it could be due to the following reasons: <br>
                    - Please select at least one layer to view statistics. <br> 
                    - No data available for the selected date, layers, and/or regions. <br>
                    
                    <br> 
                    [Note] <br>
                    In the [Annual] tab, 
                    when layers such as [HMS-smoke], [HMS-fire], or [MODIS area burned] are active, 
                    a data table will be displayed. 
                    Clicking on a specific row in the table will generate a monthly line plot for that selected year.
                `.trim(),
            barline: `
                    If you see this message, it could be due to the following reasons: <br>
                    - Please select at least one layer to display the Bar & Line plots. <br> 
                    - No data available for the selected date, layers, and/or regions. <br>
                    - No compatible data points found to create a plot. <br>
                    
                    <br> 
                    [Note] <br>
                    This displays the initial state-level data. 
                    Clicking on a state will show plot results for the AQS-level data included in that state. 
                    Nothing will be displayed if there is no data available.
                    Note that the AQS-level does not support the [Satellite] data.<br>
                    <br>
                    To return to the state-level plot from AQS-level plot, press the active "Back" button in the lower left corner.
                `.trim(),
            parcoords: `
                    If you see this message, it could be due to the following reasons: <br>
                    - Please select at least one layer to display the Parallel Coordinates plot. <br> 
                    - No data available for the selected date, layers, and/or regions. <br>
                    - No compatible data points found to create a plot. <br>
                    
                    <br> 
                    [Note] <br>
                    This displays the initial state-level data. 
                    Clicking on a state will show plot results for the AQS-level data included in that state. 
                    Nothing will be displayed if there is no data available.
                    Note that the AQS-level does not support the [Satellite] data.<br>
                    <br>
                    To return to the state-level plot from AQS-level plot, press the active "Back" button in the lower left corner.
                `.trim(),
            scatter: `
                    If you see this message, it could be due to the following reasons: <br>
                    - Please select at least two data layers of [Published] data to display the Scatter plot. (1st = Y-axis, 2nd+ = X-axis). <br> 
                    - No data available for the selected date, layers, and/or regions. <br>
                    - No compatible data points found to create a plot. <br>
                    
                    <br> 
                    [Note] <br>
                    This plot tab does not work for [NIFC], [AirNow], [Satellite], and [Satellite] data.
                `.trim(),
            heatmap: `
                    If you see this message, it could be due to the following reasons: <br>
                    - Please select at least one layer of [Satellite] data to display the Heatmap plot. <br> 
                    - No data available for the selected date, layers, and/or regions. <br>
                    - No compatible data points found to create a plot. <br>
                    
                    <br> 
                    [Note] <br>
                    This plot tab has not yet been built for the [Published] data layers. 
                    More updates will be coming soon, so please look forward to them.
                `.trim()
        }
    };
}

export function getMetricInfo(metricKey) {

    const templates = LAYER_TEMPLATES || [];
    const tmpl = templates.find(function (t) { return t.field === metricKey; });

    if (tmpl) {
        const title = (typeof tmpl.title === "function") ? tmpl.title(metricKey) : tmpl.title;
        const decimals = (tmpl.decimals !== undefined) ? tmpl.decimals : 1;
        return { title: title, y: title, decimals: decimals };
    }

    return { title: metricKey, y: metricKey, decimals: 0 };
}

export function extractUnit(title) {
    const regex = /\(([^)]+)\)$/;
    const match = title.match(regex);
    if (match && match[1]) {
        return match[1].trim();
    }
    return "";
}

export function getStandardMetrics() {
    const templates = LAYER_TEMPLATES || [];
    return templates
        .filter(function (t) { return t.manualLayer === true; })
        .map(function (t) { return t.field; });
}

export function isMetricVisible(metricField) {
    const templates = LAYER_TEMPLATES || [];
    const tmpl = templates.find(function (t) { return t.field === metricField; });
    if (!tmpl) return false;

    const checkboxId = "layer-" + tmpl.id;
    const checkbox = document.getElementById(checkboxId);

    return checkbox && checkbox.checked;
}

export function getSpikeLayout(theme) {
    return {
        showspikes: true,
        spikemode: "toaxis+across+marker",
        spikedash: "dash",
        spikecolor: theme.axisText,
        spikethickness: 1,
        spikesnap: "data"
    };
}

export function getPlotlyConfig(filename) {
    const isMobile = window.innerWidth <= 1024;
    const buttonsToRemove = [
        "zoom2d", "pan2d", "select2d", "lasso2d", "zoomIn2d", "zoomOut2d",
        "hoverClosestCartesian", "hoverCompareCartesian", "autoscale"
    ];

    // Hide download button on mobile
    if (isMobile) {
        buttonsToRemove.push("toImage");
    }

    const conf = {
        responsive: true,
        displaylogo: false,
        modeBarButtonsToRemove: buttonsToRemove,
        // Optional: displayModeBar: isMobile ? false : "hover"
    };

    if (filename && !isMobile) {
        conf.toImageButtonOptions = {
            format: "png",
            filename: filename,
            scale: 2 // Higher resolution
        };
    }

    return conf;
}

export function renderBackButton(container, btnId, onClick) {
    const existing = document.getElementById(btnId);
    if (existing) existing.remove();

    if (!onClick) return;

    const btn = document.createElement("button");
    btn.className = "stats-drill-back-btn";
    btn.id = btnId;
    btn.textContent = "◀ Back";
    Object.assign(btn.style, {
        zIndex: "var(--z-highest)",
        position: "absolute",
        bottom: "1rem",
        left: "0.4rem",

        padding: "0.8rem 1rem",

        cursor: "pointer",
        background: "var(--card-shadow)",
        color: "var(--color-bg)",
        border: "none",
        borderRadius: "0.6rem",

        fontSize: "1.6rem",
        fontWeight: "bold"
    });

    const mapContainer = document.getElementById("map");
    mapContainer.appendChild(btn);

    btn.addEventListener("click", function (e) {
        e.stopPropagation();
        onClick();
    });

    return btn;
}

export function attachDrillDownListeners(container, selector, onDrillDown) {
    const elements = container.querySelectorAll(selector);
    
    // Check if device supports hover (desktop/mouse devices)
    const hasHover = window.matchMedia("(hover: hover)").matches;
    
    elements.forEach(function (el) {
        el.style.cursor = "pointer";
        el.style.pointerEvents = "all";

        el.onclick = function (evt) {
            if (evt && evt.stopPropagation) evt.stopPropagation();

            const text = this.textContent;
            if (text && onDrillDown) {
                onDrillDown(text);
            }
        };

        // Only attach hover effects on devices with hover capability
        if (hasHover) {
            el.onmouseenter = function () {
                this.style.fill = "red";
                this.style.fontWeight = "bold";
                this.style.fontSize = "var(--stats-plot-font-size)";
            };
            el.onmouseleave = function () {
                this.style.fill = "var(--text-main)";
                this.style.fontWeight = "normal";
                this.style.fontSize = "calc(var(--stats-plot-font-size) * 0.8)";
            };
        }
    });
}

export function highlightSiteOnMap(coords, properties, dsKeyOrVal) {
    if (utils.highlightLocation) {
        const dsKey = (properties && properties.dsKeyForFigure)
            ? properties.dsKeyForFigure
            : (DATASET_SOURCE_MAP[dsKeyOrVal] || dsKeyOrVal);

        utils.highlightLocation(coords, properties, dsKey);
    }
}

export function resetPlotContainer(container, observerProp) {
    if (!container) return;
    if (observerProp && container[observerProp]) {
        container[observerProp].disconnect();
        delete container[observerProp];
    }
    try {
        if (window.Plotly) Plotly.purge(container);
    } catch (e) { /* ignore */ }
    container.innerHTML = "";
}

export function attachResizeObserver(container, observerProp) {
    if (!container) return;

    let prevWidth = container.offsetWidth;
    const ro = new ResizeObserver(utils.debounce(function () {
        if (container.offsetParent) {
            const currentWidth = container.offsetWidth;
            if (currentWidth !== prevWidth) {
                prevWidth = currentWidth;
                Plotly.Plots.resize(container);
            }
        }
    }, 200));
    ro.observe(container);
    if (observerProp) container[observerProp] = ro;
}

export function renderPlotMessage(container, message) {
    if (!container) return;
    const msg = message || "No data available or no layers selected.";

    resetPlotContainer(container);

    const div = document.createElement("div");
    div.className = "stats-empty-msg-plot";
    Object.assign(div.style, {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "left",
        justifyContent: "flex-start",
        color: "var(--text-strong)",
        fontSize: "var(--stats-plot-font-size)",
        padding: "2rem",
        boxSizing: "border-box"
    });
    div.innerHTML = msg;
    container.appendChild(div);
}


export function clearPlotMessage(container) {
    if (!container) return;
    const msg = container.querySelector(".stats-empty-msg-plot");
    if (msg) {
        msg.remove();
    }
}

export function getDatasetInfo() {
    const el = document.getElementById("MapDataSelect");
    const val = el ? el.value : "";
    const key = DATASET_SOURCE_MAP[val] || val;
    return { value: val, key: key };
}

function init() {
    updateStickyHeaderOffsets();
    setupPlotTabs();
    bindEventsStats();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}

