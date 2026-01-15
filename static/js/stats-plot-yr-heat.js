
import { currentDate } from "./utils.js";
import {
    usStates,
    getPlotTheme,
    getPlotlyConfig,
    getStandardMetrics,
    isMetricVisible,
    getMetricInfo,
    extractUnit,
    renderPlotMessage,
    clearPlotMessage,
    attachResizeObserver
} from "./stats-common.js";
import { yearStatsCache } from "./stats-yearly.js";

export function renderHeatmap(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";

    var yearEl = document.getElementById("StatsInputYear");
    var year =
        (yearEl && yearEl.dataset.yearValue) ?
            yearEl.dataset.yearValue :
            (currentDate ? currentDate().slice(0, 4) : String(new Date().getFullYear()));

    var cache = yearStatsCache || { burn: {}, smoke: {}, fire: {} };

    var burnYear = cache.burn[year];
    var smokeYear = cache.smoke[year];
    var fireYear = cache.fire[year];

    var standardMetrics = getStandardMetrics();

    function getMonthlyValue(metric, month, regionId) {
        var row, v;

        if (metric === "burn") {
            if (!Array.isArray(burnYear)) return null;
            row = burnYear.find(function (d) { return Number(d.month) === month; });
            if (row && Object.prototype.hasOwnProperty.call(row, regionId)) {
                v = Number(row[regionId]);
                return v || null;
            }
            return null;
        }

        if (metric === "smokeLight" || metric === "smokeMedium" || metric === "smokeHeavy") {
            if (!Array.isArray(smokeYear)) return null;
            var catMap = {
                smokeLight: "light",
                smokeMedium: "medium",
                smokeHeavy: "heavy"
            };
            var cat = catMap[metric];

            row = smokeYear.find(function (d) {
                return Number(d.month) === month &&
                    String(d.category || "").toLowerCase() === cat;
            });
            if (row && Object.prototype.hasOwnProperty.call(row, regionId)) {
                v = Number(row[regionId]);
                return v || null;
            }
            return null;
        }

        if (metric === "fireCount" || metric === "fireFrp") {
            if (!Array.isArray(fireYear)) return null;
            var catFire = (metric === "fireCount") ? "n_fires" : "frp";

            row = fireYear.find(function (d) {
                return Number(d.month) === month &&
                    String(d.category || "").toLowerCase() === catFire;
            });
            if (row && Object.prototype.hasOwnProperty.call(row, regionId)) {
                v = Number(row[regionId]);
                return v || null;
            }
            return null;
        }

        return null;
    }

    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    var theme = getPlotTheme();
    var fontSize = parseInt(theme.fontSize, 10);
    var renderedCount = 0;
    var visibleMetrics = standardMetrics.filter(function (m) { return isMetricVisible(m); });

    if (visibleMetrics.length === 0) {
        renderPlotMessage(container, theme.messages.heatmap);
        return;
    }

    visibleMetrics.forEach(function (metric) {

        var info = getMetricInfo(metric);

        if (metric === "burn" && !Array.isArray(burnYear)) return;
        if ((metric.indexOf("smoke") !== -1) && !Array.isArray(smokeYear)) return;
        if ((metric.indexOf("fire") !== -1 || metric.indexOf("Frp") !== -1) && !Array.isArray(fireYear)) return;

        var zValues = [];
        var hasAnyData = false;

        for (var mIndex = 0; mIndex < 12; mIndex++) {
            var monthNum = mIndex + 1;
            var rowVals = [];
            usStates.forEach(function (state) {
                var val = getMonthlyValue(metric, monthNum, state);
                if (val !== null && val !== undefined && val !== 0) {
                    hasAnyData = true;
                }
                rowVals.push(val);
            });
            zValues.push(rowVals);
        }

        if (!hasAnyData) return;

        renderedCount++;

        var plotDiv = document.createElement("div");
        plotDiv.className = "stats-plot-tab-panel";
        plotDiv.style.marginTop = renderedCount === 1 ? "0" : "2.4rem";
        container.appendChild(plotDiv);

        var unit = extractUnit(info.y);

        var hoverDecimals = (info.decimals !== undefined) ? info.decimals : 0;
        var hoverTemplate =
            "<b style='font-size: 1.6rem; color: var(--card-shadow);'>%{z:,." + hoverDecimals + "f}</b> <span style='font-size: 1.6rem; color: var(--text-strong);'> " + unit + "</span><br>" +
            "<b style='color: var(--text-strong);'>%{x}</b>" +
            "<extra></extra>";

        var traces = [{
            z: zValues,
            x: usStates,
            y: months,
            type: "heatmap",
            colorscale: "Jet",
            hovertemplate: hoverTemplate,
            hoverlabel: {
                bgcolor: theme.plot_bgcolor
            },
            colorbar: {
                title: info.y,
                titleside: "bottom",
                titlefont: {
                    size: fontSize,
                    color: theme.axisText
                },
                tickfont: {
                    size: fontSize * 0.8,
                    color: theme.axisText
                },
                orientation: "h",
                x: 0.5,
                y: -0.3,
                xanchor: "center",
                thickness: 10
            },
            xgap: 1,
            ygap: 1
        }];

        var layout = {
            paper_bgcolor: theme.paper_bgcolor,
            plot_bgcolor: theme.plot_bgcolor,
            xaxis: {
                tickangle: -90,
                tickfont: { size: fontSize * 0.8, color: theme.axisText },
                side: "top",
                automargin: true,
                linecolor: theme.axisText,
                linewidth: 1,
                mirror: true
            },
            yaxis: {
                title: {
                    text: year + " " + info.title,
                    font: { size: fontSize, color: theme.axisText },
                    standoff: 20
                },
                tickfont: { size: fontSize * 0.8, color: theme.axisText },
                automargin: true,
                linecolor: theme.axisText,
                linewidth: 1,
                mirror: true
            },
            margin: { t: 5, r: 5, b: 5, l: 5 }
        };

        clearPlotMessage(plotDiv);
        var currentFilename = "heatmap_" + metric + "_" + currentDate();
        var currentConfig = getPlotlyConfig(currentFilename);

        Plotly.react(plotDiv, traces, layout, currentConfig).then(function () {
            attachResizeObserver(plotDiv, "_heatmapObserver");
            window.requestAnimationFrame(function () {
                if (plotDiv.offsetParent) {
                    Plotly.Plots.resize(plotDiv);
                }
            });
        });
    });

    if (renderedCount === 0) {
        renderPlotMessage(container, theme.messages.heatmap);
    }
};

