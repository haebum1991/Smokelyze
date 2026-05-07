
/**
 * Data Page Plotting Logic
 * Handles rendering Plotly charts for AQS query results
 */
import { getPlotTheme, getSpikeLayout, getPlotlyConfig, resetPlotContainer } from "./stats-common.js";

/**
 * Centralized Style Map for AQS Plots
 */
function getAqsStyleMap(theme) {
    return {
        "mda8-obs": {
            color: "green",
            marker: { symbol: "circle", size: 6, color: "white", line: { width: 1, color: "green" } }
        },
        "mda8-pred": {
            color: "magenta",
            marker: { symbol: "circle", size: 6, color: "white", line: { width: 1, color: "magenta" } }
        },
        "mda8-pred-edm": {
            color: "magenta",
            dash: "dot",
            marker: { symbol: "square", size: 6, color: "magenta", line: { width: 1, color: "magenta" } }
        },
        "smo": {
            color: "#4169E1",
            marker: { symbol: "circle", size: 6, color: "white", line: { width: 1, color: "#4169E1" } }
        },
        "smo-edm": {
            color: "#4169E1",
            dash: "dot",
            marker: { symbol: "square", size: 6, color: "#4169E1", line: { width: 1, color: "#4169E1" } }
        },
        "pm25-obs": {
            color: theme.axisText,
            marker: { symbol: "square", size: 6, color: theme.paper_bgcolor, line: { width: 1, color: theme.axisText } }
        },
        "scatter-smoke-marker-pm25-m0p5m": { color: "red", size: 10, opacity: 0.8 },
        "scatter-smoke-marker-pm25-m1p0m": { color: "cyan", size: 8, opacity: 0.8 },
        "scatter-smoke-marker": { color: "red", size: 8, opacity: 0.8 },
        "scatter-smoke": {
            color: "red",
            marker: { symbol: "circle", size: 7, color: "red", opacity: 0.9, line: { width: 1, color: "white" } }
        },
        "scatter-smoke-edm": {
            color: "magenta",
            marker: { symbol: "circle", size: 7, color: "magenta", opacity: 0.9, line: { width: 1, color: "white" } }
        },
        "scatter-non-smoke": {
            color: "#333333",
            marker: { symbol: "circle", size: 6, color: "#333333", opacity: 0.7, line: { width: 1, color: "white" } }
        },
        "scatter-non-smoke-edm": {
            color: "cyan",
            marker: { symbol: "circle", size: 6, color: "cyan", opacity: 0.7, line: { width: 1, color: "white" } }
        },
        "monthly-bar": { color: "#A9A9A9" },
        "annual-smoke": { color: "red" },
        "annual-smoke-smo": { color: "#4169E1" },
        "annual-smoke-alt": { color: "darkred" },
        "annual-not-smoke": { color: "green" },
        "annual-not-smoke-alt": { color: "darkgreen" }
    };
}

/**
 * Helper to apply styles from the style map to a trace
 */
function applyTraceStyle(trace, styleKey, theme) {
    const style = getAqsStyleMap(theme)[styleKey];
    if (!style) return;

    if (!trace.line) trace.line = {};
    if (!trace.marker) trace.marker = {};

    if (style.color) {
        trace.line.color = style.color;
        if (!style.marker || !style.marker.color) {
            trace.marker.color = style.color;
        }
    }
    if (style.dash) {
        trace.line.dash = style.dash;
    }
    if (style.marker) {
        Object.assign(trace.marker, style.marker);
    }
    if (style.size) {
        trace.marker.size = style.size;
    }
    if (style.opacity) {
        trace.marker.opacity = style.opacity;
    }
}

/**
 * Main function to render all AQS plots
 */
// Store current data for re-rendering on theme change
let _cachedTableData = null;
let _cachedDsId = null;
let _cachedAqs = null;

/**
 * Internal function that performs the actual plotting
 */
function _innerRenderAQSPlots(tableData, dsId, aqs) {
    const theme = getPlotTheme();

    if (!tableData || tableData.length === 0) {
        ["DatadbPlot1", "DatadbPlot2", "DatadbPlot3", "DatadbPlot4"].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; height:100%; font-size:1.4rem; color:var(--text-muted);">No data available for the selected range.</div>`;
        });
        return;
    }

    // 1. Prepare Daily Time-series Plot
    renderDailyTimeSeriesPlot(theme, dsId, aqs, tableData);

    // 2. Prepare Scatter Plot
    renderScatterPlot(theme, dsId, aqs, tableData);

    // 3. Prepare Monthly Smoke Frequency Plot
    renderMonthlySmokePlot(theme, dsId, aqs, tableData);

    // 4. Prepare Annual Exceedance Plot
    renderAnnualExceedancePlot(theme, dsId, aqs, tableData);
}

