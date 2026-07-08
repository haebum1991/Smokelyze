
import { currentDate } from "./utils.js";
import {
    usStates,
    getPlotTheme,
    getPlotlyConfig,
    getStandardMetrics,
    isMetricVisible,
    getMetricInfo,
    renderPlotMessage,
    clearPlotMessage,
    attachResizeObserver
} from "./stats-common.js";
import { yearStatsCache } from "./stats-yearly.js";

export function renderHeatmap(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";

    const yearEl = document.getElementById("StatsInputYear");
    const year = yearEl?.dataset.yearValue
        ? yearEl.dataset.yearValue
        : (currentDate ? currentDate().slice(0, 4) : String(new Date().getFullYear()));

    const cache = yearStatsCache || { burn: {}, smoke: {}, fire: {} };
    const burnYear = cache.burn[year];
    const smokeYear = cache.smoke[year];
    const fireYear = cache.fire[year];

    const getMonthlyValue = (metric, month, regionId) => {
        let row;

        if (metric === "burn") {
            if (!Array.isArray(burnYear)) return null;
            row = burnYear.find(d => Number(d.month) === month);
            if (row && Object.prototype.hasOwnProperty.call(row, regionId)) {
                return Number(row[regionId]) || null;
            }
            return null;
        }

        if (["smokeLight", "smokeMedium", "smokeHeavy"].includes(metric)) {
            if (!Array.isArray(smokeYear)) return null;
            const catMap = {
                smokeLight: "light",
                smokeMedium: "medium",
                smokeHeavy: "heavy"
            };
            const cat = catMap[metric];

            row = smokeYear.find(d =>
                Number(d.month) === month &&
                String(d.category || "").toLowerCase() === cat
            );
            if (row && Object.prototype.hasOwnProperty.call(row, regionId)) {
                return Number(row[regionId]) || null;
            }
            return null;
        }

        if (["fireCount", "fireFrp"].includes(metric)) {
            if (!Array.isArray(fireYear)) return null;
            const catFire = (metric === "fireCount") ? "n_fires" : "frp";

            row = fireYear.find(d =>
                Number(d.month) === month &&
                String(d.category || "").toLowerCase() === catFire
            );
            if (row && Object.prototype.hasOwnProperty.call(row, regionId)) {
                return Number(row[regionId]) || null;
            }
            return null;
        }

        return null;
    };

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const theme = getPlotTheme();
    const fontSize = parseInt(theme.fontSize, 10);
    let renderedCount = 0;
    const visibleMetrics = getStandardMetrics().filter(m => isMetricVisible(m));

    if (visibleMetrics.length === 0) {
        renderPlotMessage(container, theme.messages.heatmap);
        return;
    }

    visibleMetrics.forEach(metric => {
        const info = getMetricInfo(metric);

        if (metric === "burn" && !Array.isArray(burnYear)) return;
        if (metric.includes("smoke") && !Array.isArray(smokeYear)) return;
        if ((metric.includes("fire") || metric.includes("Frp")) && !Array.isArray(fireYear)) return;

        let hasAnyData = false;
        const zValues = months.map((_, mIndex) => {
            const monthNum = mIndex + 1;
            return usStates.map(state => {
                const val = getMonthlyValue(metric, monthNum, state);
                if (val !== null && val !== undefined && val !== 0) {
                    hasAnyData = true;
                }
                return val;
            });
        });

        if (!hasAnyData) return;

        renderedCount++;
        const plotDiv = document.createElement("div");
        plotDiv.className = "stats-plot-tab-panel";
        plotDiv.style.marginTop = renderedCount === 1 ? "0" : "2.4rem";
        container.appendChild(plotDiv);

        const unit = info.unit;
        const hoverDecimals = info.decimals ?? 0;
        const hoverTemplate = `<b style='font-size: 1.6rem; color: var(--card-shadow);'>%{z:,.${hoverDecimals}f}</b> <span style='font-size: 1.6rem; color: var(--text-strong);'> ${unit}</span><br><b style='color: var(--text-strong);'>%{x}</b><extra></extra>`;

        const traces = [{
            z: zValues,
            x: usStates,
            y: months,
            type: "heatmap",
            colorscale: "Jet",
            hovertemplate: hoverTemplate,
            hoverlabel: { bgcolor: theme.plot_bgcolor },
            colorbar: {
                title: info.unit ? `${info.title} (${info.unit})` : info.title,
                titleside: "bottom",
                titlefont: { size: fontSize, color: theme.axisText },
                tickfont: { size: fontSize * 0.8, color: theme.axisText },
                orientation: "h",
                x: 0.5,
                y: -0.3,
                xanchor: "center",
                thickness: 10
            },
            xgap: 1,
            ygap: 1
        }];

        const layout = {
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
                    text: info.unit ? `${year} ${info.title} (${info.unit})` : `${year} ${info.title}`,
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
        const currentFilename = `heatmap_${metric}_${currentDate()}`;
        const currentConfig = getPlotlyConfig(currentFilename);

        Plotly.react(plotDiv, traces, layout, currentConfig).then(() => {
            attachResizeObserver(plotDiv, "_heatmapObserver");
            window.requestAnimationFrame(() => {
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

