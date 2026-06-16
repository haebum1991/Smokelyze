
import { currentDate } from "./utils.js";
import { regionStats } from "./layers-state.js";
import { LAYER_TEMPLATES, DATASET_SOURCE_MAP } from "./layers-def.js";
import { getSiteStatsForState, loadedGeoJSON } from "./loader.js";
import {
  getPlotTheme,
  getDatasetInfo,
  renderPlotMessage,
  renderBackButton,
  getSpikeLayout,
  getPlotlyConfig,
  clearPlotMessage,
  highlightSiteOnMap,
  attachDrillDownListeners,
  attachResizeObserver,
  caStates
} from "./stats-common.js";

let currentDailyDetailStateBarLine = null;

// ============================================
// Optimized Style Map (Shared constants)
// ============================================
function getStyleMap(theme) {
  return {
    "airnow-daily-pm25": { type: "scatter", color: theme.axisText, dash: "solid", marker: { symbol: "square", size: 8, color: theme.paper_bgcolor, line: { width: 2, color: theme.axisText } } },
    "airnow-daily-mda8": { type: "scatter", color: "green", dash: "solid", marker: { symbol: "circle", size: 8, color: "white", line: { width: 2, color: "green" } } },
    
    "airnow-hourly-pm25": { type: "scatter", color: theme.axisText, dash: "dot", marker: { symbol: "square", size: 8, color: theme.paper_bgcolor, line: { width: 2, color: theme.axisText } } },
    "airnow-hourly-ozone": { type: "scatter", color: "green", dash: "dot", marker: { symbol: "circle", size: 8, color: "white", line: { width: 2, color: "green" } } },
    "airnow-hourly-no2": { type: "scatter", color: "cyan", dash: "dot", marker: { symbol: "circle", size: 8, color: "white", line: { width: 2, color: "green" } } },

    "mda8-obs": { type: "scatter", color: "green", dash: "solid", marker: { symbol: "circle", size: 8, color: "white", line: { width: 2, color: "green" } } },
  
    "mda8-pred": { type: "scatter", color: "magenta", dash: "solid", marker: { symbol: "circle", size: 8, color: "white", line: { width: 2, color: "magenta" } } },
    "smo": { type: "scatter", color: "#4169E1", dash: "solid", marker: { symbol: "circle", size: 8, color: "white", line: { width: 2, color: "#4169E1" } } },
    "resids": { type: "scatter", color: "cyan", dash: "solid", marker: { symbol: "circle", size: 8, color: "white", line: { width: 2, color: "cyan" } } },
    "resids-quant": { type: "bar", color: "cyan" },
  
    "mda8-pred-edm": { type: "scatter", color: "magenta", dash: "dot", marker: { symbol: "square", size: 8, color: "magenta", line: { width: 2, color: "magenta" } } },
    "smo-edm": { type: "scatter", color: "#4169E1", dash: "dot", marker: { symbol: "square", size: 8, color: "#4169E1", line: { width: 2, color: "#4169E1" } } },
    "resids-edm": { type: "scatter", color: "cyan", dash: "dot", marker: { symbol: "square", size: 8, color: "cyan", line: { width: 2, color: "cyan" } } },
    "resids-quant-edm": { type: "bar", color: "skyblue" },
  
    "pm25-obs": { type: "scatter", color: theme.axisText, dash: "solid", marker: { symbol: "square", size: 8, color: theme.paper_bgcolor, line: { width: 2, color: theme.axisText } } },
    "pm25-quant": { type: "bar", color: theme.paper_bgcolor, marker: { line: { color: theme.axisText, width: 2 } } },
    "pm25-crit": { type: "bar", color: "#FFC300" },
  
    "pm25-crit-m0p5m": { type: "bar", color: "#FFC300" },
    "pm25-crit-m1p0m": { type: "bar", color: "darkred" },
    "pm25-smoke-m0p5m": { type: "bar", color: "#4169E1", marker: { line: { color: theme.axisText, width: 2 } } },
    "pm25-smoke-m1p0m": { type: "bar", color: "cyan", marker: { line: { color: theme.axisText, width: 2 } } },
  
    "tmax": { type: "scatter", color: "red", dash: "solid", marker: { symbol: "circle", size: 8, color: "white", line: { width: 2, color: "red" } } },
    "srad": { type: "scatter", color: "orange", dash: "solid", marker: { symbol: "circle", size: 8, color: "white", line: { width: 2, color: "orange" } } },
  
    "smokeday": { type: "bar", color: "red" },
    "smokeday-975": { type: "bar", color: "green" },
    "smokeday-975-edm": { type: "bar", color: "blue" },
    "smokeday-m0p5m": { type: "bar", color: "red" },
    "smokeday-m1p0m": { type: "bar", color: "green" },
  
    "ExcDays": { type: "bar", splitColors: ["green", "red"], marker: { line: { color: theme.axisText, width: 2 } } },
    "ExcDays-edm": { type: "bar", splitColors: ["darkgreen", "darkred"], marker: { line: { color: theme.plot_bordercol, width: 2 } } },
    "ExcDays-m0p5m": { type: "bar", splitColors: ["green", "red"], marker: { line: { color: theme.axisText, width: 2 } } },
    "ExcDays-m1p0m": { type: "bar", splitColors: ["darkgreen", "darkred"], marker: { line: { color: theme.plot_bordercol, width: 2 } } },
  
    "smokeLight": { type: "bar", color: "#ddd", marker: { line: { color: theme.axisText, width: 2 } } },
    "smokeMedium": { type: "bar", color: "#999", marker: { line: { color: theme.axisText, width: 2 } } },
    "smokeHeavy": { type: "bar", color: "#555", marker: { line: { color: theme.axisText, width: 2 } } },
  
    "fireCount": { type: "bar", color: "orange" },
    "fireFrp": { type: "scatter", color: "red", dash: "solid" },
    "burn": { type: "bar", color: "darkred", marker: { line: { color: theme.axisText, width: 2 } } }
  };
}

