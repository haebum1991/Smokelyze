
import { db, doc, getDoc } from "./fb-init.js";

function ensureAnalyticsModalInDOM() {
    if (document.getElementById("AnalyticsModalOverlay")) return;

    const modalHtml = `
<style id="AnalyticsModalStyles">
  .analytics-grid {
    overflow-y: auto;
    flex: 1;
    padding: 2rem;
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 2rem;
    align-content: start;
  }
  .chart-span-pie {
    grid-column: span 2;
  }
  .chart-span-bar {
    grid-column: span 3;
  }
  .chart-span-full {
    grid-column: span 6;
  }
  @media (max-width: 1024px) {
    .analytics-grid {
      grid-template-columns: 1fr;
    }
    .chart-span-pie,
    .chart-span-bar,
    .chart-span-full {
      grid-column: auto;
    }
  }
</style>
<div class="MapPost-modal-overlay" id="AnalyticsModalOverlay" style="display:none; z-index: var(--z-highest);">
  <div class="MapPost-modal" style="width: 90vw; display: flex; flex-direction: column;">
    <div class="MapPost-modal-header">
      <h3 id="AnalyticsModalTitle">Smokelyze Usage Analytics</h3>
      <button class="ui-btn-close" id="AnalyticsModalClose" style="cursor: pointer;">
        <svg width="20" height="20" style="pointer-events: none;">
          <use xlink:href="#icon-close" />
        </svg>
      </button>
    </div>
    
    <div style="padding: 1rem 2rem; background: var(--sidebar-widget-bg); border-bottom: 0.1rem solid var(--border-main); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
      <span style="font-size: 1.4rem; color: var(--card-shadow);" id="AnalyticsLastUpdated">Loading data...</span>
      <div id="AnalyticsSummaryStats" style="display: flex; gap: 2rem;">
        <!-- Summary stats injected via JS -->
      </div>
    </div>

    <div class="MapPost-modal-body analytics-grid">
      <!-- Row 1: 3 Pie Charts -->
      <div id="AnalyticsChartEvent" class="chart-span-pie"
        style="min-height: 350px; background: var(--color-bg); border: 0.1rem solid var(--border-main); border-radius: var(--border-radius-0p8rem); padding: 1rem;">
      </div>
      <div id="AnalyticsChartRole" class="chart-span-pie"
        style="min-height: 350px; background: var(--color-bg); border: 0.1rem solid var(--border-main); border-radius: var(--border-radius-0p8rem); padding: 1rem;">
      </div>
      <div id="AnalyticsChartDataset" class="chart-span-pie"
        style="min-height: 350px; background: var(--color-bg); border: 0.1rem solid var(--border-main); border-radius: var(--border-radius-0p8rem); padding: 1rem;">
      </div>

      <!-- Row 2: 3 Bar Charts -->
      <div id="AnalyticsChartLayer" class="chart-span-pie"
        style="min-height: 350px; background: var(--color-bg); border: 0.1rem solid var(--border-main); border-radius: var(--border-radius-0p8rem); padding: 1rem;">
      </div>
      <div id="AnalyticsChartState" class="chart-span-pie"
        style="min-height: 350px; background: var(--color-bg); border: 0.1rem solid var(--border-main); border-radius: var(--border-radius-0p8rem); padding: 1rem;">
      </div>
      <div id="AnalyticsChartAqs" class="chart-span-pie"
        style="min-height: 350px; background: var(--color-bg); border: 0.1rem solid var(--border-main); border-radius: var(--border-radius-0p8rem); padding: 1rem;">
      </div>

      <!-- Row 3: 1 Full-width Line Chart -->
      <div id="AnalyticsChartDate" class="chart-span-full"
        style="min-height: 350px; background: var(--color-bg); border: 0.1rem solid var(--border-main); border-radius: var(--border-radius-0p8rem); padding: 1rem;">
      </div>
    </div>
  </div>
</div>`;

    document.body.insertAdjacentHTML("beforeend", modalHtml);

    const overlay = document.getElementById("AnalyticsModalOverlay");
    const closeBtn = document.getElementById("AnalyticsModalClose");

    closeBtn?.addEventListener("click", () => {
        if (overlay) overlay.style.display = "none";
    });
}

