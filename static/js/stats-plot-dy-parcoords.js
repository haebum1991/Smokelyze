
import { currentDate } from "./utils.js";
import { regionStats } from "./layers-state.js";
import { LAYER_TEMPLATES } from "./layers-def.js";
import { getSiteStatsForState } from "./loader.js";
import {
    getPlotTheme,
    getDatasetInfo,
    renderPlotMessage,
    renderBackButton,
    getPlotlyConfig,
    clearPlotMessage,
    highlightSiteOnMap,
    attachDrillDownListeners,
    attachResizeObserver,
    caStates,
    usStates,
    resetPlotContainer
} from "./stats-common.js";

export var plotAxesStack = [];
var currentDailyDetailStateParcoords = null;

// Track checkbox changes for Parallel Coordinates 
document.addEventListener("change", function (e) {
    if (e.target && e.target.id && e.target.id.startsWith("layer-")) {
        var layerId = e.target.id.replace("layer-", "");
        if (e.target.checked) {
            if (plotAxesStack.indexOf(layerId) === -1) {
                plotAxesStack.push(layerId);
            }
        } else {
            plotAxesStack = plotAxesStack.filter(function (id) {
                return id !== layerId;
            });
        }
    }
});

export function renderParCoords(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;

    if (container._clickLabelTimer) {
        clearTimeout(container._clickLabelTimer);
        delete container._clickLabelTimer;
    }

    resetPlotContainer(container, "_parcoordsObserver");

    // Determine mode
    var isDetailMode = !!currentDailyDetailStateParcoords;
    var dataStats = [];
    var theme = getPlotTheme();
    var fontSize = parseInt(theme.fontSize, 10);

    if (isDetailMode) {
        // Detail Mode: Get Site Stats
        if (getSiteStatsForState) {
            var siteStats = getSiteStatsForState(currentDailyDetailStateParcoords);
            Object.keys(siteStats).forEach(function (key) {
                var s = siteStats[key];
                var row = Object.assign({ state: key }, s);
                dataStats.push(row);
            });
        }
    } else {
        // Overview Mode: Region Stats
        var currentRegionStats = regionStats || {};
        var states = (usStates || []).concat(caStates || []);

        states.forEach(function (st) {
            if (currentRegionStats[st]) {
                var s = currentRegionStats[st];
                var isRelevant = function (key) {
                    return key !== "id" && !["burn", "smokeLight", "smokeMedium", "smokeHeavy", "fireCount", "fireFrp"].includes(key) && s[key] !== null;
                };
                var hasData = (s.burn > 0) || (s.smokeLight > 0) || (s.fireCount > 0) || (Object.keys(s).some(isRelevant));

                if (hasData) {
                    var row = Object.assign({ state: st }, s);
                    dataStats.push(row);
                }
            }
        });
    }

    if (dataStats.length === 0) {
        renderPlotMessage(container, theme.messages.parcoords);
        renderBackButton(container, "stats-back-btn-parcoords", isDetailMode ? function () {
            currentDailyDetailStateParcoords = null;
            renderParCoords(containerId);
        } : null);
        return;
    }

    var activeCheckboxes = Array.from(document.querySelectorAll("input[type=checkbox][id^='layer-']:checked"))
        .filter(function (cb) {
            var lbl = cb.closest("label");
            return lbl && lbl.style.display !== "none";
        })
        .map(function (cb) { return cb.id.replace("layer-", ""); });

    plotAxesStack = plotAxesStack.filter(function (id) {
        return activeCheckboxes.includes(id);
    });

    activeCheckboxes.forEach(function (id) {
        if (plotAxesStack.indexOf(id) === -1) {
            plotAxesStack.push(id);
        }
    });

    if (activeCheckboxes.length === 0) {
        currentDailyDetailStateParcoords = null;
        renderPlotMessage(container, theme.messages.parcoords);
        renderBackButton(container, "stats-back-btn-parcoords", null);
        return;
    }

    var dimensions = [];
    var stateNames = dataStats.map(function (d) { return d.state; });
    var stateIndices = dataStats.map(function (d, i) { return i; });

    // Always "Region" first
    dimensions.push({
        label: isDetailMode ? "AQS site (" + currentDailyDetailStateParcoords + ")" : "Region",
        values: stateIndices,
        tickvals: stateIndices,
        ticktext: stateNames,
        type: "category"
    });

    // Helper to add dimension
    function addDim(label, values, decimals) {
        var dim = { label: label, values: values };
        if (typeof decimals === "number") {
            dim.tickformat = "." + decimals + "f";
        }
        dimensions.push(dim);
    }

    // Helper to get checkbox label
    function getLabel(id) {
        var el = document.getElementById("layer-" + id);
        return (el && el.parentElement) ? el.parentElement.textContent.trim() : null;
    }

    var currentDataset = getDatasetInfo().value;
    var templates = LAYER_TEMPLATES || [];

    // Iterate stack to add dimensions in order
    plotAxesStack.forEach(function (layerId) {
        var cb = document.getElementById("layer-" + layerId);
        if (!cb) return;
        var lbl = cb.closest("label") || cb.parentElement;
        if (!lbl || lbl.style.display === "none") return;

        var userLabel = (lbl) ? lbl.textContent.trim() : getLabel(layerId);

        // Find all matching templates (to handle split layers like smoke/fire)
        var matches = templates.filter(function (t) { return t.id === layerId; });
        if (matches.length === 0) return;

        matches.forEach(function (tmpl) {
            // 1. Resolve Data Key
            var key = tmpl.id;
            if (tmpl.manualLayer) {
                if (typeof tmpl.field === "function") {
                    key = tmpl.field(currentDataset);
                } else {
                    key = tmpl.field;
                }
            }

            // 2. Get Data
            var vals = dataStats.map(function (d) {
                var v = d[key];
                if (v === undefined || v === null || v === "NA") return undefined;

                // Handle ratio strings like "10 / 100" for stats
                if (typeof v === "string" && v.indexOf("/") !== -1) {
                    return parseFloat(v.split("/")[0]);
                }
                return v;
            });

            // 3. Validation
            var isNumeric = vals.some(function (v) { return typeof v === "number"; });
            if (!isNumeric) return;

            // Emulate logic to hide secondary axes if empty (e.g. Smoke Medium/Heavy, FRP)
            if (key === "smokeMedium" || key === "smokeHeavy" || key === "fireFrp") {
                var maxVal = Math.max.apply(null, vals.map(function (v) { return v || 0; }));
                if (maxVal <= 0) return;
            }

            // 4. Resolve Title
            var title = userLabel;
            if (title) {
                if (tmpl.category === "light") title += " (L)";
                else if (tmpl.category === "medium") title += " (M)";
                else if (tmpl.category === "heavy") title += " (H)";
                else if (key === "fireCount") title += " (Count)";
                else if (key === "fireFrp") title += " (FRP)";
            } else {
                if (typeof tmpl.title === "function") {
                    title = tmpl.title(currentDataset);
                } else {
                    title = tmpl.title;
                }
                if (title.indexOf(" (ppb)") !== -1) title = title.replace(" (ppb)", "");
                else if (title.indexOf(" (ug m-3)") !== -1) title = title.replace(" (ug m-3)", "");
            }

            addDim(title, vals, tmpl.decimals);
        });
    });

    // Setup colors
    var colorVals = stateIndices;
    var colorscale = "Jet";

    var trace = {
        type: "parcoords",
        line: {
            color: colorVals,
            colorscale: colorscale,
            showscale: false,
            colorbar: null
        },
        dimensions: dimensions,
        labelfont: { family: "Inter, sans-serif", size: fontSize },
        tickfont: { family: "Inter, sans-serif", size: fontSize * 0.8 },
        rangefont: { family: "Inter, sans-serif", size: fontSize * 0.8 }
    };

    var layout = {
        paper_bgcolor: theme.paper_bgcolor,
        plot_bgcolor: theme.plot_bgcolor,
        font: {
            family: "Inter, sans-serif",
            size: fontSize,
            color: theme.axisText
        },
        height: 600,
        margin: { l: 130, r: 50, b: 50, t: 50 }
    };

    var filename = "parcoords_" + (isDetailMode ? currentDailyDetailStateParcoords : "allstate") + "_" + currentDate();
    var config = getPlotlyConfig(filename);
    config.displayModeBar = true;

    var attachStateSiteListeners = function () {
        var callback;

        if (!isDetailMode) {
            // Drill-down to State
            callback = function (stateName) {
                if (stateNames.indexOf(stateName) !== -1) {
                    currentDailyDetailStateParcoords = stateName;
                    renderParCoords(containerId);
                }
            };
        } else {
            // Highlight Site on Map
            callback = function (siteId) {

                var s = dataStats.find(function (r) { return r.state === siteId; });

                if (s && s._coords && s._properties) {
                    highlightSiteOnMap(s._coords, s._properties, getDatasetInfo().key);
                }
            };
        }

        attachDrillDownListeners(container, ".tick text", callback);
    };

    clearPlotMessage(container);
    Plotly.react(container, [trace], layout, config).then(function () {

        attachStateSiteListeners();
        container.removeAllListeners("plotly_afterplot");
        container.on("plotly_afterplot", attachStateSiteListeners);

        attachResizeObserver(container, "_parcoordsObserver");
        renderBackButton(container, "stats-back-btn-parcoords", isDetailMode ? function () {
            currentDailyDetailStateParcoords = null;
            renderParCoords(containerId);
        } : null);
    });
};

// Export reset for ui-reset.js
export function resetState() {
    currentDailyDetailStateParcoords = null;
}

