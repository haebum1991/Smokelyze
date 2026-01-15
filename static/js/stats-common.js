
import { ExcludeLayerGroups, LAYER_TEMPLATES } from "./layers-def.js";
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

var expandState = {
    date: { us: false, ca: false },
    year: { us: false, ca: false }
};

export const usStates = [
    "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "Florida",
    "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland",
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

export function createBurnStats(regionIDs) { var out = {}; regionIDs.forEach(function (id) { out[id] = null; }); return out; }
export function createSmokeStats(regionIDs) { var out = {}; regionIDs.forEach(function (id) { out[id] = { light: null, medium: null, heavy: null }; }); return out; }
export function createFireStats(regionIDs) { var out = {}; regionIDs.forEach(function (id) { out[id] = { count: null, frpTotal: null, n: 0 }; }); return out; }
export function createModelStats(regionIDs) { var out = {}; regionIDs.forEach(function (id) { out[id] = {}; }); return out; }

export {
    setupExpandControls,
    setupPlotClickHandlers,
    getActiveModelLayers,
    rebuildStatsHeader,
    getModelStatsCells,
    renderStatsTable,
    clearPlotSelectionForLayer,
    updateStickyHeaderOffsets,
    setupDrawerResizer,
    updateAllStats,
    triggerRefresh,
    bindEvents,
    setupPlotTabs,
    getPlotTheme,
    getMetricInfo,
    extractUnit,
    getStandardMetrics,
    isMetricVisible,
    getSpikeLayout,
    getPlotlyConfig,
    renderBackButton,
    renderPlotMessage,
    attachDrillDownListeners,
    highlightSiteOnMap,
    resetPlotContainer,
    attachResizeObserver,
    clearPlotMessage,
    getDatasetInfo
};

function setupExpandControls(tbody, scopeKey) {
    function applyExpand(target, expanded) {
        var selector = ".stats-expand-btn[stats-data-target='" + target + "']";
        var btn = tbody.querySelector(selector);
        var rows = target === "us" ? tbody.querySelectorAll("tr.stats-state-row-us") : tbody.querySelectorAll("tr.stats-state-row-ca");
        if (!btn) return;
        rows.forEach(function (tr) {
            if (expanded) tr.classList.add("show");
            else tr.classList.remove("show");
        });
        btn.classList.toggle("expanded", expanded);
        btn.textContent = expanded ? "↑" : "↓";
    }

    var state = expandState[scopeKey] || { us: false, ca: false };
    applyExpand("us", state.us);
    applyExpand("ca", state.ca);

    tbody.querySelectorAll(".stats-expand-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
            var target = btn.getAttribute("stats-data-target");
            var expanding = !btn.classList.contains("expanded");
            expandState[scopeKey][target] = expanding;
            applyExpand(target, expanding);
        });
    });
}

