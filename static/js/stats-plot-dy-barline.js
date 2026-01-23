
import { currentDate } from "./utils.js";
import { regionStats } from "./layers-state.js";
import { LAYER_TEMPLATES } from "./layers-def.js";
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

var currentDailyDetailStateBarLine = null;


// ============================================
// Optimized Style Map (Shared constants)
// ============================================
function getStyleMap(theme) {
  return {
    "airnow-pm25": { type: "scatter", color: theme.axisText, dash: "solid", marker: { symbol: "square", size: 8, color: theme.paper_bgcolor, line: { width: 2, color: theme.axisText } } },
    "airnow-ozone": { type: "scatter", color: "green", dash: "solid", marker: { symbol: "circle", size: 8, color: "white", line: { width: 2, color: "green" } } },
    "airnow-no2": { type: "scatter", color: "cyan", dash: "solid", marker: { symbol: "circle", size: 8, color: "white", line: { width: 2, color: "green" } } },

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

var GROUPS = [
  {
    id: "y1",
    axisName: "yaxis",
    title: "Conc. (ppb or ug m-3)",
    metrics: ["mda8-obs", "mda8-pred", "mda8-pred-edm", 
    "airnow-pm25", "airnow-ozone", "airnow-no2",
    "pm25-obs", "pm25-crit", 
    "pm25-crit-m0p5m", "pm25-crit-m1p0m", 
    "pm25-smoke-m0p5m", "pm25-smoke-m1p0m"],
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
    title: "No. of Exc. days",
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
  var container = document.getElementById(containerId);
  if (!container) return;

  var isDetailMode = !!currentDailyDetailStateBarLine;
  var dataStats = {};

  if (isDetailMode) {
    if (getSiteStatsForState) {
      dataStats = getSiteStatsForState(currentDailyDetailStateBarLine);
    }
  } else {
    dataStats = regionStats || {};
  }

  var theme = getPlotTheme();
  var fontSize = parseInt(theme.fontSize, 10);

  var activeCheckboxes = [];
  var dsInfo = getDatasetInfo();
  var currentDataset = dsInfo.value;
  var templates = LAYER_TEMPLATES ? LAYER_TEMPLATES : [];

  // Optimized Style Map
  const STYLE_MAP = getStyleMap(theme);
  
  templates.forEach(function (tmpl) {
    var cb = document.getElementById("layer-" + tmpl.id);
    if (!cb || !cb.checked) return;

    var lbl = cb.closest("label");
    if (!lbl || lbl.style.display === "none") return;

    var lookupKey = tmpl.id;

    if (tmpl.manualLayer) {
      if (typeof tmpl.field === "function") {
        lookupKey = tmpl.field(currentDataset);
      } else {
        lookupKey = tmpl.field;
      }
    }

    var group = GROUPS.find(function (g) {
      return g.metrics.indexOf(lookupKey) !== -1;
    });

    if (group) {
      var exists = activeCheckboxes.find(function (t) { return t.key === lookupKey; });
      if (!exists) {
        activeCheckboxes.push({
          key: lookupKey,
          group: group,
          title: (typeof tmpl.title === "function") ? tmpl.title(currentDataset) : tmpl.title,
          decimals: (tmpl.decimals !== undefined) ? tmpl.decimals : 1
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

  var caStatesList = caStates || [];

  var dataStatsX = [];
  if (isDetailMode) {
    dataStatsX = Object.keys(dataStats).sort();
  } else {
    dataStatsX = Object.keys(dataStats).sort().filter(function (k) {
      return k !== "US" && k !== "US_conus" && k !== "Canada" && k !== "Mexico" && caStatesList.indexOf(k) === -1 && dataStats[k];
    });
  }

  if (dataStatsX.length === 0) {
    renderPlotMessage(container, theme.messages.barline);
    renderBackButton(container, "stats-back-btn-barline", isDetailMode ? function () {
      currentDailyDetailStateBarLine = null;
      renderDailyBarLine(containerId);
    } : null);
    return;
  }

  var uniqueGroupIds = activeCheckboxes.reduce(function (acc, t) {
    if (acc.indexOf(t.group.id) === -1) acc.push(t.group.id);
    return acc;
  }, []);

  var primaryGroupId = "y1";

  if (uniqueGroupIds.indexOf("y1") !== -1) {
    primaryGroupId = "y1";
  } else {
    var barGroupIds = uniqueGroupIds.filter(function (gid) {
      return activeCheckboxes.some(function (t) {
        if (t.group.id !== gid) return false;
        var s = STYLE_MAP[t.key] || {};
        return s.type === "bar";
      });
    }).sort(function (a, b) {
      return parseInt(a.replace("y", "")) - parseInt(b.replace("y", ""));
    });

    if (barGroupIds.length > 0) {
      primaryGroupId = barGroupIds[0];
    } else if (uniqueGroupIds.length > 0) {
      uniqueGroupIds.sort(function (a, b) {
        return parseInt(a.replace("y", "")) - parseInt(b.replace("y", ""));
      });
      primaryGroupId = uniqueGroupIds[0];
    }
  }

  var traces = [];
  var usedGroups = {};

  activeCheckboxes.forEach(function (item) {
    var key = item.key;
    var group = item.group;
    var title = item.title;
    var decimals = item.decimals;

    usedGroups[group.id] = group;

    var style = STYLE_MAP[key] || { type: "scatter", color: "black" };

    var textData = [];

    var dataStatsY = dataStatsX.map(function (xKey) {
      var val = dataStats[xKey][key];
      var parsedVal = val;
      var displayStr = val;

      if (typeof val === "string" && val.indexOf("/") !== -1) {
        parsedVal = parseFloat(val.split("/")[0]);
        displayStr = val;
      } else if (typeof val === "number") {
        displayStr = val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
      }

      textData.push(displayStr);
      return parsedVal;
    });

    var axisId = group.id;
    if (axisId === primaryGroupId) {
      axisId = "y";
    }

    var trace = {
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

    var isRatio = (typeof dataStats[dataStatsX[0]]?.[key] === "string" && dataStats[dataStatsX[0]][key].indexOf("/") !== -1);
    if (isRatio) {
      trace.hovertemplate = "<b>%{text}</b>";
    } else {
      trace.hovertemplate = "<b style='font-weight: bold; color: var(--card-shadow);'>%{y:,." + decimals + "f}</b><extra>" + title + "</extra>";
    }

    if (style.type === "bar") {
      trace.marker.color = style.color;
      trace.opacity = 0.5;
      trace.offsetgroup = key;
    } else {
      trace.mode = "lines+markers";
      trace.line.color = style.color;
      trace.line.dash = style.dash || "solid";
      trace.marker.size = (style.marker && style.marker.size) ? style.marker.size : 6;
    }

    if (style.marker) {
      Object.assign(trace.marker, style.marker);
      if (style.marker.line) trace.marker.line = style.marker.line;
    }

    // [Dynamic Color Logic for Exceedance Layers]
    if (["ExcDays", "ExcDays-edm", "ExcDays-m0p5m", "ExcDays-m1p0m"].includes(key)) {

      var valNotBySmoke = [];
      var valBySmoke = [];

      if (!isDetailMode) {
        var dsVal = document.getElementById("MapDataSelect")?.value;
        var dsKey = dsVal;
        if (dsVal === "gam-v2") dsKey = "gam_v2";
        else if (dsVal === "gam-v1") dsKey = "gam_v1";
        else if (dsVal === "epa-ember") dsKey = "epa_ember";
        else if (dsVal === "pm-cbsa") dsKey = "pm_cbsa";

        var rawData = loadedGeoJSON ? loadedGeoJSON[dsKey] : null;

        var countsByState = {};
        dataStatsX.forEach(function (st) { countsByState[st] = { c1: 0, c2: 0 }; });

        if (rawData && rawData.features) {
          var tmpl = templates.find(t => t.id === key);
          var propName = tmpl ? tmpl.field : null;

          if (propName) {
            rawData.features.forEach(function (fi) {
              var st = fi.properties.state;
              var v = fi.properties[propName];
              if (countsByState[st] && v !== undefined && v !== null) {
                if (v === 1) countsByState[st].c1++;
                else if (v === 2) countsByState[st].c2++;
              }
            });
          }
        }

        valNotBySmoke = dataStatsX.map(function (st) { return countsByState[st] ? countsByState[st].c1 : 0; });
        valBySmoke = dataStatsX.map(function (st) { return countsByState[st] ? countsByState[st].c2 : 0; });

      } else {
        valNotBySmoke = dataStatsY.map(v => (v === 1 ? 1 : 0));
        valBySmoke = dataStatsY.map(v => (v === 2 ? 1 : 0));
      }

      var l_title_1 = "ExcDays with minimal SMO";
      var l_title_2 = "ExcDays with significant SMO";

      if (key === "ExcDays-edm") {
        l_title_1 = "ExcDays with minimal SMO (EDM)";
        l_title_2 = "ExcDays with significant SMO (EDM)";
      } else if (key === "ExcDays-m0p5m") {
        l_title_1 = "ExcDays with minimal smoke PM2.5 (m0p5m)";
        l_title_2 = "ExcDays with significant smoke PM2.5 (m0p5m)";
      } else if (key === "ExcDays-m1p0m") {
        l_title_1 = "ExcDays with minimal smoke PM2.5 (m1p0m)";
        l_title_2 = "ExcDays with significant smoke PM2.5 (m1p0m)";
      }

      trace.y = valNotBySmoke;
      trace.text = valNotBySmoke.map(String);
      trace.name = l_title_1;
      trace.marker.color = style.splitColors[0];
      trace.showlegend = true;
      trace.hovertemplate = "<b>" + l_title_1 + ": %{text}</b><extra></extra>";
      trace.offsetgroup = key;

      var trace2 = JSON.parse(JSON.stringify(trace));
      trace2.y = valBySmoke;
      trace2.text = valBySmoke.map(String);
      trace2.name = l_title_2;
      trace2.marker.color = style.splitColors[1];
      trace2.showlegend = true;
      trace2.hovertemplate = "<b>" + l_title_2 + ": %{text}</b><extra></extra>";
      trace2.offsetgroup = key;
      trace2.base = valNotBySmoke;

      traces.push(trace);
      traces.push(trace2);
      return;
    }

    traces.push(trace);
  });

  var layout = {
    paper_bgcolor: theme.paper_bgcolor,
    plot_bgcolor: theme.plot_bgcolor,
    hovermode: "x unified",
    xaxis: Object.assign({}, getSpikeLayout(theme), {
      tickangle: -90,
      tickfont: { size: fontSize * 0.8, color: theme.axisText },
      automargin: true,
      title: { text: isDetailMode ? "AQS site (" + currentDailyDetailStateBarLine + ")" : "State", font: { size: fontSize, color: theme.axisText }, standoff: 20 },
      gridcolor: theme.grid,
      linecolor: theme.axisText,
      mirror: true,
      type: "category"
    }),
    margin: { t: 50, r: 50, b: 100, l: 50 },
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

  var baseAxis = Object.assign({}, getSpikeLayout(theme), {
    tickfont: { size: fontSize * 0.8, color: theme.axisText },
    automargin: true,
    showgrid: false,
    zeroline: true,
    linecolor: theme.axisText,
    mirror: true,
    gridcolor: theme.grid
  });

  var resolveAxisTitle = function (group) {
    if (group.id !== "y4" && group.id !== "y5") {
      return group.title;
    }

    var trace = activeCheckboxes.find(function (t) { return t.group.id === group.id; });
    if (trace) {
      return trace.title;
    }
    return group.title;
  };

  var leftTitle = "";
  if (usedGroups[primaryGroupId]) {
    leftTitle = resolveAxisTitle(usedGroups[primaryGroupId]);
  }

  layout.yaxis = Object.assign({}, baseAxis, {
    title: { text: leftTitle, font: { color: theme.axisText } },
    side: "left",
    showgrid: true
  });

  var activeRightGroups = Object.values(usedGroups)
    .filter(function (g) {
      if (g.id === primaryGroupId) return false;
      return g.side === "right";
    })
    .sort(function (a, b) {
      return parseInt(a.id.replace("y", "")) - parseInt(b.id.replace("y", ""));
    });

  if (activeRightGroups.length > 0) {
    var step = 0.08;
    var spaceNeeded = Math.max(0, activeRightGroups.length - 1) * step;
    if (spaceNeeded > 0.4) spaceNeeded = 0.4;

    layout.xaxis.domain = [0, 1.0 - spaceNeeded];

    activeRightGroups.forEach(function (g, idx) {
      var key = g.axisName;
      var axisDef = Object.assign({}, baseAxis, {
        title: { text: resolveAxisTitle(g), font: { color: theme.axisText } },
        overlaying: "y",
        side: "right",
        tickmode: "sync",
        tickformat: ".0f"
      });

      if (idx === 0) {
        axisDef.anchor = "x";
      } else {
        axisDef.anchor = "free";
        axisDef.position = 1.0 - spaceNeeded + (idx * step);
      }
      layout[key] = axisDef;
    });
  }

  if (container._barlineObserver) {
    container._barlineObserver.disconnect();
    delete container._barlineObserver;
  }

  var attachStateSiteListeners = function () {
    var callback;

    if (!isDetailMode) {
      // Drill-down to State
      callback = function (stateName) {
        currentDailyDetailStateBarLine = stateName;
        renderDailyBarLine(containerId);
      };
    } else {
      // Highlight Site on Map
      callback = function (siteId) {
        if (dataStats && dataStats[siteId]) {

          var s = dataStats[siteId];

          if (s._coords && s._properties) {
            highlightSiteOnMap(s._coords, s._properties, getDatasetInfo().key);
          }
        }
      };
    }

    attachDrillDownListeners(container, ".xtick text", callback);
  };

  var filename = "barline_" + (isDetailMode ? currentDailyDetailStateBarLine : "allstate") + "_" + currentDate();
  var config = getPlotlyConfig(filename);
  
  clearPlotMessage(container);
  Plotly.react(container, traces, layout, config).then(function () {

    attachStateSiteListeners();
    container.removeAllListeners("plotly_afterplot");
    container.on("plotly_afterplot", attachStateSiteListeners);

    attachResizeObserver(container, "_barlineObserver");

    renderBackButton(container, "stats-back-btn-barline", isDetailMode ? function () {
      currentDailyDetailStateBarLine = null;
      renderDailyBarLine(containerId);
    } : null);
  });
};

// Export reset for ui-reset.js
export function resetState() {
  currentDailyDetailStateBarLine = null;
}