/**
 * Main wrapper function to cache data and call internal render
 */
export function renderAQSPlots(tableData, dsId, aqs) {
    _cachedTableData = tableData;
    _cachedDsId = dsId;
    _cachedAqs = aqs;
    _innerRenderAQSPlots(tableData, dsId, aqs);
}

// Dedicated Theme Listener for AQS Plots
window.addEventListener("themeChanged", function () {
    // Only run if we actually have data loaded
    if (!_cachedTableData) return;

    const selector = [
        "#DatadbPlot1",
        "#DatadbPlot2",
        "#DatadbPlot3",
        "#DatadbPlot4"
    ].join(", ");

    const targets = document.querySelectorAll(selector);
    if (targets.length === 0) return;

    // 1. Fade Out
    targets.forEach(function (el) {
        el.style.transition = "opacity 0.3s ease";
        el.style.opacity = "0";
    });

    setTimeout(function () {
        // 2. Redraw with new theme (using cached data)
        _innerRenderAQSPlots(_cachedTableData, _cachedDsId, _cachedAqs);

        // 3. Fade In
        setTimeout(function () {
            const activeTargets = document.querySelectorAll(selector);
            activeTargets.forEach(function (el) {
                el.style.opacity = "1";
            });
        }, 150);
    }, 300);
});


