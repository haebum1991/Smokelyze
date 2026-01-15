
import { ExcludeLayerGroups } from "./layers-def.js";
import { currentDate, ESML, highlightLocation } from "./utils.js";
import { loadedGeoJSON } from "./loader.js";
import {
    getPlotTheme,
    renderPlotMessage,
    renderBackButton,
    getDatasetInfo,
    getSpikeLayout,
    getPlotlyConfig,
    clearPlotMessage,
    highlightSiteOnMap,
    attachResizeObserver
} from "./stats-common.js";

var currentDailyDetailStateScatter = null;

export function renderDailyScatter(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var theme = getPlotTheme();
    var fontSize = parseInt(theme.fontSize, 10);
    var isDetailMode = !!currentDailyDetailStateScatter;

    var activeCheckboxes = Array.from(document.querySelectorAll("input[type=checkbox][id^='layer-']:checked"))
        .filter(function (cb) {

            // 체크박스: burn, smoke, fire, wildfire-news의 경우는 제외
            var id = cb.id.replace("layer-", "");
            var EXCLUDED = ExcludeLayerGroups.plotScatter;
            if (EXCLUDED.includes(id)) return false;

            var lbl = cb.closest("label");
            return lbl && lbl.style.display !== "none";
        });

    if (activeCheckboxes.length === 0) {
        currentDailyDetailStateScatter = null;
        renderPlotMessage(container, theme.messages.scatter);
        renderBackButton(container, "stats-back-btn-scatter", null);
        return;
    }

    var dsInfo = getDatasetInfo();
    var dsVal = dsInfo.value;
    var dsKey = dsInfo.key;
    var rawData = loadedGeoJSON ? loadedGeoJSON[dsKey] : null;

    if (!rawData || !rawData.features) {
        renderPlotMessage(container, theme.messages.scatter);
        renderBackButton(container, "stats-back-btn-scatter", isDetailMode ? function () {
            currentDailyDetailStateScatter = null;
            renderDailyScatter(containerId);
        } : null);
        return;
    }

    var f1 = rawData.features;
    if (isDetailMode) {
        f1 = f1.filter(function (fi) {
            return fi.properties.state === currentDailyDetailStateScatter;
        });
    }

    var yKey = "MDA8O3";
    var xKey = "MDA8O3_pred";
    var xKey2 = null;
    var primLabel = "";
    var secLabel = "";

    var yTitle = "Observed MDA8 O3 (ppb)";
    var xTitle = "Predicted MDA8 O3 (ppb)";

    // Smoke column keys
    var smokeKeyPrim = "smoke";
    var smokeKeySec = "smoke";

    if (dsVal === "gam-v2") {
        xKey2 = "edm_MDA8O3_pred";
        primLabel = "";
        secLabel = "EDM";
    } else if (dsVal === "pm-cbsa") {
        yKey = "PM2.5";
        xKey = "smoke_PM2.5_m0p5m";
        xKey2 = "smoke_PM2.5_m1p0m";

        yTitle = "Observed PM2.5 (µg m⁻³)";
        xTitle = "Smoke PM2.5 (µg m⁻³)";

        primLabel = "m0p5m";
        secLabel = "m1p0m";

        smokeKeyPrim = "smoke_m0p5m";
        smokeKeySec = "smoke_m1p0m";
    }

    var stateKey = "state"
    var siteKey = "site_name"
    var aqsKey = (dsVal === "pm-cbsa") ? "AQS_PM" : "AQS_O3";
    var traces = [];

    function getDataSplitBySmoke(feats, xK, yK, sKey) {
        var nonSmoke = { x: [], y: [], text: [], customdata: [] };
        var smoke = { x: [], y: [], text: [], customdata: [] };

        feats.forEach(function (fi) {
            var p = fi.properties;
            var xv = p[xK];
            var yv = p[yK];

            var s = p.smoke;
            if (sKey && p[sKey] !== undefined) {
                s = p[sKey];
            }

            if (xv !== undefined && xv !== null && yv !== undefined && yv !== null) {
                var ptName = p[siteKey] || "";
                var ptState = p[stateKey] || "";
                var ptAQS = p[aqsKey] || "";

                // Combine info into a single text string for hover
                var hoverText =
                    "State: " + ESML(ptState) + "<br>" +
                    "AQS: " + ESML(ptAQS) + "<br>" +
                    "Site name: " + ESML(ptName);

                if (Number(s) === 1) {
                    // Smoke
                    smoke.x.push(xv);
                    smoke.y.push(yv);
                    smoke.text.push(hoverText);
                    smoke.customdata.push(p);
                } else {
                    // Non-smoke
                    nonSmoke.x.push(xv);
                    nonSmoke.y.push(yv);
                    nonSmoke.text.push(hoverText);
                    nonSmoke.customdata.push(p);
                }
            }
        });
        return { nonSmoke: nonSmoke, smoke: smoke };
    }

    // Pre-define hover templates
    var hoverEMBER = "%{text}<br>" +
        yTitle + ": %{y:.0f}<br>" +
        xTitle + ": %{x:.1f}<extra></extra>";

    if (dsVal === "pm-cbsa") {
        var plot_title = "Comparison by AQS: PM2.5 vs Smoke PM2.5 <br> (date: " + currentDate() + ", source: " + ESML(dsVal) + ")"
        var hover1 = "%{text}<br>" +
            yTitle + ": %{y:.1f}<br>" +
            xTitle + (primLabel ? " (" + primLabel + ")" : "") + ": %{x:.2f}<extra></extra>";
        var hover2 = "%{text}<br>" +
            yTitle + ": %{y:.1f}<br>" +
            xTitle + " (" + secLabel + "): %{x:.2f}<extra></extra>";
    } else {
        var plot_title = "Comparison by AQS: Obs. vs Pred. <br> (date: " + currentDate() + ", source: " + ESML(dsVal) + ")"
        var hover1 = "%{text}<br>" +
            yTitle + ": %{y:.0f}<br>" +
            xTitle + (primLabel ? " (" + primLabel + ")" : "") + ": %{x:.1f}<extra></extra>";
        var hover2 = "%{text}<br>" +
            yTitle + ": %{y:.0f}<br>" +
            xTitle + " (" + secLabel + "): %{x:.1f}<extra></extra>";
    }

    if (dsVal === "epa-ember") {
        var data1 = { x: [], y: [], text: [], customdata: [] };

        f1.forEach(function (fi) {
            var p = fi.properties;
            var xv = p[xKey];
            var yv = p[yKey];
            if (xv !== undefined && xv !== null && yv !== undefined && yv !== null) {
                data1.x.push(xv);
                data1.y.push(yv);

                var ptName = p[siteKey] || "";
                var ptState = p[stateKey] || "";
                var ptAQS = p[aqsKey] || "";
                var hoverText =
                    "State: " + ESML(ptState) + "<br>" +
                    "AQS: " + ESML(ptAQS) + "<br>" +
                    "Site name: " + ESML(ptName);

                data1.text.push(hoverText);
                data1.customdata.push(p);
            }
        });

        if (data1.x.length > 0) {
            traces.push({
                x: data1.x,
                y: data1.y,
                mode: "markers",
                type: "scatter",
                name: "Obs vs Pred",
                text: data1.text,
                customdata: data1.customdata,
                marker: {
                    color: "black",
                    size: 8,
                    opacity: 0.8,
                    line: { color: theme.axisText, width: 0.5 }
                },
                hovertemplate: hoverEMBER
            });
        }
    } else {
        // Standard Logic with potential Dual Models

        // --- Model 1 ---
        var data1 = getDataSplitBySmoke(f1, xKey, yKey, smokeKeyPrim);

        if (data1.nonSmoke.x.length > 0 && dsVal !== "pm-cbsa") {
            traces.push({
                x: data1.nonSmoke.x,
                y: data1.nonSmoke.y,
                mode: "markers",
                type: "scatter",
                name: "Non-smoke day" + (primLabel ? " (" + primLabel + ")" : ""),
                text: data1.nonSmoke.text,
                customdata: data1.nonSmoke.customdata,
                marker: {
                    color: "black",
                    size: 8,
                    opacity: 0.8,
                    line: { color: theme.axisText, width: 0.5 }
                },
                hovertemplate: hover1
            });
        }

        if (data1.smoke.x.length > 0) {
            traces.push({
                x: data1.smoke.x,
                y: data1.smoke.y,
                mode: "markers",
                type: "scatter",
                name: "Smoke day" + (primLabel ? " (" + primLabel + ")" : ""),
                text: data1.smoke.text,
                customdata: data1.smoke.customdata,
                marker: {
                    color: "red",
                    size: 8,
                    opacity: 0.8,
                    line: { color: theme.axisText, width: 0.5 }
                },
                hovertemplate: hover1
            });
        }

        // --- Model 2 (if exists) ---
        if (xKey2) {
            var data2 = getDataSplitBySmoke(f1, xKey2, yKey, smokeKeySec);

            if (data2.nonSmoke.x.length > 0 && dsVal !== "pm-cbsa") {
                traces.push({
                    x: data2.nonSmoke.x,
                    y: data2.nonSmoke.y,
                    mode: "markers",
                    type: "scatter",
                    name: "Non-smoke day (" + secLabel + ")",
                    text: data2.nonSmoke.text,
                    customdata: data2.nonSmoke.customdata,
                    marker: {
                        color: "cyan",
                        size: 8,
                        opacity: 0.8,
                        line: { color: theme.axisText, width: 0.5 }
                    },
                    hovertemplate: hover2
                });
            }

            if (data2.smoke.x.length > 0) {
                traces.push({
                    x: data2.smoke.x,
                    y: data2.smoke.y,
                    mode: "markers",
                    type: "scatter",
                    name: "Smoke day (" + secLabel + ")",
                    text: data2.smoke.text,
                    customdata: data2.smoke.customdata,
                    marker: {
                        color: "magenta",
                        size: 8,
                        opacity: 0.8,
                        line: { color: theme.axisText, width: 0.5 }
                    },
                    hovertemplate: hover2
                });
            }
        }
    }

    var minVal = null;
    var maxVal = null;

    if (traces.length > 0) {
        var allVals = [];
        traces.forEach(function (t) {
            if (t.x) allVals = allVals.concat(t.x);
            if (t.y) allVals = allVals.concat(t.y);
        });
        if (allVals.length > 0) {
            minVal = Math.min(...allVals);
            maxVal = Math.max(...allVals);
            minVal = minVal - 5;
            maxVal = maxVal + 5;
        }
    }

    if (minVal !== null && maxVal !== null) {
        traces.push({
            x: [minVal, maxVal],
            y: [minVal, maxVal],
            mode: "lines",
            name: "1:1 line",
            line: {
                color: "red",
                width: 2 // Bold
            },
            hoverinfo: "skip"
        });
    }

    if (traces.length === 0) {
        renderPlotMessage(container, theme.messages.scatter);
        renderBackButton(container, "stats-back-btn-scatter", isDetailMode ? function () {
            currentDailyDetailStateScatter = null;
            renderDailyScatter(containerId);
        } : null);
        return;
    }

    var layout = {
        paper_bgcolor: theme.paper_bgcolor,
        plot_bgcolor: theme.plot_bgcolor,
        title: {
            text: plot_title,
            font: { size: fontSize, color: theme.axisText },
            x: 0.5,
            xanchor: "center"
        },
        xaxis: Object.assign({}, getSpikeLayout(theme), {
            title: { text: xTitle, font: { size: fontSize, color: theme.axisText } },
            tickfont: { size: fontSize * 0.8, color: theme.axisText },
            gridcolor: theme.grid,
            zerolinecolor: theme.grid,
            linecolor: theme.axisText,
            mirror: true,
            range: [minVal, maxVal]
        }),
        yaxis: Object.assign({}, getSpikeLayout(theme), {
            title: { text: yTitle, font: { size: fontSize, color: theme.axisText } },
            tickfont: { size: fontSize * 0.8, color: theme.axisText },
            gridcolor: theme.grid,
            zerolinecolor: theme.grid,
            linecolor: theme.axisText,
            mirror: true,
            range: [minVal, maxVal]
        }),
        legend: {
            orientation: "v",
            y: 0,
            x: 1,
            yanchor: "bottom",
            xanchor: "right",
            bordercolor: theme.axisText,
            borderwidth: 1,
            font: { color: theme.axisText }
        },
        hovermode: "closest",
        shapes: dsKey === "pm_cbsa" ? [] : [
            {
                type: "line",
                x0: minVal,
                x1: maxVal,
                y0: 70,
                y1: 70,
                line: {
                    color: "orange",
                    width: 2
                }
            }
        ],
        annotations: dsKey === "pm_cbsa" ? [] : [
            {
                x: maxVal,
                y: 70,
                xref: "x",
                yref: "y",
                text: "70 ppb",
                showarrow: false,
                xanchor: "left",
                font: {
                    color: theme.axisText,
                    size: fontSize * 0.8
                }
            }
        ],
        margin: { t: 70, r: 50, b: 50, l: 50 }
    };

    var filename = "scatter_" + (isDetailMode ? currentDailyDetailStateScatter : "allstate") + "_" + currentDate();
    var config = getPlotlyConfig(filename);

    clearPlotMessage(container);
    Plotly.react(container, traces, layout, config).then(function () {

        container.on("plotly_click", function (data) {
            if (data.points.length > 0) {
                var pt = data.points[0];
                var props = pt.customdata;
                if (props) {
                    if (highlightLocation) {

                        var s = f1.find(f => f.properties === props);

                        if (!s && props.ID) {
                            s = f1.find(f => f.properties.ID === props.ID);
                        }

                        if (s && s.geometry) {
                            highlightSiteOnMap(s.geometry.coordinates, props, dsInfo.key);
                        }
                    }
                }
            }
        });

        attachResizeObserver(container, "_scatterObserver");
        renderBackButton(container, "stats-back-btn-scatter", isDetailMode ? function () {
            currentDailyDetailStateScatter = null;
            renderDailyScatter(containerId);
        } : null);

    });
};

// Export reset for ui-reset.js
export function resetState() {
    currentDailyDetailStateScatter = null;
}

