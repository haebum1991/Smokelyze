
import { currentDate } from "./utils.js";
import {
    getPlotTheme,
    getPlotlyConfig,
    getMetricInfo,
    getSpikeLayout,
    clearPlotMessage,
    attachResizeObserver,
    selectedRegionsByMetric,
    setOnRenderLinePlot,
    setOnCurrentPlotHide
} from "./stats-common.js";
import { yearStatsCache } from "./stats-yearly.js";

export function currentPlotHide(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";
}

export function renderLinePlot(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";

    const byMetric = selectedRegionsByMetric;
    const metrics = Object.keys(byMetric).filter(m => Array.isArray(byMetric[m]) && byMetric[m].length);

    if (!metrics.length) {
        container.innerHTML = "<p style='text-align: center';>[Lineplot panel] Select cells where you want the results to appear.</p>";
        return;
    }

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
            if (!Array.isArray(burnYear)) return 0;
            row = burnYear.find(d => Number(d.month) === month);
            if (row && Object.prototype.hasOwnProperty.call(row, regionId)) {
                return Number(row[regionId]) || 0;
            }
            return 0;
        }

        if (["smokeLight", "smokeMedium", "smokeHeavy"].includes(metric)) {
            if (!Array.isArray(smokeYear)) return 0;
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
                return Number(row[regionId]) || 0;
            }
            return 0;
        }

        if (["fireCount", "fireFrp"].includes(metric)) {
            if (!Array.isArray(fireYear)) return 0;
            const catFire = (metric === "fireCount") ? "n_fires" : "frp";

            row = fireYear.find(d =>
                Number(d.month) === month &&
                String(d.category || "").toLowerCase() === catFire
            );
            if (row && Object.prototype.hasOwnProperty.call(row, regionId)) {
                return Number(row[regionId]) || 0;
            }
            return 0;
        }

        return 0;
    };

    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const theme = getPlotTheme();
    const fontSize = parseInt(theme.fontSize, 10);
    const filename = `line_${currentDate()}`;
    const config = getPlotlyConfig(filename);

    container.innerHTML = "";

    metrics.forEach((metric, idx) => {
        // Validate data availability
        if (metric === "burn" && !Array.isArray(burnYear)) return;
        if (["smokeLight", "smokeMedium", "smokeHeavy"].includes(metric) && !Array.isArray(smokeYear)) return;
        if (["fireCount", "fireFrp"].includes(metric) && !Array.isArray(fireYear)) return;

        const info = getMetricInfo(metric);
        const selected = byMetric[metric];

        const plotDiv = document.createElement("div");
        plotDiv.className = "stats-plot-tab-panel";
        plotDiv.style.marginTop = idx === 0 ? "0" : "2.4rem";
        container.appendChild(plotDiv);

        const unit = info.unit;
        const hoverDecimals = info.decimals ?? 0;
        const hoverTemplate = `<b style='font-weight: bold; color: var(--card-shadow);'>%{y:,.${hoverDecimals}f}</b> ${unit}<extra></extra>`;

        const traces = selected.map(regionId => {
            const values = months.map(mm => getMonthlyValue(metric, mm, regionId));
            return {
                x: months,
                y: values,
                name: regionId,
                mode: "lines+markers",
                hovertemplate: hoverTemplate
            };
        });

        const layout = {
            paper_bgcolor: theme.paper_bgcolor,
            plot_bgcolor: theme.plot_bgcolor,
            title: {
                text: info.unit ? `${year} ${info.title} (${info.unit})` : `${year} ${info.title}`,
                font: { color: theme.axisText, size: fontSize }
            },
            hovermode: "x unified",
            hoverlabel: { font: { color: theme.axisText } },
            xaxis: {
                ...getSpikeLayout(theme),
                title: { text: "Month", font: { size: fontSize, color: theme.axisText }, standoff: 20 },
                dtick: 1,
                tickfont: { size: fontSize * 0.8, color: theme.axisText },
                gridcolor: theme.grid,
                zerolinecolor: theme.grid,
                showline: true,
                automargin: true,
                linecolor: theme.axisText,
                linewidth: 1,
                mirror: "allticks"
            },
            yaxis: {
                ...getSpikeLayout(theme),
                title: { text: info.unit ? `${info.title} (${info.unit})` : info.title, font: { size: fontSize, color: theme.axisText }, standoff: 20 },
                tickfont: { size: fontSize * 0.8, color: theme.axisText },
                gridcolor: theme.grid,
                zerolinecolor: theme.grid,
                showline: true,
                automargin: true,
                linecolor: theme.axisText,
                linewidth: 1,
                mirror: "allticks"
            },
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
        Plotly.react(plotDiv, traces, layout, config).then(() => {
            attachResizeObserver(plotDiv, "_lineObserver");
            window.requestAnimationFrame(() => {
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

