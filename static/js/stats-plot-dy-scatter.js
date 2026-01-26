
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

let currentDailyDetailStateScatter = null;

export function renderDailyScatter(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const theme = getPlotTheme();
    const fontSize = parseInt(theme.fontSize, 10);
    const isDetailMode = !!currentDailyDetailStateScatter;

    const activeCheckboxes = Array.from(document.querySelectorAll("input[type=checkbox][id^='layer-']:checked"))
        .filter(cb => {
            // 체크박스: burn, smoke, fire, wildfire-news의 경우는 제외
            const id = cb.id.replace("layer-", "");
            const EXCLUDED = ExcludeLayerGroups.plotScatter;
            if (EXCLUDED.includes(id)) return false;

            const lbl = cb.closest("label");
            return lbl && lbl.style.display !== "none";
        });

    if (activeCheckboxes.length === 0) {
        currentDailyDetailStateScatter = null;
        renderPlotMessage(container, theme.messages.scatter);
        renderBackButton(container, "stats-back-btn-scatter", null);
        return;
    }

    const { value: dsVal, key: dsKey } = getDatasetInfo();
    const rawData = loadedGeoJSON?.[dsKey];

    if (!rawData?.features) {
        renderPlotMessage(container, theme.messages.scatter);
        renderBackButton(container, "stats-back-btn-scatter", isDetailMode ? () => {
            currentDailyDetailStateScatter = null;
            renderDailyScatter(containerId);
        } : null);
        return;
    }

    let f1 = rawData.features;
    if (isDetailMode) {
        f1 = f1.filter(fi => fi.properties.state === currentDailyDetailStateScatter);
    }

    let yKey = "MDA8O3";
    let xKey = "MDA8O3_pred";
    let xKey2 = null;
    let primLabel = "";
    let secLabel = "";

    let yTitle = "Observed MDA8 O3 (ppb)";
    let xTitle = "Predicted MDA8 O3 (ppb)";

    // Smoke column keys
    let smokeKeyPrim = "smoke";
    let smokeKeySec = "smoke";

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

    const stateKey = "state";
    const siteKey = "site_name";
    const aqsKey = (dsVal === "pm-cbsa") ? "AQS_PM" : "AQS_O3";
    const traces = [];

    const getDataSplitBySmoke = (feats, xK, yK, sKey) => {
        const nonSmoke = { x: [], y: [], text: [], customdata: [] };
        const smoke = { x: [], y: [], text: [], customdata: [] };

        feats.forEach(fi => {
            const p = fi.properties;
            const xv = p[xK];
            const yv = p[yK];

            let s = p.smoke;
            if (sKey && p[sKey] !== undefined) {
                s = p[sKey];
            }

            if (xv !== undefined && xv !== null && yv !== undefined && yv !== null) {
                const ptName = p[siteKey] || "";
                const ptState = p[stateKey] || "";
                const ptAQS = p[aqsKey] || "";

                // Combine info into a single text string for hover
                const hoverText = `State: ${ESML(ptState)}<br>AQS: ${ESML(ptAQS)}<br>Site name: ${ESML(ptName)}`;

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
        return { nonSmoke, smoke };
    };

    // Pre-define hover templates
    const hoverEMBER = `${yTitle}: %{y:.0f}<br>${xTitle}: %{x:.1f}<br>%{text}<extra></extra>`;

    let plot_title = `Comparison by AQS: Obs. vs Pred. <br> (date: ${currentDate()}, source: ${ESML(dsVal)})`;
    let hover1 = `${yTitle}: %{y:.1f}<br>${xTitle}${primLabel ? ` (${primLabel})` : ""}: %{x:.2f}<br>%{text}<extra></extra>`;
    let hover2 = `${yTitle}: %{y:.1f}<br>${xTitle} (${secLabel}): %{x:.2f}<br>%{text}<extra></extra>`;

    if (dsVal === "pm-cbsa") {
        plot_title = `Comparison by AQS: PM2.5 vs Smoke PM2.5 <br> (date: ${currentDate()}, source: ${ESML(dsVal)})`;
    } else {
        hover1 = `${yTitle}: %{y:.0f}<br>${xTitle}${primLabel ? ` (${primLabel})` : ""}: %{x:.1f}<br>%{text}<extra></extra>`;
        hover2 = `${yTitle}: %{y:.0f}<br>${xTitle} (${secLabel}): %{x:.1f}<br>%{text}<extra></extra>`;
    }

    if (dsVal === "epa-ember") {
        const data1 = { x: [], y: [], text: [], customdata: [] };

        f1.forEach(fi => {
            const p = fi.properties;
            const xv = p[xKey];
            const yv = p[yKey];
            if (xv !== undefined && xv !== null && yv !== undefined && yv !== null) {
                data1.x.push(xv);
                data1.y.push(yv);

                const ptName = p[siteKey] || "";
                const ptState = p[stateKey] || "";
                const ptAQS = p[aqsKey] || "";
                const hoverText = `State: ${ESML(ptState)}<br>AQS: ${ESML(ptAQS)}<br>Site name: ${ESML(ptName)}`;

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
        const data1 = getDataSplitBySmoke(f1, xKey, yKey, smokeKeyPrim);

        if (data1.nonSmoke.x.length > 0 && dsVal !== "pm-cbsa") {
            traces.push({
                x: data1.nonSmoke.x,
                y: data1.nonSmoke.y,
                mode: "markers",
                type: "scatter",
                name: `Non-smoke day${primLabel ? ` (${primLabel})` : ""}`,
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
                name: `Smoke day${primLabel ? ` (${primLabel})` : ""}`,
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
            const data2 = getDataSplitBySmoke(f1, xKey2, yKey, smokeKeySec);

            if (data2.nonSmoke.x.length > 0 && dsVal !== "pm-cbsa") {
                traces.push({
                    x: data2.nonSmoke.x,
                    y: data2.nonSmoke.y,
                    mode: "markers",
                    type: "scatter",
                    name: `Non-smoke day (${secLabel})`,
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
                    name: `Smoke day (${secLabel})`,
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

    let minVal = null;
    let maxVal = null;

    if (traces.length > 0) {
        let allVals = [];
        traces.forEach(t => {
            if (t.x) allVals = [...allVals, ...t.x];
            if (t.y) allVals = [...allVals, ...t.y];
        });
        if (allVals.length > 0) {
            minVal = Math.min(...allVals) - 5;
            maxVal = Math.max(...allVals) + 5;
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
        renderBackButton(container, "stats-back-btn-scatter", isDetailMode ? () => {
            currentDailyDetailStateScatter = null;
            renderDailyScatter(containerId);
        } : null);
        return;
    }

    const layout = {
        paper_bgcolor: theme.paper_bgcolor,
        plot_bgcolor: theme.plot_bgcolor,
        title: {
            text: plot_title,
            font: { size: fontSize, color: theme.axisText },
            x: 0.5,
            xanchor: "center"
        },
        xaxis: {
            ...getSpikeLayout(theme),
            title: { text: xTitle, font: { size: fontSize, color: theme.axisText } },
            tickfont: { size: fontSize * 0.8, color: theme.axisText },
            gridcolor: theme.grid,
            zerolinecolor: theme.grid,
            linecolor: theme.axisText,
            mirror: true,
            range: [minVal, maxVal]
        },
        yaxis: {
            ...getSpikeLayout(theme),
            title: { text: yTitle, font: { size: fontSize, color: theme.axisText } },
            tickfont: { size: fontSize * 0.8, color: theme.axisText },
            gridcolor: theme.grid,
            zerolinecolor: theme.grid,
            linecolor: theme.axisText,
            mirror: true,
            range: [minVal, maxVal]
        },
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

    const filename = `scatter_${isDetailMode ? currentDailyDetailStateScatter : "allstate"}_${currentDate()}`;
    const config = getPlotlyConfig(filename);

    clearPlotMessage(container);
    Plotly.react(container, traces, layout, config).then(() => {
        container.on("plotly_click", (data) => {
            if (data.points.length > 0) {
                const pt = data.points[0];
                const props = pt.customdata;
                if (props && highlightLocation) {
                    let s = f1.find(f => f.properties === props);
                    if (!s && props.ID) {
                        s = f1.find(f => f.properties.ID === props.ID);
                    }
                    if (s?.geometry) {
                        highlightSiteOnMap(s.geometry.coordinates, props, dsInfo.key);
                    }
                }
            }
        });

        attachResizeObserver(container, "_scatterObserver");
        renderBackButton(container, "stats-back-btn-scatter", isDetailMode ? () => {
            currentDailyDetailStateScatter = null;
            renderDailyScatter(containerId);
        } : null);
    });
}

// Export reset for ui-reset.js
export function resetState() {
    currentDailyDetailStateScatter = null;
}