function renderDailyTimeSeriesPlot(theme, dsId, aqs, tableData) {
    const container = document.getElementById("DatadbPlot1");
    if (!container) return;
    resetPlotContainer(container);

    let traces = [];
    let yTitle = dsId === "pm-cbsa" ? "Concentration (µg m⁻³)" : "MDA8 and SMO (ppb)";
    let plotTitle = dsId === "pm-cbsa" ? `Daily time-series<br>(AQS PM: ${aqs})` : `Daily time-series<br>(AQS O3: ${aqs})`;

    const sortedData = [...tableData].sort((a, b) => new Date(a.date) - new Date(b.date));
    const dates = sortedData.map(d => d.date);

    if (dsId === "pm-cbsa") {
        const tr1 = {
            x: dates, y: sortedData.map(d => d["PM2.5"]),
            name: "Obs PM2.5", type: "scatter", mode: "lines+markers",
            hoverinfo: "skip"
        };
        applyTraceStyle(tr1, "pm25-obs", theme);
        traces.push(tr1);

        traces.push({
            x: dates, y: sortedData.map(d => d["PM2.5"]),
            name: "", type: "scatter", mode: "markers",
            marker: { size: 0, color: "rgba(0,0,0,0)" },
            showlegend: false,
            hoverlabel: { namelength: 0 },
            customdata: sortedData.map(d => [
                d.smoke_m0p5m !== undefined ? (Number(d.smoke_m0p5m) === 1 ? "Y" : "N") : "NA",
                d.smoke_m1p0m !== undefined ? (Number(d.smoke_m1p0m) === 1 ? "Y" : "N") : "NA"
            ]),
            hovertemplate:
                "<b>%{x|%b %d, %Y}</b><br>" +
                "Obs PM2.5: %{y:.1f}<br>" +
                "Smoke day (m0p5m): %{customdata[0]}<br>" +
                "Smoke day (m1p0m): %{customdata[1]}<extra></extra>"
        });

        const tr2 = {
            x: dates,
            y: sortedData.map(d => Number(d.smoke_m0p5m) === 1 ? d["PM2.5"] : null),
            name: "Smoke day m0p5m (Y/N)", type: "scatter", mode: "markers",
            hoverinfo: "skip"
        };
        applyTraceStyle(tr2, "scatter-smoke-marker-pm25-m0p5m", theme);
        traces.push(tr2);
        
        const tr3 = {
            x: dates,
            y: sortedData.map(d => Number(d.smoke_m1p0m) === 1 ? d["PM2.5"] : null),
            name: "Smoke day m1p0m (Y/N)", type: "scatter", mode: "markers",
            hoverinfo: "skip"
        };
        applyTraceStyle(tr3, "scatter-smoke-marker-pm25-m1p0m", theme);
        traces.push(tr3);

    } else {
        const tr1 = {
            x: dates, y: sortedData.map(d => d["MDA8O3"]),
            name: "Obs MDA8", type: "scatter", mode: "lines+markers",
            hoverinfo: "skip"
        };
        applyTraceStyle(tr1, "mda8-obs", theme);
        traces.push(tr1);

        traces.push({
            x: dates, y: sortedData.map(d => d["MDA8O3"]),
            name: "", type: "scatter", mode: "markers",
            marker: { size: 0, color: "rgba(0,0,0,0)" },
            showlegend: false,
            hoverlabel: { namelength: 0 },
            customdata: sortedData.map(d => [
                d["MDA8O3_pred"] != null ? d["MDA8O3_pred"].toFixed(1) : "NA",
                dsId === "gam-v2" && d["edm_MDA8O3_pred"] != null ? d["edm_MDA8O3_pred"].toFixed(1) : "NA",
                (dsId === "epa-ember" || Number(d.smoke) === 1) ? (d["SMO"] || 0).toFixed(1) : "NA",
                dsId === "gam-v2" && Number(d.smoke) === 1 ? (d["edm_SMO"] || 0).toFixed(1) : "NA",
                Number(d.smoke) === 1 ? "Y" : "N"
            ]),
            hovertemplate:
                "Obs MDA8: %{y:.1f}<br>" +
                "Pred MDA8: %{customdata[0]}<br>" +
                (dsId === "gam-v2" ? "Pred MDA8 (EDM): %{customdata[1]}<br>" : "") +
                "SMO: %{customdata[2]}<br>" +
                (dsId === "gam-v2" ? "SMO (EDM): %{customdata[3]}<br>" : "") +
                (dsId === "epa-ember" ? "Day with SMO > 0: " : "Smoke day: ") + "%{customdata[4]}<extra></extra>"
        });

        const tr3 = {
            x: dates, y: sortedData.map(d => d["MDA8O3_pred"]),
            name: "Pred MDA8", type: "scatter", mode: "lines+markers",
            hoverinfo: "skip"
        };
        applyTraceStyle(tr3, "mda8-pred", theme);
        traces.push(tr3);

        if (dsId === "gam-v2" && sortedData.length > 0 && sortedData[0].edm_MDA8O3_pred !== undefined) {
            const tr3b = {
                x: dates, y: sortedData.map(d => d["edm_MDA8O3_pred"]),
                name: "Pred MDA8 (EDM) (ppb)", type: "scatter", mode: "lines+markers",
                hoverinfo: "skip"
            };
            applyTraceStyle(tr3b, "mda8-pred-edm", theme);
            traces.push(tr3b);
        }

        const tr4 = {
            x: dates, y: sortedData.map(d => Number(d.smoke) === 1 ? (d["SMO"] || 0) : null),
            name: "SMO (ppb)", type: "scatter", mode: "lines+markers",
            connectgaps: false,
            hoverinfo: "skip"
        };
        applyTraceStyle(tr4, "smo", theme);
        traces.push(tr4);

        if (dsId === "gam-v2" && sortedData.length > 0 && sortedData[0].edm_SMO !== undefined) {
            const tr4b = {
                x: dates, y: sortedData.map(d => Number(d.smoke) === 1 ? (d["edm_SMO"] || 0) : null),
                name: "SMO (EDM) (ppb)", type: "scatter", mode: "lines+markers",
                connectgaps: false,
                hoverinfo: "skip"
            };
            applyTraceStyle(tr4b, "smo-edm", theme);
            traces.push(tr4b);
        }

        const tr5 = {
            x: dates,
            y: sortedData.map(d => Number(d.smoke) === 1 ? d["MDA8O3"] : null),
            name: dsId === "epa-ember" ? "Day with SMO > 0 (Y/N)" : "Smoke day (Y/N)", type: "scatter", mode: "markers",
            hoverinfo: "skip"
        };
        applyTraceStyle(tr5, "scatter-smoke-marker", theme);
        traces.push(tr5);
    }

    const layout = {
        title: { text: plotTitle, font: { size: theme.fontSize * 0.9, color: theme.axisText }, y: 0.95 },
        hovermode: "x unified",
        paper_bgcolor: theme.paper_bgcolor, plot_bgcolor: theme.plot_bgcolor,
        xaxis: Object.assign({}, getSpikeLayout(theme), {
            title: { text: "Date", font: { color: theme.axisText, size: theme.fontSize * 0.8 } },
            tickfont: { color: theme.axisText, size: theme.fontSize * 0.8 },
            gridcolor: theme.grid,
            hoverformat: "%b %d, %Y"
        }),
        yaxis: Object.assign({}, getSpikeLayout(theme), {
            title: { text: yTitle, font: { color: theme.axisText, size: theme.fontSize * 0.8 } },
            tickfont: { color: theme.axisText, size: theme.fontSize * 0.8 },
            gridcolor: theme.grid
        }),
        legend: {
            font: { color: theme.axisText, size: theme.fontSize * 0.8 },
            orientation: "h", x: 0.5, xanchor: "center", y: -0.3, yanchor: "top"
        },
        shapes: dsId !== "pm-cbsa" ? [{
            type: "line", xref: "paper", x0: 0, x1: 1, yref: "y", y0: 70, y1: 70,
            line: { color: "grey", width: 1, dash: "dash" }
        }] : [],
        margin: { t: 80, b: 80, l: 60, r: 40 }
    };
    if (dsId !== "pm-cbsa") {
        layout.annotations = [{
            xref: "paper", x: 1, yref: "y", y: 70, text: "70 ppb", showarrow: false,
            xanchor: "left", font: { color: "grey", size: 10 }
        }];
    }

    Plotly.react(container, traces, layout, getPlotlyConfig(`timeseries_${aqs}`));
}