function initAnalyticsModal() {
    const btn = document.getElementById("MapBtnAnalytics");
    if (!btn) return;

    btn.addEventListener("click", async () => {
        ensureAnalyticsModalInDOM();
        const overlay = document.getElementById("AnalyticsModalOverlay");
        if (overlay) overlay.style.display = "flex";
        await loadAnalytics();
    });
    
    // Global Event Delegation for Close Button (Works in all environments/local servers)
    document.addEventListener("click", (e) => {
        if (e.target.closest("#AnalyticsModalClose")) {
            const overlay = document.getElementById("AnalyticsModalOverlay");
            if (overlay) overlay.style.display = "none";
        }
    });

    // Handle window resize for ECharts responsiveness
    window.addEventListener("resize", () => {
        const instances = document.querySelectorAll(".analytics-grid [_echarts_instance_]");
        instances.forEach(el => {
            const chart = echarts.getInstanceByDom(el);
            if (chart) chart.resize();
        });
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAnalyticsModal);
} else {
    initAnalyticsModal();
}

const EVENT_MAPPING = {
    "view": "Layer Views",
    "click_point": "Point Clicks",
    "download": "Data Downloads",
    "chat": "AI Copilot Chats"
};

const DATASET_MAPPING = {
    // for view naming 
    "gam_v2": "UW GAM-v2",
    "gam_v1": "UW GAM-v1",
    "pm_cbsa": "UW Smoke PM2.5",
    "epa_ember": "EPA EMBER",
    "gam_v2_pred": "UW GAM-v2 (+)",
    "pm_cbsa_pred": "UW Smoke PM2.5 (+)",
    "hysplit": "HYSPLIT"
};

const LAYER_NAME_MAPPING = {
    // --- Model Layers (GAM, PM-CBSA, EMBER) ---
    "mda8-obs": "Obs MDA8",
    "mda8-pred": "Pred MDA8",
    "mda8-pred-edm": "Pred MDA8 (EDM)",
    "smo": "SMO",
    "smo-edm": "SMO (EDM)",
    "resids": "Residuals",
    "resids-edm": "Residuals (EDM)",
    "resids-quant": "Quant residual",
    "resids-quant-edm": "Quant residual (EDM)",
    "pm25-obs": "Obs PM2.5",
    "pm25-quant": "Quant PM2.5",
    "pm25-crit": "PM2.5-crit",
    "pm25-crit-m0p5m": "PM2.5-crit m0p5m",
    "pm25-crit-m1p0m": "PM2.5-crit m1p0m",
    "pm25-smoke-m0p5m": "Smoke PM2.5 m0p5m",
    "pm25-smoke-m1p0m": "Smoke PM2.5 m1p0m",
    "tmax": "TMAX",
    "srad": "SRAD",
    "smokeday": "Smoke Day (SMD)",
    "smokeday-975": "SMO > 97.5th",
    "smokeday-975-edm": "SMO > 97.5th (EDM)",
    "smokeday-m0p5m": "Smoke day m0p5m",
    "smokeday-m1p0m": "Smoke day m1p0m",
    "ExcDays": "ExcDay",
    "ExcDays-edm": "ExcDay (EDM)",
    "ExcDays-m0p5m": "ExcDay m0p5m",
    "ExcDays-m1p0m": "ExcDay m1p0m",
    
    // --- Screening & Dispersion ---
    "aerscreen": "AERSCREEN",
    "gaussian": "AERSCREEN (Gaussian)",

    // --- Satellite & Model data ---
    "smoke": "HMS-smoke",
    "fire": "HMS-fire",
    "burn": "MODIS Burn Area",
    "wildfire-news": "WF-news",
    "wildfire-inci": "WF-incidents",
    "wildfire-peri": "WF-perimeters",
    "wildfire-inci-curr": "WF-incidents (Live)",
    "wildfire-peri-curr": "WF-perimeters (Live)",
    "MapPost": "MapPost",
    "hrrr-colmd": "HRRR-SmokeVCD",
    "hrrr-massden": "HRRR-Smoke8m",
    "tempo-no2": "TEMPO-NO2",
    "tempo-hcho": "TEMPO-HCHO",
    "tropomi-no2": "TROPOMI-NO2",
    "tropomi-hcho": "TROPOMI-HCHO",
    
    // --- GEOS-CF ---
    "geoscf-o3": "GEOS-CF O3",
    "geoscf-co": "GEOS-CF CO",
    "geoscf-no2": "GEOS-CF NO2",
    "geoscf-hcho": "GEOS-CF HCHO",
    "geoscf-pm25": "GEOS-CF PM2.5",
    "geoscf-pm25oc": "GEOS-CF PM2.5OC",

    // --- AirFuse ---
    "airfuse-o3": "AirFuse O3",
    "airfuse-pm25": "AirFuse PM2.5",

    "goes-aod-east": "GOES-AOD-East",
    "goes-aod-west": "GOES-AOD-West",
    "goes-geocolor-east": "GOES-GeoColor-East",
    "goes-geocolor-west": "GOES-GeoColor-West",
    "viirs-truecolor": "VIIRS-TrueColor",

    "traj-backward": "HYSPLIT Traj (bwd)",
    "traj-forward": "HYSPLIT Traj (fwd)",
    "disp-backward": "HYSPLIT Disp (bwd)",
    "disp-forward": "HYSPLIT Disp (fwd)",

    // --- AirNow ---
    "airnow-daily-mda8": "AirNow MDA8",
    "airnow-daily-pm25": "AirNow PM2.5",
    "airnow-hourly-ozone": "AirNow O3 (hr)",
    "airnow-hourly-pm25": "AirNow PM2.5 (hr)",
    "airnow-hourly-no2": "AirNow NO2 (hr)",

    "airnow_daily": "AirNow daily",
    "airnow_hourly": "AirNow hourly",
    
    // --- MapPost Interactions ---
    "create_post": "MapPost Create",
    "view_post": "MapPost View",
    "edit_post": "MapPost Edit",
    "delete_post": "MapPost Delete",
    "like_post": "MapPost Like",
    "unlike_post": "MapPost Unlike",
    "create_reply": "Reply Create",
    "edit_reply": "Reply Edit",
    "delete_reply": "Reply Delete",
    "like_reply": "Reply Like",
    "unlike_reply": "Reply Unlike",
    "restore_map_state": "Restore Map State",

    // --- Download --- 
    "gam_v2": "UW GAM-v2",
    "gam_v1": "UW GAM-v1",
    "pm_cbsa": "UW Smoke PM2.5",
    "epa_ember": "EPA EMBER",
    "gam_v2_pred": "UW GAM-v2 (+)",
    "pm_cbsa_pred": "UW Smoke PM2.5 (+)",
};

const ROLE_ORDER = [
    "scientist",
    "government",
    "student",
    "consulting",
    "general",
    "unknown"
];

const DATASET_ORDER = [
    "UW GAM-v2",
    "UW GAM-v1",
    "UW Smoke PM2.5",
    "EPA EMBER",
    "UW GAM-v2 (+)",
    "UW Smoke PM2.5 (+)"
];

async function loadAnalytics() {
    const label = document.getElementById("AnalyticsLastUpdated");
    const summaryDiv = document.getElementById("AnalyticsSummaryStats");
    if (label) label.textContent = "Loading data...";

    try {
        const docRef = doc(db, "smokelyze_public_data", "analytics_summary");
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            if (label) label.textContent = "No analytics data found.";
            return;
        }

        const data = docSnap.data();
        if (label) {
            label.innerHTML = `Data through: <strong>${data.lastProcessedDate || "Unknown"}</strong> (Last updated: ${data.lastUpdated || "Unknown"})`;
        }

        // --- Summary Stats ---
        if (summaryDiv) {
            const totalUsers = Object.values(data.key_userRole || {}).reduce((a, b) => a + b, 0);

            summaryDiv.innerHTML = `
                <div class="summary-badge"
                  style="
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                  ">
                    <span
                      style="
                        font-size: 2.2rem;
                        font-weight: bold;
                        color: var(--card-shadow);
                      ">${totalUsers.toLocaleString()}</span>
                    <span
                      style="
                        font-size: 1.2rem;
                        color: var(--text-main);
                        text-transform: uppercase;
                        letter-spacing: 0.1rem;
                        opacity: 0.8;
                      ">Registered Users</span>
                </div>
            `;
        }

        const reqEvents = {};
        if (data.event_name) {
            for (const [key, val] of Object.entries(data.event_name)) {
                reqEvents[EVENT_MAPPING[key] || key] = val;
            }
        }

        const roleLabels = [];
        const roleValues = [];
        ROLE_ORDER.forEach(role => {
            if (data.key_userRole && data.key_userRole[role]) {
                roleLabels.push(role);
                roleValues.push(data.key_userRole[role]);
            }
        });

        const reqLayers = {};
        if (data.key_layer) {
            for (const [key, val] of Object.entries(data.key_layer)) {
                const cleanKey = key.replace(/^layer-/, "");
                const newName = LAYER_NAME_MAPPING[cleanKey] || cleanKey;
                reqLayers[newName] = (reqLayers[newName] || 0) + val;
            }
        }

        const mappedDatasets = {};
        if (data.key_dataset) {
            for (const [key, val] of Object.entries(data.key_dataset)) {
                if (DATASET_MAPPING[key]) {
                    const mappedName = DATASET_MAPPING[key];
                    mappedDatasets[mappedName] = (mappedDatasets[mappedName] || 0) + val;
                }
            }
        }

        const datasetLabels = [];
        const datasetValues = [];
        DATASET_ORDER.forEach(name => {
            if (mappedDatasets[name]) {
                datasetLabels.push({ name, value: mappedDatasets[name] });
            }
        });

        const reqStates = {};
        if (data.key_state) {
            for (const [key, val] of Object.entries(data.key_state)) {
                if (key !== "N/A" && key !== "null" && key !== "undefined") reqStates[key] = val;
            }
        }

        const reqAQS = {};
        if (data.key_aqs) {
            for (const [key, val] of Object.entries(data.key_aqs)) {
                if (key !== "none" && key !== "null" && key !== "undefined") reqAQS[key] = val;
            }
        }

        renderPieChart("AnalyticsChartEvent", "Total Usage by Event", reqEvents);
        renderPieChart("AnalyticsChartRole", "User Demographics", roleLabels.map((l, i) => ({ name: l, value: roleValues[i] })));
        renderPieChart("AnalyticsChartDataset", "Requested Datasets", datasetLabels);

        renderBarChart("AnalyticsChartLayer", "Requested Layers", reqLayers);
        renderBarChart("AnalyticsChartState", "Requested States", reqStates);
        renderBarChart("AnalyticsChartAqs", "Requested AQS", reqAQS);

        renderBarTsChart("AnalyticsChartDate", "Requested Dates", data.key_date);

    } catch (e) {
        console.error("Error loading analytics:", e);
        if (label) label.textContent = "Error loading data.";
    }
}