const GROUPS = [
  {
    id: "y1",
    axisName: "yaxis",
    title: "Conc. (ppb or ug m-3)",
    metrics: [
      "mda8-obs", "mda8-pred", "mda8-pred-edm",
      "airnow-daily-pm25", "airnow-daily-mda8",
      "airnow-hourly-pm25", "airnow-hourly-ozone", "airnow-hourly-no2",
      "pm25-obs", "pm25-crit",
      "pm25-crit-m0p5m", "pm25-crit-m1p0m",
      "pm25-smoke-m0p5m", "pm25-smoke-m1p0m"
    ],
    side: "left"
  },
  {
    id: "y2",
    axisName: "yaxis2",
    title: "SMO / Resids (ppb)",
    metrics: ["smo", "smo-edm", "resids", "resids-edm"],
    side: "right"
  },
  {
    id: "y3",
    axisName: "yaxis3",
    title: "Quantile (%)",
    metrics: ["resids-quant", "resids-quant-edm", "pm25-quant"],
    side: "right"
  },
  {
    id: "y4",
    axisName: "yaxis4",
    title: "TMAX",
    metrics: ["tmax"],
    side: "right"
  },
  {
    id: "y5",
    axisName: "yaxis5",
    title: "SRAD",
    metrics: ["srad"],
    side: "right"
  },
  {
    id: "y6",
    axisName: "yaxis6",
    title: "Count (sites)",
    metrics: ["smokeday", "smokeday-975", "smokeday-975-edm", "smokeday-m0p5m", "smokeday-m1p0m"],
    side: "right"
  },
  {
    id: "y7",
    axisName: "yaxis7",
    title: "No. of days",
    metrics: ["ExcDays", "ExcDays-edm", "ExcDays-m0p5m", "ExcDays-m1p0m"],
    side: "right"
  },
  {
    id: "y8",
    axisName: "yaxis8",
    title: "Smoke area (km²)",
    metrics: ["smokeLight", "smokeMedium", "smokeHeavy"],
    side: "right"
  },
  {
    id: "y9",
    axisName: "yaxis9",
    title: "Fire Points",
    metrics: ["fireCount"],
    side: "right"
  },
  {
    id: "y10",
    axisName: "yaxis10",
    title: "FRP (MW)",
    metrics: ["fireFrp"],
    side: "right"
  },
  {
    id: "y11",
    axisName: "yaxis11",
    title: "Area burned (km²)",
    metrics: ["burn"],
    side: "right"
  }
];

