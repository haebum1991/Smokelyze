
import { ExcludeLayerGroups, LAYER_TEMPLATES, DATASET_SOURCE_MAP } from "./layers-def.js";
import { resetUIAndData, resetAccordionDetails, resetMapViewToDefault } from "./ui-reset.js";
import * as utils from "./utils.js";
import { auth } from "./fb-init.js";
import { showHelpModal } from "./ui-param-desc.js";
import { downloadFile } from "./ui-download.js";

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
export function getCleanLabel(el) {
    if (!el) return "";
    let text = "";
    // Iterate through child nodes to extract text only from relevant parts
    Array.from(el.childNodes).forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) {
            text += node.textContent;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            // Ignore inputs, help icons, and download buttons
            if (node.tagName === "INPUT" || 
                node.classList.contains("drawer-help-btn") || 
                node.classList.contains("layer-dl-btn") ||
                node.classList.contains("layer-help-btn")) {
                return;
            }
            text += getCleanLabel(node);
        }
    });
    return text.trim();
}

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
            let rawLabel = getCleanLabel(lbl) || shortId;
            let group = currentDatasetLabel;
            if (shortId.startsWith("tempo-")) {
                group = "TEMPO";
                rawLabel = rawLabel.replace(/^tempo-/i, "").replace(/^tempo\s+/i, "");
            } else if (shortId.startsWith("tropomi-")) {
                group = "TROPOMI";
                rawLabel = rawLabel.replace(/^tropomi-/i, "").replace(/^tropomi\s+/i, "");
            } else if (shortId.startsWith("hrrr-")) {
                group = "HRRR";
                rawLabel = rawLabel.replace(/^hrrr-/i, "").replace(/^hrrr\s+/i, "");
            } else if (shortId.startsWith("goes-")) {
                group = "GOES";
                rawLabel = rawLabel.replace(/^goes-/i, "").replace(/^goes\s+/i, "");
            } else if (shortId.startsWith("geoscf-") || shortId.startsWith("geos-")) {
                group = "GEOS-CF";
                rawLabel = rawLabel.replace(/^geos-cf-/i, "").replace(/^geoscf-/i, "").replace(/^geos-cf\s+/i, "");
            } else if (shortId.startsWith("airfuse-")) {
                group = "AirFuse";
                rawLabel = rawLabel.replace(/^airfuse-/i, "").replace(/^airfuse\s+/i, "");
            } else if (shortId.startsWith("viirs-")) {
                group = "VIIRS";
                rawLabel = rawLabel.replace(/^viirs-/i, "").replace(/^viirs\s+/i, "");
            } else if (shortId.startsWith("airnow-")) {
                group = "AirNow";
                rawLabel = rawLabel.replace(/^airnow-/i, "").replace(/^airnow\s+/i, "");
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
                formattedValue = `<span style="font-weight:bold;">${utils.ESML(String(all))}</span> | <span style="color:green; font-weight:bold;">${utils.ESML(String(c1 || 0))}</span> | <span style="color:red; font-weight:bold;">${utils.ESML(String(c2 || 0))}</span>`;
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
    }
    if (thead) rebuildStatsHeader(thead, activeModelLayers);

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
    const csvBtn = document.getElementById(isDailyTable ? "BtnExportCsvDate" : "BtnExportCsvYear");
    const hasContent = showBurn || showSmoke || showFire || showModel;
    if (!hasContent || !regionIDs || regionIDs.length === 0) {
        if (csvBtn) csvBtn.style.display = "none";
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
    
    if (csvBtn) csvBtn.style.display = "inline-block";
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
    
    // [User UX Disabled part]: Annual Stats 로직 (개발중)
    // if (onUpdateYearStats) onUpdateYearStats(isoDate, regionIDs, monthKey);
}