function getEChartsCommonOptions(title) {
    const style = getComputedStyle(document.documentElement);
    const textColor = style.getPropertyValue("--text-main").trim();
    const bgColor = style.getPropertyValue("--color-bg").trim();
    const borderColor = style.getPropertyValue("--border-main").trim();

    return {
        backgroundColor: bgColor, // [NEW] Set root background color
        title: {
            text: title,
            left: "center",
            textStyle: {
                color: textColor,
                fontSize: 16,
                fontWeight: "bold",
                fontFamily: "Outfit, sans-serif"
            }
        },
        tooltip: {
            trigger: "item",
            backgroundColor: bgColor,
            textStyle: { color: textColor }
        },
        toolbox: {
            show: true,
            feature: {
                saveAsImage: {
                    show: true,
                    title: "Save",
                    backgroundColor: bgColor, // [MOD] Ensure export uses correct background
                    iconStyle: { borderColor: textColor }
                }
            },
            right: 10,
            top: 0
        },
        animationDuration: 1500,
        animationEasing: "cubicInOut"
    };
}

function renderPieChart(divId, title, dataObj) {
    const dom = document.getElementById(divId);
    let chart = echarts.getInstanceByDom(dom);
    if (chart) {
        chart.dispose();
    }
    chart = echarts.init(dom);
    let data = Array.isArray(dataObj) ? dataObj : Object.entries(dataObj).map(([name, value]) => ({ name, value }));

    const palette = [
        "#6366f1",
        "#10b981",
        "#f59e0b",
        "#8b5cf6",
        "#3b82f6",
        "#f43f5e",
        "#14b8a6"
    ];

    const option = {
        ...getEChartsCommonOptions(title),
        tooltip: {
            trigger: "item",
            formatter: "<b>{b}</b><br/>Count: {c} (<b>{d}%</b>)"
        },
        legend: { bottom: "1%", left: "center", textStyle: { color: "inherit", fontSize: 14 } },
        series: [{
            type: "pie",
            radius: ["40%", "70%"],
            center: ["50%", "45%"],
            avoidLabelOverlap: false,
            itemStyle: { borderRadius: 6, borderColor: "transparent", borderWidth: 2 },
            label: { show: false, position: "center" },
            emphasis: {
                label: {
                    show: true,
                    fontSize: 16,
                    fontWeight: "bold",
                    formatter: "{b}\n{d}%" // Show name and percent on hover
                }
            },
            labelLine: { show: false },
            data: data,
            color: palette
        }]
    };
    chart.setOption(option);
}