function renderScatterPlot(theme, dsId, aqs, tableData) {
    const container = document.getElementById("DatadbPlot2");
    if (!container) return;
    resetPlotContainer(container);

    if (dsId === "pm-cbsa") {
        container.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; height:100%; color:${theme.axisText}; font-size:1.4rem;">Scatter plot not supported for PM dataset.</div>`;
        return;
    }

    let traces = [];
    const nonSmoke = tableData.filter(d => Number(d.smoke) === 0);
    const smoke = tableData.filter(d => Number(d.smoke) === 1);

    if (dsId === "epa-ember") {
        const tr1 = {
            x: nonSmoke.map(d => d.MDA8O3_pred), y: nonSmoke.map(d => d.MDA8O3),
            mode: "markers", name: "Days with SMO=0", type: "scatter",
            customdata: nonSmoke.map(d => d.date),
            hovertemplate: "<b>Days with SMO=0</b><br>Date: %{customdata}<br>Obs MDA8: %{y:.1f}<br>Pred MDA8: %{x:.1f}<extra></extra>"
        };
        applyTraceStyle(tr1, "scatter-non-smoke", theme);
        traces.push(tr1);
    
        const tr2 = {
            x: smoke.map(d => d.MDA8O3_pred), y: smoke.map(d => d.MDA8O3),
            mode: "markers", name: "Days with SMO>0", type: "scatter",
            customdata: smoke.map(d => d.date),
            hovertemplate: "<b>Days with SMO>0</b><br>Date: %{customdata}<br>Obs MDA8: %{y:.1f}<br>Pred MDA8: %{x:.1f}<extra></extra>"
        };
        applyTraceStyle(tr2, "scatter-smoke", theme);
        traces.push(tr2);
    } else {
        const tr1 = {
            x: nonSmoke.map(d => d.MDA8O3_pred), y: nonSmoke.map(d => d.MDA8O3),
            mode: "markers", name: "Non-smoke day", type: "scatter",
            customdata: nonSmoke.map(d => d.date),
            hovertemplate: "<b>Non-smoke day</b><br>Date: %{customdata}<br>Obs MDA8: %{y:.1f}<br>Pred MDA8: %{x:.1f}<extra></extra>"
        };
        applyTraceStyle(tr1, "scatter-non-smoke", theme);
        traces.push(tr1);
    
        const tr2 = {
            x: smoke.map(d => d.MDA8O3_pred), y: smoke.map(d => d.MDA8O3),
            mode: "markers", name: "Smoke day", type: "scatter",
            customdata: smoke.map(d => d.date),
            hovertemplate: "<b>Smoke day</b><br>Date: %{customdata}<br>Obs MDA8: %{y:.1f}<br>Pred MDA8: %{x:.1f}<extra></extra>"
        };
        applyTraceStyle(tr2, "scatter-smoke", theme);
        traces.push(tr2);
    }
    


    const hasEdm = tableData.length > 0 && tableData[0].edm_MDA8O3_pred !== undefined;
    if (hasEdm) {
        const tr3 = {
            x: nonSmoke.map(d => d.edm_MDA8O3_pred), y: nonSmoke.map(d => d.MDA8O3),
            mode: "markers", name: "Non-smoke day (EDM)", type: "scatter",
            customdata: nonSmoke.map(d => d.date),
            hovertemplate: "<b>Non-smoke day (EDM)</b><br>Date: %{customdata}<br>Obs MDA8: %{y:.1f}<br>EDM Pred MDA8: %{x:.1f}<extra></extra>"
        };
        applyTraceStyle(tr3, "scatter-non-smoke-edm", theme);
        traces.push(tr3);

        const tr4 = {
            x: smoke.map(d => d.edm_MDA8O3_pred), y: smoke.map(d => d.MDA8O3),
            mode: "markers", name: "Smoke day (EDM)", type: "scatter",
            customdata: smoke.map(d => d.date),
            hovertemplate: "<b>Smoke day (EDM)</b><br>Date: %{customdata}<br>Obs MDA8: %{y:.1f}<br>EDM Pred MDA8: %{x:.1f}<extra></extra>"
        };
        applyTraceStyle(tr4, "scatter-smoke-edm", theme);
        traces.push(tr4);
    }

    const allX = traces.flatMap(t => t.x).filter(v => v != null);
    const allY = traces.flatMap(t => t.y).filter(v => v != null);
    if (allX.length > 0 && allY.length > 0) {
        const min = Math.min(Math.min(...allX), Math.min(...allY));
        const max = Math.max(Math.max(...allX), Math.max(...allY));
        traces.push({
            x: [min, max], y: [min, max], mode: "lines", name: "1:1 line",
            line: { color: "red", width: 1.5 }, showlegend: true, hoverinfo: "skip"
        });
    }

    const layout = {
        title: { text: `Obs. vs. Pred.<br>(AQS O3: ${aqs})`, font: { size: theme.fontSize * 0.9, color: theme.axisText }, y: 0.95 },
        paper_bgcolor: theme.paper_bgcolor, plot_bgcolor: theme.plot_bgcolor,
        xaxis: Object.assign({}, getSpikeLayout(theme), {
            title: { text: "Pred MDA8 (ppb)", font: { color: theme.axisText, size: theme.fontSize * 0.8 } },
            tickfont: { color: theme.axisText, size: theme.fontSize * 0.8 },
            gridcolor: theme.grid
        }),
        yaxis: Object.assign({}, getSpikeLayout(theme), {
            title: { text: "Obs MDA8 (ppb)", font: { color: theme.axisText, size: theme.fontSize * 0.8 } },
            tickfont: { color: theme.axisText, size: theme.fontSize * 0.8 },
            gridcolor: theme.grid
        }),
        legend: {
            font: { color: theme.axisText, size: theme.fontSize * 0.8 },
            orientation: "h", x: 0.5, xanchor: "center", y: -0.3, yanchor: "top"
        },
        shapes: [{
            type: "line", xref: "paper", x0: 0, x1: 1, yref: "y", y0: 70, y1: 70,
            line: { color: "orange", width: 1.5, dash: "solid" }
        }],
        annotations: [{
            xref: "paper", x: 1, yref: "y", y: 70, text: "70 ppb", showarrow: false,
            xanchor: "left", font: { color: "orange", size: 10, weight: "bold" }
        }],
        margin: { t: 80, b: 80, l: 60, r: 40 }
    };

    Plotly.react(container, traces, layout, getPlotlyConfig(`scatter_${aqs}`));
}

