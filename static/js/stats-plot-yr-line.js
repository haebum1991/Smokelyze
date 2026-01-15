
import { currentDate } from "./utils.js";
import {
    getPlotTheme,
    getPlotlyConfig,
    getMetricInfo,
    extractUnit,
    getSpikeLayout,
    clearPlotMessage,
    attachResizeObserver,
    renderPlotMessage,
    selectedRegionsByMetric,
    setOnRenderLinePlot,
    setOnCurrentPlotHide
} from "./stats-common.js";
import { yearStatsCache } from "./stats-yearly.js";

export function currentPlotHide(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";
}

export function renderLinePlot(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";

    var byMetric = selectedRegionsByMetric;
    var metrics = Object.keys(byMetric).filter(function (m) {
        return Array.isArray(byMetric[m]) && byMetric[m].length;
    });

    if (!metrics.length) {
        container.innerHTML = "<p style='text-align: center';>[Lineplot panel] Select cells where you want the results to appear.</p>";
        return;
    }

    var yearEl = document.getElementById("StatsInputYear");
    var year =
        (yearEl && yearEl.dataset.yearValue) ?
            yearEl.dataset.yearValue :
            (currentDate ? currentDate().slice(0, 4) : String(new Date().getFullYear()));

    var cache = yearStatsCache || { burn: {}, smoke: {}, fire: {} };
    var burnYear = cache.burn[year];
    var smokeYear = cache.smoke[year];
    var fireYear = cache.fire[year];

    function getMonthlyValue(metric, month, regionId) {
        var row, v;

        if (metric === "burn") {
            if (!Array.isArray(burnYear)) return 0;
            row = burnYear.find(function (d) { return Number(d.month) === month; });
            if (row && Object.prototype.hasOwnProperty.call(row, regionId)) {
                return Number(row[regionId]) || 0;
            }
            return 0;
        }

        if (metric === "smokeLight" || metric === "smokeMedium" || metric === "smokeHeavy") {
            if (!Array.isArray(smokeYear)) return 0;
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
                return Number(row[regionId]) || 0;
            }
            return 0;
        }

        if (metric === "fireCount" || metric === "fireFrp") {
            if (!Array.isArray(fireYear)) return 0;
            var catFire = (metric === "fireCount") ? "n_fires" : "frp";

            row = fireYear.find(function (d) {
                return Number(d.month) === month &&
                    String(d.category || "").toLowerCase() === catFire;
            });
            if (row && Object.prototype.hasOwnProperty.call(row, regionId)) {
                v = Number(row[regionId]) || 0;
                return v;
            }
            return 0;
        }

        // Model / Dynamic metrics logic could go here if year data allows
        return 0;
    }

    var months = [];
    for (var m = 1; m <= 12; m++) months.push(m);

    var theme = getPlotTheme();
    var fontSize = parseInt(theme.fontSize, 10);
    
    var filename = "line_" + currentDate();
    var config = getPlotlyConfig(filename);

    container.innerHTML = "";

    metrics.forEach(function (metric, idx) {

        // Validate data availability
        if (metric === "burn" && !Array.isArray(burnYear)) return;
        if ((metric === "smokeLight" || metric === "smokeMedium" || metric === "smokeHeavy") && !Array.isArray(smokeYear)) return;
        if ((metric === "fireCount" || metric === "fireFrp") && !Array.isArray(fireYear)) return;

        var info = getMetricInfo(metric);

        var selected = byMetric[metric];

        var plotDiv = document.createElement("div");
        plotDiv.className = "stats-plot-tab-panel";
        plotDiv.style.marginTop = idx === 0 ? "0" : "2.4rem";
        container.appendChild(plotDiv);

        var traces = [];
        selected.forEach(function (regionId) {
            var values = [];
            for (var mm = 1; mm <= 12; mm++) {
                values.push(getMonthlyValue(metric, mm, regionId));
            }

            var unit = extractUnit(info.y);

            var hoverDecimals = (info.decimals !== undefined) ? info.decimals : 0;
            var hoverTemplate = "<b style='font-weight: bold; color: var(--card-shadow);'>%{y:,." + hoverDecimals + "f}</b> " + unit + "<extra></extra>";

            traces.push({
                x: months,
                y: values,
                name: regionId,
                mode: "lines+markers",
                hovertemplate: hoverTemplate
            });
        });

        var layout = {
            paper_bgcolor: theme.paper_bgcolor,
            plot_bgcolor: theme.plot_bgcolor,
            title: {
                text: year + " " + info.title,
                font: { color: theme.axisText, size: fontSize }
            },
            hovermode: "x unified",
            hoverlabel: {
                font: {
                    color: theme.axisText
                }
            },
            xaxis: Object.assign({}, getSpikeLayout(theme), {
                title: {
                    text: "Month",
                    font: { size: fontSize, color: theme.axisText },
                    standoff: 20
                },
                dtick: 1,
                tickfont: { size: fontSize * 0.8, color: theme.axisText },
                gridcolor: theme.grid,
                zerolinecolor: theme.grid,
                showline: true,
                automargin: true,
                linecolor: theme.axisText,
                linewidth: 1,
                mirror: "allticks"
            }),
            yaxis: Object.assign({}, getSpikeLayout(theme), {
                title: {
                    text: info.y,
                    font: { size: fontSize, color: theme.axisText },
                    standoff: 20
                },
                tickfont: { size: fontSize * 0.8, color: theme.axisText },
                gridcolor: theme.grid,
                zerolinecolor: theme.grid,
                showline: true,
                automargin: true,
                linecolor: theme.axisText,
                linewidth: 1,
                mirror: "allticks"
            }),
            legend: {
                orientation: "v",
                x: 1,
                y: 1,
                xanchor: "right",
                yanchor: "top",
                borderwidth: 1,
                bgcolor: theme.legendBg,
                bordercolor: theme.axisText,
                font: { size: fontSize * 0.8, color: theme.axisText }
            },
            margin: { t: 40, r: 5, b: 5, l: 5 }
        };

        clearPlotMessage(plotDiv);
        Plotly.react(plotDiv, traces, layout, config).then(function () {
            attachResizeObserver(plotDiv, "_lineObserver");
            window.requestAnimationFrame(function () {
                if (plotDiv.offsetParent) {
                    Plotly.Plots.resize(plotDiv);
                }
            });
        });
    });
}

// Register callback
setOnRenderLinePlot(renderLinePlot);
setOnCurrentPlotHide(currentPlotHide);