function renderBarChart(divId, title, mapObj) {
    const dom = document.getElementById(divId);
    let chart = echarts.getInstanceByDom(dom);
    if (chart) {
        chart.dispose();
    }
    chart = echarts.init(dom);

    // [MOD] Show all items, not just top 10
    const entries = Object.entries(mapObj).sort((a, b) => b[1] - a[1]);
    const labels = entries.map(e => e[0]).reverse();
    const values = entries.map(e => e[1]).reverse();

    const style = getComputedStyle(document.documentElement);
    const textColor = style.getPropertyValue("--text-main").trim();
    const barColor = style.getPropertyValue("--card-shadow").trim();
    const borderColor = style.getPropertyValue("--border-main").trim();

    const option = {
        ...getEChartsCommonOptions(title),
        grid: { left: "3%", right: "15%", bottom: "10%", top: "15%", containLabel: true },
        xAxis: {
            type: "value",
            splitLine: { lineStyle: { color: borderColor } },
            axisLabel: { color: textColor, fontSize: 14 }
        },
        yAxis: {
            type: "category",
            data: labels,
            axisLabel: { color: textColor, fontSize: 14 }
        },
        // [NEW] Add dataZoom to allow scrolling through many items
        dataZoom: [
            {
                type: "slider",
                yAxisIndex: 0,
                right: 10,
                width: 25, // [MOD] Thicker slider
                start: Math.max(0, 100 - (10 / labels.length) * 100), // Show approx 10 items at once
                end: 100,
                textStyle: { color: "transparent" },
                handleSize: "100%"
            },
            {
                type: "inside",
                yAxisIndex: 0,
                zoomOnMouseWheel: true,
                moveOnMouseMove: true
            }
        ],
        series: [{
            name: "Requests",
            type: "bar",
            barWidth: "65%", // [MOD] Thicker bars
            data: values,
            itemStyle: { color: barColor, borderRadius: [0, 6, 6, 0] },
            label: { show: true, position: "right", color: textColor, fontSize: 10 }
        }]
    };
    chart.setOption(option);
}