function renderMonthlySmokePlot(theme, dsId, aqs, tableData) {
    const container = document.getElementById("DatadbPlot3");
    if (!container) return;
    resetPlotContainer(container);

    const monthlyData = {};
    tableData.forEach(d => {
        const month = d.date.substring(0, 7); // YYYY-MM
        if (!monthlyData[month]) {
            monthlyData[month] = { count: 0, smo_sum: 0, smo_count: 0, count_m0: 0, count_m1: 0 };
        }
        if (dsId === "pm-cbsa") {
            if (Number(d.smoke_m0p5m) === 1) monthlyData[month].count_m0++;
            if (Number(d.smoke_m1p0m) === 1) monthlyData[month].count_m1++;
        } else {
            let isSmoke = Number(d.smoke) === 1;
            if (isSmoke) {
                monthlyData[month].count++;
                if (d.SMO != null) { monthlyData[month].smo_sum += d.SMO; monthlyData[month].smo_count++; }
            }
        }
    });

    const months = Object.keys(monthlyData).sort();
    const avgSmo = months.map(m => monthlyData[m].smo_count > 0 ? monthlyData[m].smo_sum / monthlyData[m].smo_count : null);

    let traces = [];
    if (dsId === "pm-cbsa") {
        const tr1 = {
            x: months, y: months.map(m => monthlyData[m].count_m0), type: "bar",
            name: "No. of smoke days (m0p5m)",
            hovertemplate: "No. of smoke days (m0p5m): %{y}<extra></extra>"
        };
        applyTraceStyle(tr1, "scatter-smoke-marker-pm25-m0p5m", theme);
        const tr2 = {
            x: months, y: months.map(m => monthlyData[m].count_m1), type: "bar",
            name: "No. of smoke days (m1p0m)",
            hovertemplate: "No. of smoke days (m1p0m): %{y}<extra></extra>"
        };
        applyTraceStyle(tr2, "scatter-smoke-marker-pm25-m1p0m", theme);
        traces = [tr1, tr2];
    } else {
        const tr1 = {
            x: months, y: months.map(m => monthlyData[m].count), type: "bar",
            name: "No. of smoke days",
            hovertemplate: "No. of smoke days: %{y}<extra></extra>"
        };
        applyTraceStyle(tr1, "monthly-bar", theme);
        traces = [tr1];

        const tr2 = {
            x: months, y: avgSmo, type: "scatter", mode: "lines+markers",
            name: "SMO (ppb)", yaxis: "y",
            connectgaps: false,
            hovertemplate: "SMO (ppb): %{y:.1f}<extra></extra>"
        };
        applyTraceStyle(tr2, "smo", theme);
        traces.push(tr2);

        if (dsId === "gam-v2") {
            const edmSmoSum = {};
            const edmSmoCount = {};
            tableData.forEach(d => {
                const month = d.date.substring(0, 7);
                if (Number(d.smoke) === 1 && d.edm_SMO != null) {
                    edmSmoSum[month] = (edmSmoSum[month] || 0) + d.edm_SMO;
                    edmSmoCount[month] = (edmSmoCount[month] || 0) + 1;
                }
            });
            const avgEdmSmo = months.map(m => edmSmoCount[m] > 0 ? edmSmoSum[m] / edmSmoCount[m] : null);
            const trEdm = {
                x: months, y: avgEdmSmo, type: "scatter", mode: "lines+markers",
                name: "SMO (EDM) (ppb)", yaxis: "y",
                connectgaps: false,
                hovertemplate: "SMO (EDM) (ppb): %{y:.1f}<extra></extra>"
            };
            applyTraceStyle(trEdm, "smo-edm", theme);
            traces.push(trEdm);
        }
    }

    const plotTitle = dsId === "pm-cbsa"
        ? `Monthly smoke day count<br>(AQS PM: ${aqs})`
        : `Monthly smoke day count and SMO<br>(AQS O3: ${aqs})`;

    const layout = {
        title: { text: plotTitle, font: { size: theme.fontSize * 0.9, color: theme.axisText }, y: 0.95 },
        barmode: (dsId === "pm-cbsa") ? "group" : "stack",
        hovermode: "x unified",
        paper_bgcolor: theme.paper_bgcolor, plot_bgcolor: theme.plot_bgcolor,
        xaxis: Object.assign({}, getSpikeLayout(theme), {
            title: { text: "Year-Month", font: { color: theme.axisText, size: theme.fontSize * 0.8 } },
            tickfont: { color: theme.axisText, size: theme.fontSize * 0.75 },
            gridcolor: theme.grid,
            type: "category",
            tickangle: -90, // Rotate labels to prevent overlap
            automargin: true // Automatically adjust margin for labels
        }),
        yaxis: Object.assign({}, getSpikeLayout(theme), {
            title: { text: "Count and ppb", font: { color: theme.axisText, size: theme.fontSize * 0.8 } },
            tickfont: { color: theme.axisText, size: theme.fontSize * 0.8 },
            gridcolor: theme.grid
        }),
        legend: {
            font: { color: theme.axisText, size: theme.fontSize * 0.8 },
            orientation: "h", x: 0.5, xanchor: "center", y: -0.4, yanchor: "top"
        },
        margin: { t: 80, b: 100, l: 60, r: 40 } // Increased bottom margin
    };

    Plotly.react(container, traces, layout, getPlotlyConfig(`monthly_${aqs}`));
}