function setupPlotClickHandlers(tbody, scopeKey) {
    if (scopeKey !== "year") return;
    if (currentMonthKey !== "all") return;

    tbody.querySelectorAll(".stats-plot-for-line-year").forEach(function (cell) {
        var regionId = cell.getAttribute("data-region");
        var metric = cell.getAttribute("data-metric");
        if (!regionId) return;

        if (!selectedRegionsByMetric[metric]) selectedRegionsByMetric[metric] = [];
        var list = selectedRegionsByMetric[metric];

        if (list.indexOf(regionId) !== -1) cell.classList.add("active");

        cell.style.cursor = "pointer";
        cell.title = "Click to toggle plot";
        cell.addEventListener("click", function () {
            var arr = selectedRegionsByMetric[metric] || [];
            var idx = arr.indexOf(regionId);
            if (idx === -1) {
                arr.push(regionId);
                cell.classList.add("active");
            } else {
                arr.splice(idx, 1);
                cell.classList.remove("active");
            }
            selectedRegionsByMetric[metric] = arr;

            var hasSelection = false;
            var allMetrics = Object.keys(selectedRegionsByMetric);
            for (var i = 0; i < allMetrics.length; i++) {
                if (selectedRegionsByMetric[allMetrics[i]].length > 0) {
                    hasSelection = true;
                    break;
                }
            }

            var panel = cell.closest(".stats-plot-tab-panel");
            if (panel) {
                var lineTab = panel.querySelector(".stats-plot-tab-sub[stats-plot-target='stats-plot-for-line-year']");
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
function getActiveModelLayers() {
    var layers = [];
    var templates = LAYER_TEMPLATES || [];

    var select = document.getElementById("MapDataSelect");
    var currentDatasetLabel = "Model statistics";
    if (select && select.selectedOptions && select.selectedOptions.length > 0) {
        currentDatasetLabel = select.selectedOptions[0].text.split("(")[0].trim();
    }

    document.querySelectorAll("input[type=checkbox][id^='layer-']").forEach(function (cb) {
        var lbl = cb.closest("label");
        if (!lbl || lbl.style.display === "none") return;
        if (!cb.checked) return;

        var shortId = cb.id.replace("layer-", "");
        var tmpl = templates.find(t => t.id === shortId);

        var EXCLUDED = ExcludeLayerGroups.modelTable;
        if (EXCLUDED.includes(shortId)) return;

        if (tmpl) {
            var rawLabel = (lbl.innerText || lbl.textContent || shortId).trim();
            var group = currentDatasetLabel;
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
function rebuildStatsHeader(thead, activeModelLayers) {
    thead.innerHTML = "";

    var tr1 = document.createElement("tr");
    var tr2 = document.createElement("tr");

    // 1. Region Column (Fixed)
    var thRegion = document.createElement("th");
    thRegion.rowSpan = 2;
    thRegion.textContent = "Region";
    tr1.appendChild(thRegion);

    // 2. Model & AirNow Group Headers
    if (activeModelLayers.length > 0) {
        var groups = [];
        activeModelLayers.forEach(function (layer) {
            var lastGroup = groups[groups.length - 1];
            if (lastGroup && lastGroup.name === layer.group) {
                lastGroup.count++;
            } else {
                groups.push({ name: layer.group, count: 1 });
            }
        });

        groups.forEach(function (group) {
            var thGroup = document.createElement("th");
            thGroup.colSpan = group.count;
            thGroup.textContent = group.name;
            thGroup.className = "col-model-head";
            tr1.appendChild(thGroup);
        });

        activeModelLayers.forEach(function (layer) {
            var thSub = document.createElement("th");
            thSub.textContent = layer.label;
            thSub.title = layer.label;
            thSub.className = "col-model-head";
            tr2.appendChild(thSub);
        });
    }

    // 3. Satellite Data Groups (Unified)
    var satConfigs = [
        { id: "burn", group: "burn", label: "Area burned (km²)", subLabels: [""] },
        { id: "smoke", group: "smoke", label: "Smoke area (km²)", subLabels: ["L", "M", "H"] },
        { id: "fire", group: "fire", label: "HMS-fire", subLabels: ["Fire points", "FRP (MW)"] }
    ];

    satConfigs.forEach(function (cfg) {
        var cb = document.getElementById("layer-" + cfg.id);
        if (!cb || !cb.checked) return;

        var th1 = document.createElement("th");
        th1.textContent = cfg.label;
        th1.className = "col-" + cfg.group;

        if (cfg.subLabels.length > 1 || cfg.subLabels[0] !== "") {
            th1.colSpan = cfg.subLabels.length;
            tr1.appendChild(th1);
            cfg.subLabels.forEach(function (sub) {
                var th2 = document.createElement("th");
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

function getModelStatsCells(regionID, modelStats, activeLayers) {
    var html = "";
    var stats = modelStats[regionID] || {};

    activeLayers.forEach(function (layer) {
        var value = stats[layer.id];
        var formattedValue = "NA";
        if (value !== null && value !== undefined) {
            if (typeof value === "number") {

                var decimals = 0;
                var tmpl = LAYER_TEMPLATES.find(function (t) { return t.id === layer.id; });

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
            var c1 = stats[layer.id + "_c1"];
            var c2 = stats[layer.id + "_c2"];
            var all = c1 + c2;

            if (c1 !== undefined || c2 !== undefined) {
                formattedValue = `
                      <span style="font-weight:bold;">${utils.ESML(String(all || 0))}</span> | 
                      <span style="color:green; font-weight:bold;">${utils.ESML(String(c1 || 0))}</span> | 
                      <span style="color:red; font-weight:bold;">${utils.ESML(String(c2 || 0))}</span>
                    `;
            }
        }

        html += "<td class='slot-cell col-model'><span class='slot-roll'>" + formattedValue + "</span></td>";
    });
    return html;
}

function renderStatsTable(regionIDs, burnStats, smokeStats, fireStats, tableID, modelStats) {
    var tbody = document.getElementById(tableID);
    if (!tbody) return;
    var thead = tbody.previousElementSibling;
    var theme = getPlotTheme();

    modelStats = modelStats || {};

    var isDailyTable = (tableID === "StatsRegionBodyDate");
    var activeModelLayers = [];

    if (isDailyTable) {
        activeModelLayers = getActiveModelLayers();
        if (thead) rebuildStatsHeader(thead, activeModelLayers);
    }

    var ChkBoxBurn = document.getElementById("layer-burn");
    var ChkBoxSmoke = document.getElementById("layer-smoke");
    var ChkBoxFire = document.getElementById("layer-fire");
    var showBurn = !ChkBoxBurn || ChkBoxBurn.checked;
    var showSmoke = !ChkBoxSmoke || ChkBoxSmoke.checked;
    var showFire = !ChkBoxFire || ChkBoxFire.checked;
    var showModel = activeModelLayers.length > 0;

    var tableWrapper = tbody.closest(".stats-table-responsive-date, .stats-table-responsive-year");
    var container = tableWrapper ? tableWrapper.parentElement : null;
    if (!container) return;

    var msgBox = container.querySelector(".stats-empty-msg-table");

    var hasContent = showBurn || showSmoke || showFire || showModel;
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


    var applyColDisplay = function (cls, show) {
        document.querySelectorAll("." + cls).forEach(function (el) { el.style.display = show ? "" : "none"; });
    };
    applyColDisplay("col-burn", showBurn);
    applyColDisplay("col-smoke", showSmoke);
    applyColDisplay("col-fire", showFire);

    var breakIdsBot = ["US", "Canada", "Wyoming", "Yukon"];
    var html = "";
    var isYear = (tableID === "StatsRegionBodyYear");

    regionIDs.forEach(function (id) {
        var burn = (burnStats[id] !== undefined) ? burnStats[id] : null;
        var smoke = smokeStats[id] || { light: null, medium: null, heavy: null };
        var fire = fireStats[id] || { count: null, frpTotal: null, n: 0 };
        var fireFrp = (fire.n > 0 && fire.frpTotal !== null) ? fire.frpTotal / fire.n : null;

        function fmt(val, dec) {
            if (val === null || val === undefined) return "NA";
            return val.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec });
        }

        var isUSState = usStates.indexOf(id) !== -1;
        var isCAState = caStates.indexOf(id) !== -1;
        var classList = [];
        if (breakIdsBot.indexOf(id) !== -1) classList.push("stats-section-break-bot");
        if (isUSState) classList.push("stats-state-row-us");
        if (isCAState) classList.push("stats-state-row-ca");
        var trClassAttr = classList.length ? " class='" + classList.join(" ") + "'" : "";

        var regionLabel = utils.ESML(id);
        if (id === "US") regionLabel += " <button type='button' class='stats-expand-btn' stats-data-target='us'>↓</button>";
        if (id === "Canada") regionLabel += " <button type='button' class='stats-expand-btn' stats-data-target='ca'>↓</button>";

        var modelCells = isDailyTable ? getModelStatsCells(id, modelStats, activeModelLayers) : "";

        var burnDec = getMetricInfo("burn").decimals;
        var smokeLightDec = getMetricInfo("smokeLight").decimals;
        var smokeMediumDec = getMetricInfo("smokeMedium").decimals;
        var smokeHeavyDec = getMetricInfo("smokeHeavy").decimals;
        var fireCountDec = getMetricInfo("fireCount").decimals;
        var fireFrpDec = getMetricInfo("fireFrp").decimals;

        if (isYear) {
            var enablePlotClick = currentMonthKey === "all";
            var baseClass = "slot-cell" + (enablePlotClick ? " stats-plot-for-line-year" : "");

            html += "<tr" + trClassAttr + ">" +
                "<td>" + regionLabel + "</td>" +
                "<td class='" + baseClass + " col-burn' data-region='" + utils.ESML(id) + "' data-metric='burn'><span class='slot-roll'>" + utils.ESML(fmt(burn, burnDec)) + "</span></td>" +
                "<td class='" + baseClass + " col-smoke' data-region='" + utils.ESML(id) + "' data-metric='smokeLight'><span class='slot-roll'>" + utils.ESML(fmt(smoke.light, smokeLightDec)) + "</span></td>" +
                "<td class='" + baseClass + " col-smoke' data-region='" + utils.ESML(id) + "' data-metric='smokeMedium'><span class='slot-roll'>" + utils.ESML(fmt(smoke.medium, smokeMediumDec)) + "</span></td>" +
                "<td class='" + baseClass + " col-smoke' data-region='" + utils.ESML(id) + "' data-metric='smokeHeavy'><span class='slot-roll'>" + utils.ESML(fmt(smoke.heavy, smokeHeavyDec)) + "</span></td>" +
                "<td class='" + baseClass + " col-fire' data-region='" + utils.ESML(id) + "' data-metric='fireCount'><span class='slot-roll'>" + utils.ESML(fmt(fire.count, fireCountDec)) + "</span></td>" +
                "<td class='" + baseClass + " col-fire' data-region='" + utils.ESML(id) + "' data-metric='fireFrp'><span class='slot-roll'>" + utils.ESML(fmt(fireFrp, fireFrpDec)) + "</span></td>" +
                "</tr>";
        } else {
            html += "<tr" + trClassAttr + ">" +
                "<td>" + regionLabel + "</td>" +
                modelCells +
                "<td class='slot-cell col-burn'><span class='slot-roll'>" + utils.ESML(fmt(burn, burnDec)) + "</span></td>" +
                "<td class='slot-cell col-smoke'><span class='slot-roll'>" + utils.ESML(fmt(smoke.light, smokeLightDec)) + "</span></td>" +
                "<td class='slot-cell col-smoke'><span class='slot-roll'>" + utils.ESML(fmt(smoke.medium, smokeMediumDec)) + "</span></td>" +
                "<td class='slot-cell col-smoke'><span class='slot-roll'>" + utils.ESML(fmt(smoke.heavy, smokeHeavyDec)) + "</span></td>" +
                "<td class='slot-cell col-fire'><span class='slot-roll'>" + utils.ESML(fmt(fire.count, fireCountDec)) + "</span></td>" +
                "<td class='slot-cell col-fire'><span class='slot-roll'>" + utils.ESML(fmt(fireFrp, fireFrpDec)) + "</span></td>" +
                "</tr>";
        }
    });

    tbody.innerHTML = html;

    var scopeKey = isYear ? "year" : "date";
    setupExpandControls(tbody, scopeKey);
    setupPlotClickHandlers(tbody, scopeKey);

    applyColDisplay("col-burn", showBurn);
    applyColDisplay("col-smoke", showSmoke);
    applyColDisplay("col-fire", showFire);

    setTimeout(updateStickyHeaderOffsets, 0);
}

function clearPlotSelectionForLayer(layerId) {
    if (!selectedRegionsByMetric) return;
    var metricsToClear = [];
    if (layerId === "layer-burn") metricsToClear = ["burn"];
    else if (layerId === "layer-smoke") metricsToClear = ["smokeLight", "smokeMedium", "smokeHeavy"];
    else if (layerId === "layer-fire") metricsToClear = ["fireCount", "fireFrp"];
    metricsToClear.forEach(function (m) { delete selectedRegionsByMetric[m]; });
}

function updateStickyHeaderOffsets() {
    var tables = document.querySelectorAll(".stats-region-table-date, .stats-region-table-year");
    tables.forEach(function (table) {
        var thead = table.querySelector("thead");
        if (!thead) return;

        var rows = thead.querySelectorAll("tr");
        if (rows.length < 2) return;

        var h = rows[0].offsetHeight;
        if (h > 0) {
            rows[1].querySelectorAll("th").forEach(function (th) {
                th.style.top = (h / 10) + "rem";
            });
        }
    });
}

function setupDrawerResizer() {
    var resizer = document.getElementById("DrawerResizer");
    var drawer = document.getElementById("FigurePageDrawer");
    if (!resizer || !drawer) return;

    resizer.addEventListener("mousedown", function (e) {
        e.preventDefault();
        document.addEventListener("mousemove", resize);
        document.addEventListener("mouseup", stopResize);
        document.body.style.cursor = "col-resize";
    });

    function resize(e) {
        var newWidth = e.clientX;
        // Clamp width
        if (newWidth < 300) newWidth = 300;
        if (newWidth > window.innerWidth * 0.9) newWidth = window.innerWidth * 0.9;

        document.documentElement.style.setProperty("--FigurePage-drawer-width", (newWidth / 10) + "rem");
    }

    function stopResize() {
        document.removeEventListener("mousemove", resize);
        document.removeEventListener("mouseup", stopResize);
        document.body.style.cursor = "";
    }
}

function updateAllStats(isoDate, regionIDs, monthKey) {
    if (onUpdateDailyStats) onUpdateDailyStats(isoDate, regionIDs);
    if (onUpdateYearStats) onUpdateYearStats(isoDate, regionIDs, monthKey);
}

// [추가] 외부에서 테이블 갱신을 트리거하기 위한 함수
function triggerRefresh() {
    var isoDate = utils.currentDate();
    var activeMonthBtn = document.querySelector(".stats-tab-month-main .stats-tab-month-sub.active");
    var monthKey = activeMonthBtn ? activeMonthBtn.getAttribute("stats-table-month") : "all";
    updateAllStats(isoDate, regionIDs, monthKey);
}

function bindEvents() {
    // Tabs logic
    var tabs = document.querySelectorAll(".stats-tab-sub");
    var panels = document.querySelectorAll(".stats-container");
    tabs.forEach(function (tab) {
        tab.addEventListener("click", function () {
            var target = tab.getAttribute("stats-tab-sub-data");
            if (!target) return;
            tabs.forEach(function (t) { t.classList.toggle("active", t === tab); });
            panels.forEach(function (p) { p.classList.toggle("active", p.getAttribute("stats-data-panel") === target); });
            updateStickyHeaderOffsets();
        });
    });

    // Month tabs logic
    var monthTabs = document.querySelectorAll(".stats-tab-month-main .stats-tab-month-sub");
    monthTabs.forEach(function (btn) {
        btn.addEventListener("click", function () {
            var monthKey = btn.getAttribute("stats-table-month");
            var val = utils.currentDate();
            if (!monthKey) return;
            monthTabs.forEach(function (b) { b.classList.toggle("active", b === btn); });
            if (monthKey !== "all" && onCurrentPlotHide) onCurrentPlotHide();
            if (onUpdateYearStats) onUpdateYearStats(val, regionIDs, monthKey);
        });
    });

    var resetBtn = document.getElementById("MapBtnReset");
    if (resetBtn) {
        resetBtn.addEventListener("click", function () {
            if (resetUIAndData) resetUIAndData();
            if (resetAccordionDetails) resetAccordionDetails();
            if (resetMapViewToDefault) resetMapViewToDefault();

            document.querySelectorAll(".stats-drill-back-btn").forEach(function (el) { el.remove(); });

            selectedRegionsByMetric = {};
            if (onCurrentPlotHide) onCurrentPlotHide();

            document.getElementById("StatsRegionBodyDate").innerHTML = "";
            document.getElementById("StatsRegionBodyYear").innerHTML = "";

            var val = utils.currentDate();
            var allMonth = document.querySelector(".stats-tab-month-main .stats-tab-month-sub[stats-table-month='all']");
            if (allMonth) allMonth.click();
            updateAllStats(val, regionIDs, "all");

            document.documentElement.style.removeProperty("--FigurePage-drawer-width");
        });
    }
}

// Plot tabs logic
function setupPlotTabs() {
    var plotTabs = document.querySelectorAll(".stats-plot-tab-sub");
    var activeTab = document.querySelector(".stats-plot-tab-sub.active");
    if (activeTab) {
        var targetId = activeTab.getAttribute("stats-plot-target");
        if (targetId) document.body.setAttribute("data-stats-active-tab", targetId);
    }

    plotTabs.forEach(function (tab) {
        tab.addEventListener("click", function () {
            var targetId = tab.getAttribute("stats-plot-target");
            if (!targetId) return;

            document.body.setAttribute("data-stats-active-tab", targetId);

            // Find the parent panel to scope this action
            var panel = tab.closest(".stats-plot-tab-panel");
            if (!panel) return;

            // Update tabs within this panel only
            var panelTabs = panel.querySelectorAll(".stats-plot-tab-sub");
            panelTabs.forEach(function (t) { t.classList.toggle("active", t === tab); });

            // Update containers within this panel only
            var panelContainers = panel.querySelectorAll(".stats-plot-tab-sub-container");
            panelContainers.forEach(function (container) {
                if (container.id === targetId) {
                    container.classList.add("active");
                    var plotDiv = container;
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

function init() {
    updateStickyHeaderOffsets();
    setupPlotTabs();
    bindEvents();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}

window.addEventListener("themeChanged", function () {
    var selector = [
        "#stats-plot-for-barline-date",
        "#stats-plot-for-parcoords-date",
        "#stats-plot-for-scatter-date",
        "#stats-plot-for-heatmap-year",
        "#stats-plot-for-line-year"
    ].join(", ");
    var targets = document.querySelectorAll(selector);

    targets.forEach(function (el) {
        el.style.transition = "opacity 0.2s ease";
        el.style.opacity = "0";
    });

    setTimeout(function () {
        if (typeof triggerRefresh === "function") triggerRefresh();

        setTimeout(function () {
            var activeTargets = document.querySelectorAll(selector);
            activeTargets.forEach(function (el) {
                el.style.opacity = "1";
            });
        }, 150);
    }, 300);
});

document.addEventListener("DOMContentLoaded", function () {
    if (setupDrawerResizer) {
        setupDrawerResizer();
    }
});

// ----------------------------------------------------
// Common Plot Logic (Theme, Metrics, Config)
// ----------------------------------------------------

function getPlotTheme() {
    var styles = getComputedStyle(document.documentElement);
    function v(name) { return styles.getPropertyValue(name).trim(); }

    var fsRaw = v("--stats-plot-font-size");
    var fs = parseFloat(fsRaw) || 14;
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
                    - Please select at least one layer of [Published] data to display the Scatter plot. <br> 
                    - No data available for the selected date, layers, and/or regions. <br>
                    - No compatible data points found to create a plot. <br>
                    
                    <br> 
                    [Note] <br>
                    This plot tab compares [Obs MDA8] and [Pred MDA8] for published datasets by date, 
                    including [GAM-v1], [GAM-v2], and [EPA-EMBER].
                    For [Smoke PM2.5] datasets,
                    the plot displays the relationship between [PM2.5] and [Smoke PM2.5].
                    Therefore, this plot tab does not work for [Satellite] data.
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

function getMetricInfo(metricKey) {

    var templates = LAYER_TEMPLATES || [];
    var tmpl = templates.find(function (t) { return t.field === metricKey; });

    if (tmpl) {
        var title = (typeof tmpl.title === "function") ? tmpl.title(metricKey) : tmpl.title;
        var decimals = (tmpl.decimals !== undefined) ? tmpl.decimals : 1;
        return { title: title, y: title, decimals: decimals };
    }

    return { title: metricKey, y: metricKey, decimals: 0 };
}

function extractUnit(title) {
    var regex = /\(([^)]+)\)$/;
    var match = title.match(regex);
    if (match && match[1]) {
        return match[1].trim();
    }
    return "";
}

function getStandardMetrics() {
    var templates = LAYER_TEMPLATES || [];
    return templates
        .filter(function (t) { return t.manualLayer === true; })
        .map(function (t) { return t.field; });
}

function isMetricVisible(metricField) {
    var templates = LAYER_TEMPLATES || [];
    var tmpl = templates.find(function (t) { return t.field === metricField; });
    if (!tmpl) return false;

    var checkboxId = "layer-" + tmpl.id;
    var checkbox = document.getElementById(checkboxId);

    return checkbox && checkbox.checked;
}

function getSpikeLayout(theme) {
    return {
        showspikes: true,
        spikemode: "toaxis+across+marker",
        spikedash: "dash",
        spikecolor: theme.axisText,
        spikethickness: 1,
        spikesnap: "data"
    };
}

function getPlotlyConfig(filename) {
    var isMobile = window.innerWidth <= 1024;
    var buttonsToRemove = [
        "zoom2d", "pan2d", "select2d", "lasso2d", "zoomIn2d", "zoomOut2d",
        "hoverClosestCartesian", "hoverCompareCartesian", "autoscale"
    ];

    // Hide download button on mobile
    if (isMobile) {
        buttonsToRemove.push("toImage");
    }

    var conf = {
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

function renderBackButton(container, btnId, onClick) {
    var existing = document.getElementById(btnId);
    if (existing) existing.remove();

    if (!onClick) return;

    var btn = document.createElement("button");
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

    var mapContainer = document.getElementById("map");
    mapContainer.appendChild(btn);

    btn.addEventListener("click", function (e) {
        e.stopPropagation();
        onClick();
    });

    return btn;
}

function attachDrillDownListeners(container, selector, onDrillDown) {
    var elements = container.querySelectorAll(selector);

    elements.forEach(function (el) {
        el.style.cursor = "pointer";
        el.style.pointerEvents = "all";

        el.onclick = function (evt) {
            if (evt && evt.stopPropagation) evt.stopPropagation();

            var text = this.textContent;
            if (text && onDrillDown) {
                onDrillDown(text);
            }
        };

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
    });
}

function highlightSiteOnMap(coords, properties, dsKeyOrVal) {
    if (utils.highlightLocation) {
        var dsKey = dsKeyOrVal;
        
        // Use explicitly assigned specialDsKey if available (e.g., from AirNow data)
        if (properties && properties.specialDsKey) {
            dsKey = properties.specialDsKey;
        } else {
            // Mapping for model datasets
            if (dsKey === "gam-v2") dsKey = "gam_v2";
            else if (dsKey === "gam-v1") dsKey = "gam_v1";
            else if (dsKey === "epa-ember") dsKey = "epa_ember";
            else if (dsKey === "pm-cbsa") dsKey = "pm_cbsa";
        }

        utils.highlightLocation(coords, properties, dsKey);
    }
}

function resetPlotContainer(container, observerProp) {
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

function attachResizeObserver(container, observerProp) {
    if (!container) return;

    var prevWidth = container.offsetWidth;
    var ro = new ResizeObserver(utils.debounce(function () {
        if (container.offsetParent) {
            var currentWidth = container.offsetWidth;
            if (currentWidth !== prevWidth) {
                prevWidth = currentWidth;
                Plotly.Plots.resize(container);
            }
        }
    }, 200));
    ro.observe(container);
    if (observerProp) container[observerProp] = ro;
}

function renderPlotMessage(container, message) {
    if (!container) return;
    var msg = message || "No data available or no layers selected.";

    resetPlotContainer(container);

    var div = document.createElement("div");
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

function clearPlotMessage(container) {
    if (!container) return;
    var msg = container.querySelector(".stats-empty-msg-plot");
    if (msg) {
        msg.remove();
    }
}

function getDatasetInfo() {
    var el = document.getElementById("MapDataSelect");
    var val = el ? el.value : "";
    var key = val;
    // Mapping
    if (val === "gam-v2") key = "gam_v2";
    else if (val === "gam-v1") key = "gam_v1";
    else if (val === "epa-ember") key = "epa_ember";
    else if (val === "pm-cbsa") key = "pm_cbsa";
    return { value: val, key: key };
}