function renderBarTsChart(divId, title, mapObj) {
    const dom = document.getElementById(divId);
    let chart = echarts.getInstanceByDom(dom);
    if (chart) {
        chart.dispose();
    }
    chart = echarts.init(dom);
    const entries = Object.entries(mapObj).sort((a, b) => a[0].localeCompare(b[0]));

    const seriesData = [];
    entries.forEach(([k, v]) => {
        let lbl = String(k).trim();
        // Standardize YYYYMMDD to YYYY-MM-DD
        if (lbl.length === 8 && !lbl.includes("-") && lbl.startsWith("20")) {
            lbl = lbl.substring(0, 4) + "-" + lbl.substring(4, 6) + "-" + lbl.substring(6, 8);
        }

        // [MOD] Stricter validation to filter out garbage or "1900" dates
        if (lbl.includes("-") && lbl.startsWith("20")) {
            const yr = parseInt(lbl.substring(0, 4), 10);
            if (yr >= 2015 && yr <= 2030) { // Only show modern Smokelyze era data
                seriesData.push([lbl, v]);
            }
        }
    });

    const style = getComputedStyle(document.documentElement);
    const textColor = style.getPropertyValue("--text-main").trim();
    const accentColor = style.getPropertyValue("--card-shadow").trim();
    const borderColor = style.getPropertyValue("--border-main").trim();

    const option = {
        ...getEChartsCommonOptions(title),
        tooltip: {
            ...getEChartsCommonOptions(title).tooltip,
            trigger: "axis",
            axisPointer: { type: "shadow" },
            formatter: (params) => {
                const p = params[0];
                return `<b>${p.value[0]}</b><br/>Requests: <b>${p.value[1]}</b>`;
            }
        },
        grid: {
            left: "5%",
            right: "5%",
            bottom: 80,
            top: 50,
            containLabel: true,
            show: true,
            borderColor: borderColor,
            borderWidth: 1
        },
        xAxis: {
            type: "time",
            axisLabel: {
                color: textColor,
                fontSize: 14,
                formatter: {
                    year: "{yyyy}",
                    month: "{MMM}",
                    day: "{d} {MMM}",
                    none: "{yyyy}-{MM}-{dd}"
                }
            },
            splitLine: {
                show: true,
                lineStyle: {
                    color: borderColor,
                    type: "dashed",
                    opacity: 0.4
                }
            }
        },
        yAxis: {
            type: "value",
            name: "Requests",
            nameTextStyle: { color: textColor, fontWeight: "bold", fontSize: 14 },
            splitLine: { lineStyle: { color: borderColor } },
            axisLabel: { color: textColor, fontSize: 14 }
        },
        dataZoom: [
            { type: "inside", start: 0, end: 100 },
            {
                type: "slider",
                bottom: 30,
                height: 30,
                textStyle: { color: textColor }
            }
        ],
        series: [{
            name: "Requests",
            type: "bar",
            barMaxWidth: 10,
            large: true,
            data: seriesData,
            itemStyle: { color: accentColor, borderRadius: [2, 2, 0, 0] },
            markLine: {
                silent: true,
                symbol: "none",
                label: { show: false },
                lineStyle: {
                    color: borderColor,
                    type: "solid",
                    width: 1,
                    opacity: 0.6
                },
                data: Array.from(new Set(seriesData.map(d => d[0].substring(0, 4))))
                    .map(yr => ({ xAxis: `${yr}-01-01` }))
            }
        }]
    };
    chart.setOption(option);
}