function renderAnnualExceedancePlot(theme, dsId, aqs, tableData) {
    const container = document.getElementById("DatadbPlot4");
    if (!container) return;
    resetPlotContainer(container);

    const yearlyData = {};
    const threshold = dsId === "pm-cbsa" ? 9 : 70;

    tableData.forEach(d => {
        const year = d.date.substring(0, 4);
        if (!yearlyData[year]) {
            yearlyData[year] = {
                not_smoke_m0: 0, smoke_m0: 0,
                not_smoke_m1: 0, smoke_m1: 0
            };
        }
        const val = dsId === "pm-cbsa" ? d["PM2.5"] : d["MDA8O3"];
        if (val > threshold && val != null) {
            if (dsId === "pm-cbsa") {
                if (Number(d.smoke_m0p5m) === 1) yearlyData[year].smoke_m0++; else yearlyData[year].not_smoke_m0++;
                if (Number(d.smoke_m1p0m) === 1) yearlyData[year].smoke_m1++; else yearlyData[year].not_smoke_m1++;
            } else if (dsId === "gam-v1") {
                let isSmoke = (Number(d.smoke) === 1 && d.MDA8O3_resids > d.p975);
                if (isSmoke) yearlyData[year].smoke_m0++; else yearlyData[year].not_smoke_m0++;
            } else if (dsId === "gam-v2") {
                let isSmokeStd = (Number(d.smoke) === 1 && d.MDA8O3_resids > d.p975);
                if (isSmokeStd) yearlyData[year].smoke_m0++; else yearlyData[year].not_smoke_m0++;
                let isSmokeEDM = (Number(d.smoke) === 1 && d.edm_MDA8O3_resids > d.edm_p975);
                if (isSmokeEDM) yearlyData[year].smoke_m1++; else yearlyData[year].not_smoke_m1++;
            } else if (dsId === "epa-ember") {
                let isSmoke = (Number(d.smoke) === 1 && d.SMO > 0);
                if (isSmoke) yearlyData[year].smoke_m0++; else yearlyData[year].not_smoke_m0++;
            }
        }
    });

    const years = Object.keys(yearlyData).sort();
    let traces = [];

    if (dsId === "pm-cbsa") {
        const y1_base = years.map(y => yearlyData[y].not_smoke_m0);
        const y1_smoke = years.map(y => yearlyData[y].smoke_m0);
        const y2_base = years.map(y => yearlyData[y].not_smoke_m1);
        const y2_smoke = years.map(y => yearlyData[y].smoke_m1);

        traces.push({
            x: years, y: y1_base,
            name: "Days with smoke PM2.5=0 (m0p5m)", type: "bar", offsetgroup: "m0",
            marker: { color: "black" },
            customdata: y1_base,
            hovertemplate: "Days with smoke PM2.5=0 (m0p5m): %{customdata}<extra></extra>"
        });
        traces.push({
            x: years, y: y1_smoke,
            name: "Days with smoke PM2.5>0 (m0p5m)", type: "bar", offsetgroup: "m0",
            base: y1_base,
            marker: { color: "red" },
            customdata: y1_smoke,
            hovertemplate: "Days with smoke PM2.5>0 (m0p5m): %{customdata}<extra></extra>"
        });
        traces.push({
            x: years, y: y2_base,
            name: "Days with smoke PM2.5=0 (m1p0m)", type: "bar", offsetgroup: "m1",
            marker: { color: "grey" },
            customdata: y2_base,
            hovertemplate: "Days with smoke PM2.5=0 (m1p0m): %{customdata}<extra></extra>"
        });
        traces.push({
            x: years, y: y2_smoke,
            name: "Days with smoke PM2.5>0 (m1p0m)", type: "bar", offsetgroup: "m1",
            base: y2_base,
            marker: { color: "orange" },
            customdata: y2_smoke,
            hovertemplate: "Days with smoke PM2.5>0 (m1p0m): %{customdata}<extra></extra>"
        });
    } else if (dsId === "gam-v2") {
        const y1_base = years.map(y => yearlyData[y].not_smoke_m0);
        const y1_smoke = years.map(y => yearlyData[y].smoke_m0);
        const y2_base = years.map(y => yearlyData[y].not_smoke_m1);
        const y2_smoke = years.map(y => yearlyData[y].smoke_m1);

        traces.push({
            x: years, y: y1_base,
            name: "ExdDays with minimal SMO", type: "bar", offsetgroup: "std",
            marker: { color: "black" },
            customdata: y1_base,
            hovertemplate: "ExdDays with minimal SMO: %{customdata}<extra></extra>"
        });
        traces.push({
            x: years, y: y1_smoke,
            name: "ExdDays with significant SMO", type: "bar", offsetgroup: "std",
            base: y1_base,
            marker: { color: "red" },
            customdata: y1_smoke,
            hovertemplate: "ExdDays with significant SMO: %{customdata}<extra></extra>"
        });
        traces.push({
            x: years, y: y2_base,
            name: "ExdDays with minimal SMO (EDM)", type: "bar", offsetgroup: "smo",
            marker: { color: "grey" },
            customdata: y2_base,
            hovertemplate: "ExdDays with minimal SMO: %{customdata}<extra></extra>"
        });
        traces.push({
            x: years, y: y2_smoke,
            name: "ExdDays with significant SMO (EDM)", type: "bar", offsetgroup: "smo",
            base: y2_base,
            marker: { color: "orange" },
            customdata: y2_smoke,
            hovertemplate: "ExdDays with significant SMO (EDM): %{customdata}<extra></extra>"
        });
    } else if (dsId === "epa-ember") {
        const y_base = years.map(y => yearlyData[y].not_smoke_m0);
        const y_smoke = years.map(y => yearlyData[y].smoke_m0);
        traces.push({
            x: years, y: y_base,
            name: "ExdDays with SMO=0", type: "bar",
            marker: { color: "black" },
            customdata: y_base,
            hovertemplate: "SMO=0: %{customdata}<extra></extra>"
        });
        traces.push({
            x: years, y: y_smoke,
            name: "ExdDays with SMO>0", type: "bar",
            marker: { color: "red" },
            customdata: y_smoke,
            hovertemplate: "SMO>0: %{customdata}<extra></extra>"
        });
    } else if (dsId === "gam-v1") {
        const y_base = years.map(y => yearlyData[y].not_smoke_m0);
        const y_smoke = years.map(y => yearlyData[y].smoke_m0);
        traces.push({
            x: years, y: y_base,
            name: "ExdDays with minimal SMO", type: "bar",
            marker: { color: "black" },
            customdata: y_base,
            hovertemplate: "ExdDays with minimal SMO: %{customdata}<extra></extra>"
        });
        traces.push({
            x: years, y: y_smoke,
            name: "ExdDays with significant SMO", type: "bar",
            marker: { color: "red" },
            customdata: y_smoke,
            hovertemplate: "ExdDays with significant SMO: %{customdata}<extra></extra>"
        });
    }

    const layout = {
        title: { text: dsId === "pm-cbsa" ? `Annual days with > 9 ug m-3<br>(AQS PM: ${aqs})` : `Annual ExdDays (> 70 ppb)<br>(AQS O3: ${aqs})`, font: { size: theme.fontSize * 0.9, color: theme.axisText }, y: 0.95 },
        barmode: (dsId === "pm-cbsa" || dsId === "gam-v2") ? "group" : "stack",
        hovermode: "x unified",
        paper_bgcolor: theme.paper_bgcolor, plot_bgcolor: theme.plot_bgcolor,
        xaxis: Object.assign({}, getSpikeLayout(theme), {
            title: { text: "Year", font: { color: theme.axisText, size: theme.fontSize * 0.8 } },
            tickfont: { color: theme.axisText, size: theme.fontSize * 0.8 },
            gridcolor: theme.grid,
            type: "category"
        }),
        yaxis: Object.assign({}, getSpikeLayout(theme), {
            title: { text: "No. of days", font: { color: theme.axisText, size: theme.fontSize * 0.8 } },
            tickfont: { color: theme.axisText, size: theme.fontSize * 0.8 },
            gridcolor: theme.grid
        }),
        legend: {
            orientation: "h", x: 0.5, xanchor: "center", y: -0.3, yanchor: "top",
            font: { color: theme.axisText, size: theme.fontSize * 0.8 }
        },
        bargap: 0.2,
        bargroupgap: 0.05,
        margin: { t: 80, b: 120, l: 60, r: 40 }
    };

    Plotly.react(container, traces, layout, getPlotlyConfig(`annual_${aqs}`));
}