// [추가] 외부에서 테이블 갱신을 트리거하기 위한 함수
export function triggerRefresh() {
    const isoDate = utils.currentDate();
    const activeMonthBtn = document.querySelector(".stats-tab-month-main .stats-tab-month-sub.active");
    const monthKey = activeMonthBtn ? activeMonthBtn.getAttribute("stats-table-month") : "all";
    updateAllStats(isoDate, regionIDs, monthKey);
    
    // Update custom drawn region stats if hook exists
    if (typeof window.updateDrawStatsAverages === "function") {
        window.updateDrawStatsAverages();
    }
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
            
            // [User UX Disabled part]: Annual Stats 로직 (개발중)
            // if (onUpdateYearStats) onUpdateYearStats(val, regionIDs, monthKey);
        });
    });

    const csvBtnDate = document.getElementById("BtnExportCsvDate");
    if (csvBtnDate) {
        csvBtnDate.addEventListener("click", () => {
            if (!auth || !auth.currentUser) {
                utils.showAuthOverlay();
                return;
            }
            const dateStr = utils.currentDate();
            exportTableToCSV(".stats-region-table-date", "smokelyze_daily_stats_" + dateStr + ".csv");
        });
    }
    
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
    
    // [New] Add Global CSS for always-visible and LARGER Icons
    const styleId = "stats-global-overrides";
    if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.innerHTML = `
            /* Force Plotly ModeBar to be always visible and larger */
            .js-plotly-plot .plotly .modebar {
                opacity: 1 !important;
                visibility: visible !important;
                background: none !important;
            }
            .js-plotly-plot .plotly .modebar-btn svg {
                transform: scale(1.5) !important; /* 50% Larger */
                margin: 0 0.5rem !important;
            }
        `;
        document.head.appendChild(style);
    }
    
    // [New] Add Help Icons to each container (Plot Body) systematically
    const helpMap = {
        "stats-plot-for-table-date": "fig-table",
        "stats-plot-for-table-year": "fig-table",
        "stats-plot-for-barline-date": "fig-barline",
        "stats-plot-for-parcoords-date": "fig-parcoords",
        "stats-plot-for-scatter-date": "fig-scatter",
        "stats-plot-for-heatmap-year": "fig-heatmap"
    };

    for (const [containerId, descId] of Object.entries(helpMap)) {
        const container = document.getElementById(containerId);
        if (!container) continue;

        // Prevent duplicate icons
        if (container.querySelector(".stats-container-help-trigger")) continue;

        // Ensure container can position absolute children
        container.style.position = "relative";

        const helpIcon = document.createElement("button");
        helpIcon.className = "stats-container-help-trigger drawer-help-btn";
        helpIcon.innerHTML = `
            <svg width="20" height="20">
                <use xlink:href="#icon-help" />
            </svg>
        `;
        helpIcon.title = "Tool Description";

        // Position at top-right corner of the body
        Object.assign(helpIcon.style, {
            position: "absolute",
            top: "1rem",
            left: "0",
            zIndex: "100",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "0.2rem",
            opacity: "0.8",
            transition: "opacity 0.2s"
        });

        helpIcon.addEventListener("click", (e) => {
            e.stopPropagation();
            showHelpModal(descId);
        });

        helpIcon.addEventListener("mouseenter", () => { helpIcon.style.opacity = "1"; });
        helpIcon.addEventListener("mouseleave", () => { helpIcon.style.opacity = "0.6"; });

        container.appendChild(helpIcon);
    }
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
                    In the case of values measured through monitoring,
                    the values in the table are determined entirely 
                    by the number of AQS sites within each state for the corresponding data.<br>
                    <br>
                    This feature is not supported for [NIFC], [GeoColor], and [TrueColor] group layers.
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
                    Note that the AQS-level does not support the [Satellite & Model] data.<br>
                    <br>
                    To return to the state-level plot from AQS-level plot, press the active "Back" button in the lower left corner.<br>
                    <br>
                    This feature is not supported for [NIFC], [GeoColor], and [TrueColor] group layers.
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
                    Note that the AQS-level does not support the [Satellite & Model] data.<br>
                    <br>
                    To return to the state-level plot from AQS-level plot, press the active "Back" button in the lower left corner.<br>
                    <br>
                    This feature is not supported for [NIFC], [GeoColor], and [TrueColor] group layers.
                `.trim(),
            scatter: `
                    If you see this message, it could be due to the following reasons: <br>
                    - Please select at least two data layers of [AirNow] or [Published & Latest] data to display the Scatter plot. (1st = Y-axis, 2nd+ = X-axis). <br> 
                    - No data available for the selected date, layers, and/or regions. <br>
                    - No compatible data points found to create a plot. <br>
                    
                    <br> 
                    [Note] <br>
                    This feature is not supported for [NIFC] and [Satellite & Model] group layers.
                `.trim(),
            heatmap: `
                    If you see this message, it could be due to the following reasons: <br>
                    - Please select at least one layer of [Satellite] data to display the Heatmap plot. <br> 
                    - No data available for the selected date, layers, and/or regions. <br>
                    - No compatible data points found to create a plot. <br>
                    
                    <br> 
                    [Note] <br>
                    This plot tab has not been built for [NIFC], [TEMPO], [TROPOMI], [AirNow], and [Published & Latest] data layers. 
                    More updates will be coming soon, so please look forward to them.
                `.trim()
        }
    };
}

export function getMetricInfo(metricKey) {
    const templates = LAYER_TEMPLATES || [];
    const tmpl = templates.find(function (t) { 
        if (typeof t.field === "function") {
            return t.field("gam-v2") === metricKey || t.field("gam-v1") === metricKey;
        }
        return t.field === metricKey;
    });

    if (tmpl) {
        const dsContext = metricKey === "T2MAX" ? "gam-v2" : "gam-v1";
        const title = (typeof tmpl.title === "function") ? tmpl.title(dsContext) : tmpl.title;
        const decimals = (tmpl.decimals !== undefined) ? tmpl.decimals : 1;
        const unit = (typeof tmpl.unit === "function") ? tmpl.unit(dsContext) : (tmpl.unit || "");
        return { title: title, y: title, decimals: decimals, unit: unit };
    }

    return { title: metricKey, y: metricKey, decimals: 0, unit: "" };
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
        "toImage", // Replace default with legacy-friendly custom button
        "zoom2d", "pan2d", "select2d", "lasso2d", "zoomIn2d", "zoomOut2d",
        "hoverClosestCartesian", "hoverCompareCartesian", "autoscale"
    ];

    // Custom Download Button with Auth Check
    const customDownloadButton = {
        name: "Download plot as a png",
        icon: {
            width: 1000,
            height: 1000,
            path: "M853,248 L710,248 L659,150 L341,150 L290,248 L147,248 C94,248 50,292 50,345 L50,752 C50,805 94,850 147,850 L853,850 C906,850 950,805 950,752 L950,345 C950,292 906,248 853,248 Z M500,741 C386,741 294,649 294,535 C294,421 386,329 500,329 C614,329 706,421 706,535 C706,649 614,741 500,741 Z M500,400 C425,400 365,460 365,535 C365,610 425,670 500,670 C575,670 635,610 635,535 C635,460 575,400 500,400 Z"
        },
        click: function (gd) {
            if (!auth || !auth.currentUser) {
                if (utils.showAuthOverlay) utils.showAuthOverlay();
                return;
            }
            Plotly.downloadImage(gd, {
                format: "png",
                filename: filename || "smokelyze_plot",
                scale: 2
            });
        }
    };

    const conf = {
        responsive: true,
        displaylogo: false,
        displayModeBar: true,
        modeBarButtonsToRemove: buttonsToRemove,
        modeBarButtonsToAdd: isMobile ? [] : [customDownloadButton]
    };

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
    
    // [Fix] Preserve help icons when clearing the container
    Array.from(container.children).forEach(child => {
        if (!child.classList.contains("stats-container-help-trigger")) {
            child.remove();
        }
    });
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
    }, 300));
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
    const val = utils.getEffectiveDataset();
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

export function exportTableToCSV(tableSelector, filename) {
  const table = document.querySelector(tableSelector);
  if (!table) return;

  const matrix = [];
  let logicalRow = 0;

  Array.from(table.rows).forEach((row) => {
    if (row.style.display === "none" || row.classList.contains("hide")) return;
    
    if (!matrix[logicalRow]) matrix[logicalRow] = [];
    let colIndex = 0;

    Array.from(row.cells).forEach(cell => {
      const style = window.getComputedStyle(cell);
      if (style.display === "none") return;

      while (matrix[logicalRow][colIndex] !== undefined) {
        colIndex++;
      }

      let data = cell.innerText.replace(/\s+/g, " ").trim();
      data = data.replace(/↓|↑/g, "").trim();
      
      // [Fix] CSV 내보내기 시 슬래시(/)를 파이프(|)로 변경하여 엑셀 날짜 변환 방지
      data = data.replace(/\//g, "|");
      data = `"${data.replace(/"/g, '""')}"`;

      const rowSpan = cell.rowSpan || 1;
      const colSpan = cell.colSpan || 1;

      for (let r = 0; r < rowSpan; r++) {
        for (let c = 0; c < colSpan; c++) {
          const targetRow = logicalRow + r;
          if (!matrix[targetRow]) matrix[targetRow] = [];
          
          if (r === 0 && c === 0) {
            matrix[targetRow][colIndex + c] = data;
          } else {
            // For merged cells padding, use an empty string
            matrix[targetRow][colIndex + c] = '""';
          }
        }
      }
    });
    logicalRow++;
  });

  const csv = matrix
    .filter(row => row && row.length > 0)
    .map(row => row.join(","))
    .join("\n");

  const BOM = "\uFEFF";
  
  downloadFile(filename || "export.csv", BOM + csv, "text/csv;charset=utf-8;");
}

