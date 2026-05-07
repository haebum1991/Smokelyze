
import { db, doc, getDoc } from "./fb-init.js";

document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("MapBtnAnalytics");
    const overlay = document.getElementById("AnalyticsModalOverlay");
    const closeBtn = document.getElementById("AnalyticsModalClose");

    if (!btn || !overlay) return;

    btn.addEventListener("click", async () => {
        overlay.style.display = "flex";
        await loadAnalytics();
    });

    closeBtn?.addEventListener("click", () => {
        overlay.style.display = "none";
    });

    // Handle window resize for ECharts responsiveness
    window.addEventListener("resize", () => {
        const instances = document.querySelectorAll(".analytics-grid [_echarts_instance_]");
        instances.forEach(el => {
            const chart = echarts.getInstanceByDom(el);
            if (chart) chart.resize();
        });
    });
});

const EVENT_MAPPING = {
    "view": "Layer Views",
    "click_point": "Point Clicks",
    "download": "Data Downloads",
    "hysplit_run": "HYSPLIT Runs"
};

const DATASET_MAPPING = {
    "gam_v2": "UW GAM-v2",
    "gam_v1": "UW GAM-v1",
    "pm_cbsa": "UW Smoke PM2.5",
    "epa_ember": "EPA EMBER",
    "gam_v2_pred": "UW GAM-v2 (+)",
    "pm_cbsa_pred": "UW Smoke PM2.5 (+)"
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

    // --- Satellite & Model data ---
    "smoke": "HMS-smoke",
    "fire": "HMS-fire",
    "burn": "MODIS Burn Area",
    "wildfire-nifc": "WF-incidents",
    "wildfire-news": "WF-news",
    "MapPost": "MapPost",
    "hysplit": "HYSPLIT",
    "hrrr-colmd": "HRRR-SmokeVCD",
    "hrrr-massden": "HRRR-Smoke8m",
    "tempo-no2": "TEMPO-NO2",
    "tempo-hcho": "TEMPO-HCHO",
    "tropomi-no2": "TROPOMI-NO2",
    "tropomi-hcho": "TROPOMI-HCHO",

    // --- AirNow ---
    "airnow-daily-mda8": "AirNow MDA8",
    "airnow-daily-pm25": "AirNow PM2.5",
    "airnow-hourly-ozone": "AirNow O3 (hr)",
    "airnow-hourly-pm25": "AirNow PM2.5 (hr)",
    "airnow-hourly-no2": "AirNow NO2 (hr)",
    
    "airnow_daily": "AirNow daily",
    "airnow_hourly": "AirNow hourly"
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
            label.innerHTML = `Data through: <strong>${data.lastProcessedDate || 'Unknown'}</strong> (Last updated: ${data.lastUpdated || 'Unknown'})`;
        }

        // --- Summary Stats ---
        if (summaryDiv) {
            const totalEvents = Object.values(data.event_name || {}).reduce((a, b) => a + b, 0);
            const totalUsers = Object.values(data.key_userRole || {}).reduce((a, b) => a + b, 0);
            const totalStates = Object.keys(data.key_state || {}).filter(k => k !== "N/A" && k !== "null").length;

            summaryDiv.innerHTML = `
                <div class="summary-badge" style="display: flex; flex-direction: column; align-items: center;">
                    <span style="font-size: 1.8rem; font-weight: 800; color: var(--card-shadow);">${totalEvents.toLocaleString()}</span>
                    <span style="font-size: 1rem; text-transform: uppercase; letter-spacing: 0.1rem; opacity: 0.8;">Total Events</span>
                </div>
                <div class="summary-badge" style="display: flex; flex-direction: column; align-items: center;">
                    <span style="font-size: 1.8rem; font-weight: 800; color: var(--card-shadow);">${totalUsers.toLocaleString()}</span>
                    <span style="font-size: 1rem; text-transform: uppercase; letter-spacing: 0.1rem; opacity: 0.8;">Active Users</span>
                </div>
                <div class="summary-badge" style="display: flex; flex-direction: column; align-items: center;">
                    <span style="font-size: 1.8rem; font-weight: 800; color: var(--card-shadow);">${totalStates}</span>
                    <span style="font-size: 1rem; text-transform: uppercase; letter-spacing: 0.1rem; opacity: 0.8;">States</span>
                </div>
            `;
        }

        const mappedEvents = {};
        if (data.event_name) {
            for (const [key, val] of Object.entries(data.event_name)) {
                mappedEvents[EVENT_MAPPING[key] || key] = val;
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

        const mappedLayers = {};
        if (data.key_layer) {
            for (const [key, val] of Object.entries(data.key_layer)) {
                const cleanKey = key.replace(/^layer-/, "");
                const newName = LAYER_NAME_MAPPING[cleanKey] || cleanKey;
                mappedLayers[newName] = (mappedLayers[newName] || 0) + val;
            }
        }

        const mappedDatasets = {};
        if (data.key_dataset) {
            for (const [key, val] of Object.entries(data.key_dataset)) {
                if (DATASET_MAPPING[key]) mappedDatasets[DATASET_MAPPING[key]] = val;
            }
        }

        const datasetLabels = [];
        const datasetValues = [];
        DATASET_ORDER.forEach(name => {
            if (mappedDatasets[name]) {
                datasetLabels.push({ name, value: mappedDatasets[name] });
            }
        });

        const cleanStates = {};
        if (data.key_state) {
            for (const [key, val] of Object.entries(data.key_state)) {
                if (key !== "N/A" && key !== "null" && key !== "undefined") cleanStates[key] = val;
            }
        }

        renderPieChart("AnalyticsChartEvent", "Total Usage by Event", mappedEvents);
        renderPieChart("AnalyticsChartRole", "User Demographics", roleLabels.map((l, i) => ({ name: l, value: roleValues[i] })));
        renderPieChart("AnalyticsChartDataset", "Requested Datasets", datasetLabels);

        renderBarChart("AnalyticsChartLayer", "Requested Layers", mappedLayers);
        renderBarChart("AnalyticsChartState", "Requested States", cleanStates);
        // --- AQS Stats (Filtering out [none]) ---
        const cleanAqs = {};
        if (data.key_aqs) {
            for (const [key, val] of Object.entries(data.key_aqs)) {
                if (key !== "none" && key !== "null" && key !== "undefined") cleanAqs[key] = val;
            }
        }
        renderBarChart("AnalyticsChartAqs", "Clicked AQS", cleanAqs);
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
            left: 60,
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
            splitLine: { show: false }
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
            barMaxWidth: 10, // [NEW] Ensure bars are visible
            large: true,
            data: seriesData,
            itemStyle: { color: accentColor, borderRadius: [2, 2, 0, 0] }
        }]
    };
    chart.setOption(option);
}

