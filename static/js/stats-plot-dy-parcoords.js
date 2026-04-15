
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
    getCleanLabel,
    resetPlotContainer
} from "./stats-common.js";

export let plotAxesStack = [];
let currentDailyDetailStateParcoords = null;

// Track checkbox changes for Parallel Coordinates 
document.addEventListener("change", (e) => {
    if (e.target?.id?.startsWith("layer-")) {
        const layerId = e.target.id.replace("layer-", "");
        if (e.target.checked) {
            if (!plotAxesStack.includes(layerId)) {
                plotAxesStack.push(layerId);
            }
        } else {
            plotAxesStack = plotAxesStack.filter(id => id !== layerId);
        }
    }
});

export function renderParCoords(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (container._clickLabelTimer) {
        clearTimeout(container._clickLabelTimer);
        delete container._clickLabelTimer;
    }

    resetPlotContainer(container, "_parcoordsObserver");

    // Determine mode
    const isDetailMode = !!currentDailyDetailStateParcoords;
    const dataStats = [];
    const theme = getPlotTheme();
    const fontSize = parseInt(theme.fontSize, 10);

    if (isDetailMode) {
        // Detail Mode: Get Site Stats
        if (getSiteStatsForState) {
            const siteStats = getSiteStatsForState(currentDailyDetailStateParcoords);
            Object.keys(siteStats).forEach(key => {
                const s = siteStats[key];
                const row = { state: key, ...s };
                dataStats.push(row);
            });
        }
    } else {
        // Overview Mode: Region Stats
        const currentRegionStats = regionStats || {};
        const states = [...(usStates || []), ...(caStates || [])];

        states.forEach(st => {
            const s = currentRegionStats[st];
            if (s) {
                const isRelevant = (key) => {
                    return key !== "id" && !["burn", "smokeLight", "smokeMedium", "smokeHeavy", "fireCount", "fireFrp"].includes(key) && s[key] !== null;
                };
                const hasData = (s.burn > 0) || (s.smokeLight > 0) || (s.fireCount > 0) || (Object.keys(s).some(isRelevant));

                if (hasData) {
                    const row = { state: st, ...s };
                    dataStats.push(row);
                }
            }
        });
    }

    if (dataStats.length === 0) {
        renderPlotMessage(container, theme.messages.parcoords);
        renderBackButton(container, "stats-back-btn-parcoords", isDetailMode ? () => {
            currentDailyDetailStateParcoords = null;
            renderParCoords(containerId);
        } : null);
        return;
    }

    const activeCheckboxes = Array.from(document.querySelectorAll("input[type=checkbox][id^='layer-']:checked"))
        .filter(cb => {
            const lbl = cb.closest("label");
            return lbl && lbl.style.display !== "none";
        })
        .map(cb => cb.id.replace("layer-", ""));

    plotAxesStack = plotAxesStack.filter(id => activeCheckboxes.includes(id));

    activeCheckboxes.forEach(id => {
        if (!plotAxesStack.includes(id)) {
            plotAxesStack.push(id);
        }
    });

    if (activeCheckboxes.length === 0) {
        currentDailyDetailStateParcoords = null;
        renderPlotMessage(container, theme.messages.parcoords);
        renderBackButton(container, "stats-back-btn-parcoords", null);
        return;
    }

    const dimensions = [];
    const stateNames = dataStats.map(d => d.state);
    const stateIndices = dataStats.map((_, i) => i);

    // Always "Region" first
    dimensions.push({
        label: isDetailMode ? `AQS site (${currentDailyDetailStateParcoords})` : "Region",
        values: stateIndices,
        tickvals: stateIndices,
        ticktext: stateNames,
        type: "category"
    });

    // Helper to add dimension
    const addDim = (label, values, decimals) => {
        const dim = { label, values };
        if (typeof decimals === "number") {
            dim.tickformat = `.${decimals}f`;
        }
        dimensions.push(dim);
    };

    // Helper to get checkbox label
    const getLabel = (id) => {
        const el = document.getElementById(`layer-${id}`);
        return (el?.parentElement) ? el.parentElement.textContent.trim() : null;
    };

    const { value: currentDataset } = getDatasetInfo();
    const templates = LAYER_TEMPLATES || [];

    // Iterate stack to add dimensions in order
    plotAxesStack.forEach(layerId => {
        const cb = document.getElementById(`layer-${layerId}`);
        if (!cb) return;
        const lbl = cb.closest("label") || cb.parentElement;
        if (!lbl || lbl.style.display === "none") return;

        const userLabel = getCleanLabel(lbl) || getLabel(layerId);

        // Find all matching templates (to handle split layers like smoke/fire)
        const matches = templates.filter(t => t.id === layerId);
        if (matches.length === 0) return;

        matches.forEach(tmpl => {
            // 1. Resolve Data Key
            const key = tmpl.manualLayer
                ? (typeof tmpl.field === "function" ? tmpl.field(currentDataset) : tmpl.field)
                : tmpl.id;

            // 2. Get Data
            const vals = dataStats.map(d => {
                const v = d[key];
                if (v === undefined || v === null || v === "NA") return undefined;

                // Handle ratio strings like "10 / 100" for stats
                if (typeof v === "string" && v.includes("/")) {
                    return parseFloat(v.split("/")[0]);
                }
                return v;
            });

            // 3. Validation
            const isNumeric = vals.some(v => typeof v === "number");
            if (!isNumeric) return;

            // Emulate logic to hide secondary axes if empty (e.g. Smoke Medium/Heavy, FRP)
            if (["smokeMedium", "smokeHeavy", "fireFrp"].includes(key)) {
                const maxVal = Math.max(...vals.map(v => v || 0));
                if (maxVal <= 0) return;
            }

            // 4. Resolve Title
            let title = userLabel;
            if (title) {
                if (tmpl.category === "light") title += " (L)";
                else if (tmpl.category === "medium") title += " (M)";
                else if (tmpl.category === "heavy") title += " (H)";
                else if (key === "fireCount") title += " (Count)";
                else if (key === "fireFrp") title += " (FRP)";
            } else {
                title = (typeof tmpl.title === "function") ? tmpl.title(currentDataset) : tmpl.title;
                title = title.replace(" (ppb)", "").replace(" (ug m-3)", "");
            }

            addDim(title, vals, tmpl.decimals);
        });
    });

    // Setup colors
    const colorVals = stateIndices;
    const colorscale = "Jet";

    const trace = {
        type: "parcoords",
        line: {
            color: colorVals,
            colorscale,
            showscale: false,
            colorbar: null
        },
        dimensions,
        labelfont: { family: "Inter, sans-serif", size: fontSize },
        tickfont: { family: "Inter, sans-serif", size: fontSize * 0.8 },
        rangefont: { family: "Inter, sans-serif", size: fontSize * 0.8 }
    };

    const layout = {
        paper_bgcolor: theme.paper_bgcolor,
        plot_bgcolor: theme.plot_bgcolor,
        font: {
            family: "Inter, sans-serif",
            size: fontSize,
            color: theme.axisText
        },
        height: 600,
        margin: { l: 130, r: 50, b: 50, t: 80 }
    };

    const filename = `parcoords_${isDetailMode ? currentDailyDetailStateParcoords : "allstate"}_${currentDate()}`;
    const config = { ...getPlotlyConfig(filename), displayModeBar: true };

    const attachStateSiteListeners = () => {
        let callback;

        if (!isDetailMode) {
            // Drill-down to State
            callback = (stateName) => {
                if (stateNames.includes(stateName)) {
                    currentDailyDetailStateParcoords = stateName;
                    renderParCoords(containerId);
                }
            };
        } else {
            // Highlight Site on Map
            callback = (siteId) => {
                const s = dataStats.find(r => r.state === siteId);
                if (s?._coords && s?._properties) {
                    highlightSiteOnMap(s._coords, s._properties, getDatasetInfo().key);
                }
            };
        }

        attachDrillDownListeners(container, ".tick text", callback);
    };

    clearPlotMessage(container);
    Plotly.react(container, [trace], layout, config).then(() => {
        attachStateSiteListeners();
        container.removeAllListeners("plotly_afterplot");
        container.on("plotly_afterplot", attachStateSiteListeners);
        attachResizeObserver(container, "_parcoordsObserver");
        renderBackButton(container, "stats-back-btn-parcoords", isDetailMode ? () => {
            currentDailyDetailStateParcoords = null;
            renderParCoords(containerId);
        } : null);
    });
}

// Export reset for ui-reset.js
export function resetState() {
    currentDailyDetailStateParcoords = null;
}