export function renderDailyBarLine(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const isDetailMode = !!currentDailyDetailStateBarLine;
  let dataStats = {};

  if (isDetailMode) {
    if (getSiteStatsForState) {
      dataStats = getSiteStatsForState(currentDailyDetailStateBarLine);
    }
  } else {
    dataStats = regionStats || {};
  }

  const theme = getPlotTheme();
  const fontSize = parseInt(theme.fontSize, 10);

  const activeCheckboxes = [];
  const { value: currentDataset } = getDatasetInfo();
  const templates = LAYER_TEMPLATES || [];

  // Optimized Style Map
  const STYLE_MAP = getStyleMap(theme);

  templates.forEach(tmpl => {
    const cb = document.getElementById(`layer-${tmpl.id}`);
    if (!cb?.checked) return;

    const lbl = cb.closest("label");
    if (!lbl || lbl.style.display === "none") return;

    let lookupKey = tmpl.id;

    if (tmpl.manualLayer) {
      lookupKey = (typeof tmpl.field === "function") ? tmpl.field(currentDataset) : tmpl.field;
    }

    const group = GROUPS.find(g => g.metrics.includes(lookupKey));

    if (group) {
      const exists = activeCheckboxes.find(t => t.key === lookupKey);
      if (!exists) {
        activeCheckboxes.push({
          key: lookupKey,
          group,
          title: (typeof tmpl.title === "function") ? tmpl.title(currentDataset) : tmpl.title,
          decimals: tmpl.decimals ?? 1
        });
      }
    }
  });

  if (activeCheckboxes.length === 0) {
    currentDailyDetailStateBarLine = null;
    renderPlotMessage(container, theme.messages.barline);
    renderBackButton(container, "stats-back-btn-barline", null);
    return;
  }

  const caStatesList = caStates || [];

  let dataStatsX = [];
  if (isDetailMode) {
    dataStatsX = Object.keys(dataStats).sort();
  } else {
    dataStatsX = Object.keys(dataStats).sort().filter(k =>
      k !== "US" && k !== "US_conus" && k !== "Canada" && k !== "Mexico" && !caStatesList.includes(k) && dataStats[k]
    );
  }

  if (dataStatsX.length === 0) {
    renderPlotMessage(container, theme.messages.barline);
    renderBackButton(container, "stats-back-btn-barline", isDetailMode ? () => {
      currentDailyDetailStateBarLine = null;
      renderDailyBarLine(containerId);
    } : null);
    return;
  }

  const uniqueGroupIds = [...new Set(activeCheckboxes.map(t => t.group.id))];

  let primaryGroupId = "y1";

  if (uniqueGroupIds.includes("y1")) {
    primaryGroupId = "y1";
  } else {
    const barGroupIds = uniqueGroupIds.filter(gid =>
      activeCheckboxes.some(t => t.group.id === gid && STYLE_MAP[t.key]?.type === "bar")
    ).sort((a, b) => parseInt(a.replace("y", "")) - parseInt(b.replace("y", "")));

    if (barGroupIds.length > 0) {
      primaryGroupId = barGroupIds[0];
    } else if (uniqueGroupIds.length > 0) {
      uniqueGroupIds.sort((a, b) => parseInt(a.replace("y", "")) - parseInt(b.replace("y", "")));
      primaryGroupId = uniqueGroupIds[0];
    }
  }

  const traces = [];
  const usedGroups = {};

  activeCheckboxes.forEach(item => {
    const { key, group, title, decimals } = item;
    usedGroups[group.id] = group;

    const style = STYLE_MAP[key] || { type: "scatter", color: "black" };
    const textData = [];

    const dataStatsY = dataStatsX.map(xKey => {
      const val = dataStats[xKey][key];
      let parsedVal = val;
      let displayStr = val;

      if (typeof val === "string" && val.includes("/")) {
        parsedVal = parseFloat(val.split("/")[0]);
        displayStr = val;
      } else if (typeof val === "number") {
        displayStr = val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
      }

      textData.push(displayStr);
      return parsedVal;
    });

    let axisId = group.id === primaryGroupId ? "y" : group.id;

    const trace = {
      x: dataStatsX,
      y: dataStatsY,
      name: title,
      yaxis: axisId,
      type: style.type,
      marker: {},
      line: {},
      text: textData,
      showlegend: true
    };

    const isRatio = (typeof dataStats[dataStatsX[0]]?.[key] === "string" && dataStats[dataStatsX[0]][key].includes("/"));
    if (isRatio) {
      trace.hovertemplate = "<b>%{text}</b>";
    } else {
      trace.hovertemplate = `<b style='font-weight: bold; color: var(--card-shadow);'>%{y:,.${decimals}f}</b><extra>${title}</extra>`;
    }

    if (style.type === "bar") {
      trace.marker.color = style.color;
      trace.opacity = 0.5;
      trace.offsetgroup = key;
    } else {
      trace.mode = "lines+markers";
      trace.line.color = style.color;
      trace.line.dash = style.dash || "solid";
      trace.marker.size = style.marker?.size ?? 6;
    }

    if (style.marker) {
      Object.assign(trace.marker, style.marker);
    }

    // [Dynamic Color Logic for Exceedance Layers]
    if (["ExcDays", "ExcDays-edm", "ExcDays-m0p5m", "ExcDays-m1p0m"].includes(key)) {
      let valNotBySmoke = [];
      let valBySmoke = [];

      if (!isDetailMode) {
        const { value: dsVal, key: dsKey } = getDatasetInfo();
        const rawData = loadedGeoJSON?.[dsKey];
        const countsByState = {};
        dataStatsX.forEach(st => { countsByState[st] = { c1: 0, c2: 0 }; });

        if (rawData?.features) {
          const tmpl = templates.find(t => t.id === key);
          const propName = tmpl?.field;

          if (propName) {
            rawData.features.forEach(fi => {
              const st = fi.properties.state;
              const v = fi.properties[propName];
              if (countsByState[st] && v !== undefined && v !== null) {
                if (v === 1) countsByState[st].c1++;
                else if (v === 2) countsByState[st].c2++;
              }
            });
          }
        }
        valNotBySmoke = dataStatsX.map(st => countsByState[st]?.c1 ?? 0);
        valBySmoke = dataStatsX.map(st => countsByState[st]?.c2 ?? 0);
      } else {
        valNotBySmoke = dataStatsY.map(v => (v === 1 ? 1 : 0));
        valBySmoke = dataStatsY.map(v => (v === 2 ? 1 : 0));
      }

      let l_title_1 = "ExcDays with minimal SMO";
      let l_title_2 = "ExcDays with significant SMO";

      if (key === "ExcDays-edm") {
        l_title_1 = "ExcDays with minimal SMO (EDM)";
        l_title_2 = "ExcDays with significant SMO (EDM)";
      } else if (key === "ExcDays-m0p5m") {
        l_title_1 = "ExcDays with smoke PM2.5=0 (m0p5m)";
        l_title_2 = "ExcDays with smoke PM2.5>0 (m0p5m)";
      } else if (key === "ExcDays-m1p0m") {
        l_title_1 = "ExcDays with smoke PM2.5=0 (m1p0m)";
        l_title_2 = "ExcDays with smoke PM2.5>0 (m1p0m)";
      }

      trace.y = valNotBySmoke;
      trace.text = valNotBySmoke.map(String);
      trace.name = l_title_1;
      trace.marker.color = style.splitColors[0];
      trace.hovertemplate = `<b>${l_title_1}: %{text}</b><extra></extra>`;
      trace.offsetgroup = key;

      const trace2 = JSON.parse(JSON.stringify(trace));
      trace2.y = valBySmoke;
      trace2.text = valBySmoke.map(String);
      trace2.name = l_title_2;
      trace2.marker.color = style.splitColors[1];
      trace2.hovertemplate = `<b>${l_title_2}: %{text}</b><extra></extra>`;
      trace2.base = valNotBySmoke;

      traces.push(trace, trace2);
      return;
    }

    traces.push(trace);
  });

  const layout = {
    paper_bgcolor: theme.paper_bgcolor,
    plot_bgcolor: theme.plot_bgcolor,
    hovermode: "x unified",
    xaxis: {
      ...getSpikeLayout(theme),
      tickangle: -90,
      tickfont: { size: fontSize * 0.8, color: theme.axisText },
      automargin: true,
      title: { text: isDetailMode ? `AQS site (${currentDailyDetailStateBarLine})` : "State", font: { size: fontSize, color: theme.axisText }, standoff: 20 },
      gridcolor: theme.grid,
      linecolor: theme.axisText,
      mirror: true,
      type: "category"
    },
    margin: { t: 70, r: 50, b: 100, l: 50 },
    legend: {
      orientation: "h",
      yanchor: "bottom",
      y: 1.05,
      xanchor: "left",
      x: 0,
      font: { color: theme.axisText }
    },
    barmode: "group"
  };

  const baseAxis = {
    ...getSpikeLayout(theme),
    tickfont: { size: fontSize * 0.8, color: theme.axisText },
    automargin: true,
    showgrid: false,
    zeroline: true,
    linecolor: theme.axisText,
    mirror: true,
    gridcolor: theme.grid
  };

  const resolveAxisTitle = (group) => {
    if (group.id !== "y4" && group.id !== "y5") {
      return group.title;
    }
    const trace = activeCheckboxes.find(t => t.group.id === group.id);
    return trace ? trace.title : group.title;
  };

  let leftTitle = usedGroups[primaryGroupId] ? resolveAxisTitle(usedGroups[primaryGroupId]) : "";

  layout.yaxis = {
    ...baseAxis,
    title: { text: leftTitle, font: { color: theme.axisText } },
    side: "left",
    showgrid: true
  };

  const activeRightGroups = Object.values(usedGroups)
    .filter(g => g.id !== primaryGroupId && g.side === "right")
    .sort((a, b) => parseInt(a.id.replace("y", "")) - parseInt(b.id.replace("y", "")));

  if (activeRightGroups.length > 0) {
    const step = 0.08;
    const spaceNeeded = Math.min(0.4, Math.max(0, activeRightGroups.length - 1) * step);

    layout.xaxis.domain = [0, 1.0 - spaceNeeded];

    activeRightGroups.forEach((g, idx) => {
      const axisKey = g.axisName;
      const axisDef = {
        ...baseAxis,
        title: { text: resolveAxisTitle(g), font: { color: theme.axisText } },
        overlaying: "y",
        side: "right",
        tickmode: "sync",
        tickformat: ".0f"
      };

      if (idx === 0) {
        axisDef.anchor = "x";
      } else {
        axisDef.anchor = "free";
        axisDef.position = 1.0 - spaceNeeded + (idx * step);
      }
      layout[axisKey] = axisDef;
    });
  }

  if (container._barlineObserver) {
    container._barlineObserver.disconnect();
    delete container._barlineObserver;
  }

  const attachStateSiteListeners = () => {
    let callback;

    if (!isDetailMode) {
      // Drill-down to State
      callback = (stateName) => {
        currentDailyDetailStateBarLine = stateName;
        renderDailyBarLine(containerId);
      };
    } else {
      // Highlight Site on Map
      callback = (siteId) => {
        const s = dataStats?.[siteId];
        if (s?._coords && s?._properties) {
          highlightSiteOnMap(s._coords, s._properties, getDatasetInfo().key);
        }
      };
    }

    attachDrillDownListeners(container, ".xtick text", callback);
  };

  const filename = `barline_${isDetailMode ? currentDailyDetailStateBarLine : "allstate"}_${currentDate()}`;
  const config = getPlotlyConfig(filename);

  clearPlotMessage(container);
  Plotly.react(container, traces, layout, config).then(() => {
    attachStateSiteListeners();
    container.removeAllListeners("plotly_afterplot");
    container.on("plotly_afterplot", attachStateSiteListeners);
    attachResizeObserver(container, "_barlineObserver");

    renderBackButton(container, "stats-back-btn-barline", isDetailMode ? () => {
      currentDailyDetailStateBarLine = null;
      renderDailyBarLine(containerId);
    } : null);
  });
}

// Export reset for ui-reset.js
export function resetState() {
  currentDailyDetailStateBarLine = null;
}

