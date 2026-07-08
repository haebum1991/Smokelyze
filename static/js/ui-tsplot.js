
import { map } from "./map-init.js";
import * as utils from "./utils.js";
import { auth } from "./fb-init.js";
import { getPlotTheme } from "./stats-common.js";
import { LAYER_TEMPLATES } from "./layers-def.js";


// DOM Elements
const modal = document.getElementById("TSplotModalOverlay");
const closeBtn = document.getElementById("TSplotModalClose");
const chartContainer = document.getElementById("TSplotChartContainer");
const loadingEl = document.getElementById("TSplotLoading");
const loadingTextEl = document.getElementById("TSplotLoadingText");
const errorEl = document.getElementById("TSplotError");

// Initialize listeners
if (closeBtn) {
    closeBtn.addEventListener("click", hideTSplotModal);
}

const state = {
    pendingLngLat: null
};

let activeChart = null;

// Auto-resize active chart with window once at the module level
window.addEventListener("resize", () => {
    if (activeChart) {
        activeChart.resize();
    }
});

// Capture coordinate from context menu directly in this module
if (map) {
    map.on("contextmenu", (e) => {
        state.pendingLngLat = e.lngLat;
    });
}

// Setup context menu button click listener
const tsplotBtn = document.getElementById("MapPostBtnTSplot");
if (tsplotBtn) {
    tsplotBtn.addEventListener("click", () => {
        // Hide context menu
        const ctxMenu = document.getElementById("MapPostContextMenu");
        if (ctxMenu) ctxMenu.style.display = "none";

        // Show time-series profile for the clicked coordinate
        if (state.pendingLngLat) {
            showTSProfile(state.pendingLngLat.lng, state.pendingLngLat.lat);
        }
    });
}

function hideTSplotModal() {
    if (modal) modal.style.display = "none";
    const dom = document.getElementById("TSplotChartContainer");
    if (dom) {
        const chart = echarts.getInstanceByDom(dom);
        if (chart) {
            chart.dispose();
        }
    }
    activeChart = null;
}

function getActiveLayerConfig() {
    const currentDataset = utils.getEffectiveDataset();
    const activeTmpl = LAYER_TEMPLATES.find(tmpl => {
        // For model-specific daily vector layers, ensure it supports the current dataset
        if (tmpl.duration === "daily" && !tmpl.manualLayer && tmpl.datasets && !tmpl.id.startsWith("airnow-")) {
            if (!tmpl.datasets.includes(currentDataset)) return false;
        }
        return document.getElementById(`layer-${tmpl.id}`)?.checked;
    });

    if (!activeTmpl) return null;

    let type = "daily_vector";
    let productId = activeTmpl.id;
    let sourceId = activeTmpl.id;
    let mapLayerId = `${activeTmpl.id}-circle`;
    let metric = (typeof activeTmpl.field === "function") ? activeTmpl.field(currentDataset) : activeTmpl.field;
    let title = (typeof activeTmpl.title === "function") ? activeTmpl.title(currentDataset) : activeTmpl.title;
    let dataset = null;
    let fieldPrefix = null;

    // 1. Raster layers (manualLayer = true)
    if (activeTmpl.manualLayer) {
        type = "raster";
        mapLayerId = `${activeTmpl.id}-raster`;
        const RASTER_PRODUCT_MAP = {
            "tempo-no2": "TEMPO_NO2_L3",
            "tempo-hcho": "TEMPO_HCHO_L3",
            "tropomi-no2": "TROPOMI_NO2_L3",
            "tropomi-hcho": "TROPOMI_HCHO_L3",
            "hrrr-colmd": "COLMD_entire",
            "hrrr-massden": "MASSDEN_8m",
            "goes-aod-east": "ABI-L2-AODC-east",
            "goes-aod-west": "ABI-L2-AODC-west"
        };
        productId = RASTER_PRODUCT_MAP[activeTmpl.id] || activeTmpl.id;
    }
    // 2. AirNow Hourly
    else if (activeTmpl.hourly && activeTmpl.id.startsWith("airnow-")) {
        type = "airnow_hourly";
        const AIRNOW_HOURLY_PREFIXES = {
            "airnow-hourly-pm25": "PM2.5_T",
            "airnow-hourly-ozone": "MDA8O3_T",
            "airnow-hourly-no2": "NO2_T"
        };
        fieldPrefix = AIRNOW_HOURLY_PREFIXES[activeTmpl.id];
    }
    // 3. AirNow Daily
    else if (activeTmpl.id.startsWith("airnow-daily-")) {
        type = "airnow_daily";
        metric = activeTmpl.id === "airnow-daily-pm25" ? "PM2.5" : "MDA8O3";
    }
    // 4. Model Daily Vector (gam-v1, gam-v2, pm-cbsa, epa-ember)
    else {
        type = "daily_vector";
        mapLayerId = `${activeTmpl.id}-${currentDataset}-circle`;
        dataset = currentDataset.replace(/-/g, "_");
    }

    return {
        type,
        productId,
        sourceId,
        mapLayerId,
        fieldPrefix,
        metric,
        title,
        dataset
    };
}

function getYAxisTitleAndDecimals(sourceId) {
    const tmpl = LAYER_TEMPLATES.find(t => t.id === sourceId);
    if (tmpl) {
        const currentDataset = utils.getEffectiveDataset();
        const displayTitle = (typeof tmpl.title === "function") ? tmpl.title(currentDataset) : tmpl.title;
        let title = displayTitle;

        if (sourceId.includes("no2")) {
            title = "NO2";
        } else if (sourceId.includes("hcho")) {
            title = "HCHO";
        } else if (sourceId === "hrrr-colmd") {
            title = "Smoke VCD";
        } else if (sourceId === "hrrr-massden") {
            title = "Smoke Concentration at 8m";
        } else if (sourceId.includes("goes")) {
            title = "AOD";
        } else {
            // Clean up titles for plot display (e.g. remove redundant prefixes)
            title = displayTitle
                .replace("AirNow Obs ", "")
                .replace("Obs ", "")
                .replace("Pred ", "")
                .replace(" (hourly)", "");
        }

        const unit = (typeof tmpl.unit === "function") ? tmpl.unit(currentDataset) : (tmpl.unit || "");
        if (unit && !title.toLowerCase().includes(unit.toLowerCase())) {
            title += ` (${unit})`;
        }

        return {
            title: title,
            decimals: tmpl.decimals !== undefined ? tmpl.decimals : 1
        };
    }
    return { title: "Value", decimals: 1 };
}

function getDisplayScale(sourceId, realValue) {
    const isTempo = sourceId.includes("tempo");
    const isTropomi = sourceId.includes("tropomi");
    const isHrrrColmd = sourceId === "hrrr-colmd";

    if (isTempo || isTropomi) {
        return realValue / 1e14;
    }
    if (isHrrrColmd) {
        return realValue / 1e3;
    }
    return realValue;
}

async function showTSProfile(lng, lat) {
    if (!modal) return;

    modal.style.display = "block";
    chartContainer.style.display = "none";
    errorEl.style.display = "none";
    loadingEl.style.display = "block";
    loadingTextEl.textContent = "Checking active layer...";

    const activeConfig = getActiveLayerConfig();
    if (!activeConfig) {
        showError("Please toggle on a layer first.");
        return;
    }
    
    // Direct check for visual-only imagery layers to avoid hitting the backend API
    if (activeConfig.productId.includes("geocolor") || activeConfig.productId.includes("truecolor")) {
        showError("Time-series profile is not supported for imagery layers.");
        return;
    }

    const localSelectedDateStr = utils.currentDate(); // Date picker date, e.g. "2026-06-01"

    // Parse active date/hour and convert to UTC for hourly datasets if needed
    const timePicker = document.getElementById("timePicker");
    let queryDateStr = localSelectedDateStr;
    let chartDateStr = localSelectedDateStr;
    let targetX = null;

    const isDaily = activeConfig.type === "airnow_daily" || activeConfig.type === "daily_vector" || activeConfig.sourceId.includes("tropomi");
    const isHourlyRaster = activeConfig.type === "raster";

    if (!isDaily && timePicker) {
        const localHour = parseInt(timePicker.value);
        const [y, m, d] = localSelectedDateStr.split("-").map(Number);
        const localDate = new Date(y, m - 1, d, localHour);
        const targetUtcHour = localDate.getUTCHours();
        targetX = `${String(targetUtcHour).padStart(2, "0")}:00`;

        // Shift chart date to the actual UTC date of the selected hour (since hourly data files/buffers are partitioned by UTC date)
        const utcY = localDate.getUTCFullYear();
        const utcM = String(localDate.getUTCMonth() + 1).padStart(2, "0");
        const utcD = String(localDate.getUTCDate()).padStart(2, "0");
        const utcIsoDateStr = `${utcY}-${utcM}-${utcD}`;

        chartDateStr = utcIsoDateStr;

        if (isHourlyRaster) {
            // For hourly rasters, we also shift the query date for GCS fetch
            queryDateStr = utcIsoDateStr;
        }
    }

    // ==========================================
    // CASE 1: Airnow Hourly (Instant Local Load)
    // ==========================================
    if (activeConfig.type === "airnow_hourly") {
        loadingTextEl.textContent = `Extracting hourly data locally for ${activeConfig.title}...`;

        const point = map.project(new maplibregl.LngLat(lng, lat));
        const bbox = [[point.x - 15, point.y - 15], [point.x + 15, point.y + 15]];
        const features = map.queryRenderedFeatures(bbox, { layers: [activeConfig.mapLayerId] });

        if (features.length === 0) {
            showError("Could not select AirNow station. Please make sure to click directly on a station marker.");
            return;
        }

        const props = features[0].properties;
        const siteName = props.site_name || props.site || "Unknown Station";
        const aqs = props.AQS || "Unknown AQS";
        const stateCode = props.state || "";
        const stationLabel = stateCode ? `${siteName} (${aqs}), ${stateCode}` : `${siteName} (${aqs})`;
        const finalData = [];

        for (let h = 0; h < 24; h++) {
            const hStr = String(h).padStart(2, "0");
            const field = `${activeConfig.fieldPrefix}${hStr}`;
            const val = props[field];
            if (val !== undefined && val !== null && val !== "") {
                const num = parseFloat(val);
                if (!isNaN(num)) {
                    finalData.push({
                        hour: h,
                        value: num,
                        displayValue: num
                    });
                }
            }
        }

        if (finalData.length === 0) {
            showError(`Selected station has no active hourly readings for ${localSelectedDateStr}.`);
            return;
        }

        loadingEl.style.display = "none";
        chartContainer.style.display = "block";
        renderChart(finalData, activeConfig, localSelectedDateStr, chartDateStr, targetX, stationLabel, false, true);
        return;
    }

    // ==========================================
    // CASE 2: Server-side API Query (Options B)
    // ==========================================
    loadingTextEl.textContent = `Requesting time-series profile for ${activeConfig.productId}...`;

    try {
        const user = auth.currentUser;
        const idToken = user ? await user.getIdToken() : null;
        const headers = {};
        if (idToken) {
            headers["Authorization"] = `Bearer ${idToken}`;
        }

        let url = `/api/tsplot?date=${queryDateStr}&product=${activeConfig.productId}&lat=${lat}&lon=${lng}`;
        let locationLabel = `(${lng.toFixed(4)}, ${lat.toFixed(4)})`;

        // Add AQS parameter for daily vector data (Airnow or Model Predictions)
        if (activeConfig.type === "airnow_daily" || activeConfig.type === "daily_vector") {
            const point = map.project(new maplibregl.LngLat(lng, lat));
            const bbox = [[point.x - 15, point.y - 15], [point.x + 15, point.y + 15]];
            const features = map.queryRenderedFeatures(bbox, { layers: [activeConfig.mapLayerId] });

            if (features.length === 0) {
                showError("Please make sure to click directly on a station marker.");
                return;
            }
            const props = features[0].properties;
            const aqs = props.AQS || props.AQS_PM || props.AQS_O3;
            if (!aqs) {
                showError("AQS identifier not found for the selected station.");
                return;
            }
            url += `&aqs=${aqs}`;

            if (activeConfig.type === "daily_vector") {
                url += `&dataset=${activeConfig.dataset}&metric=${activeConfig.metric}`;
            }

            const siteName = props.site_name || props.site || "Unknown Station";
            const stateCode = props.state || "";
            locationLabel = stateCode ? `${siteName} (${aqs}), ${stateCode}` : `${siteName} (${aqs})`;
        }

        const response = await fetch(url, { headers });
        if (!response.ok) {
            if (response.status === 401) {
                showError("Authentication required. Please sign in.");
            } else {
                const text = await response.text();
                showError(`Failed to load profile: ${text || response.statusText}`);
            }
            return;
        }

        const data = await response.json();
        if (!data || data.length === 0) {
            showError(`No data points found for ${activeConfig.productId} on ${queryDateStr}.`);
            return;
        }

        const finalData = data.map(d => ({
            hour: d.hour,
            date: d.date,
            value: d.value,
            displayValue: getDisplayScale(activeConfig.sourceId, d.value)
        }));

        loadingEl.style.display = "none";
        chartContainer.style.display = "block";

        renderChart(finalData, activeConfig, localSelectedDateStr, chartDateStr, targetX, locationLabel, isDaily, false);

    } catch (err) {
        console.error("Time-series profile fetch failed:", err);
        showError("An error occurred while loading data from the serverless API.");
    }
}

function showError(msg) {
    loadingEl.style.display = "none";
    chartContainer.style.display = "none";
    errorEl.textContent = msg;
    errorEl.style.display = "block";
}

function renderChart(data, activeConfig, localSelectedDateStr, utcDateStr, targetX, locationLabel, isDaily, isAirnowHourly) {
    const dom = document.getElementById("TSplotChartContainer");
    dom.style.height = "100%";
    let chart = echarts.getInstanceByDom(dom);
    if (chart) {
        chart.dispose();
    }
    chart = echarts.init(dom);
    activeChart = chart;

    const theme = getPlotTheme();
    const textColor = theme.axisText;
    const bgColor = theme.paper_bgcolor;
    const borderColor = theme.plot_bordercol;
    const gridColor = theme.grid;
    const primaryColor = theme.plot_bordercol;
    const fontSize = theme.fontSize;

    const { title: yTitle, decimals } = getYAxisTitleAndDecimals(activeConfig.sourceId);

    const xVals = isDaily ? data.map(d => d.date) : data.map(d => `${String(d.hour).padStart(2, "0")}:00`);
    const yVals = data.map(d => d.displayValue);

    // Calculate local timezone name dynamically (e.g. "PDT", "KST")
    const tzName = new Intl.DateTimeFormat("en-US", { timeZoneName: "short" })
        .formatToParts(new Date())
        .find(part => part.type === "timeZoneName")?.value || "Local";

    const [ly, lm, ld] = localSelectedDateStr.split("-").map(Number);
    const [qy, qm, qd] = utcDateStr.split("-").map(Number);

    // Generate local timezone x-axis labels matched to UTC hours
    const localXVals = isDaily ? [] : data.map(item => {
        const utcDate = new Date(Date.UTC(qy, qm - 1, qd, item.hour));
        const locHour = utcDate.getHours();
        const locMin = utcDate.getMinutes();
        const locHourStr = String(locHour).padStart(2, "0") + ":" + String(locMin).padStart(2, "0");

        // Calculate date boundaries correctly relative to the selected local calendar day
        const locSelectedStart = Date.UTC(ly, lm - 1, ld);
        const locDayStart = Date.UTC(utcDate.getFullYear(), utcDate.getMonth(), utcDate.getDate());
        const diffDays = Math.round((locDayStart - locSelectedStart) / (1000 * 60 * 60 * 24));

        let suffix = "";
        if (diffDays > 0) {
            suffix = " (+1d)";
        } else if (diffDays < 0) {
            suffix = " (-1d)";
        }
        return `${locHourStr}${suffix}`;
    });

    const displayName = activeConfig.title || activeConfig.productId;
    const titleText = isDaily
        ? `${displayName} 9-Day Profile`
        : `${displayName} Time-Series Plot`;
    const subTitleText = isDaily
        ? `Selected: ${localSelectedDateStr} at ${locationLabel}`
        : `${localSelectedDateStr} at ${locationLabel}`;

    const markLineData = [];
    const finalTargetX = isDaily ? localSelectedDateStr : targetX;
    if (finalTargetX !== null) {
        markLineData.push({
            xAxis: finalTargetX,
            label: {
                show: true,
                formatter: isDaily ? "Selected Date" : "Selected Hour",
                position: "end",
                color: "red",
                fontSize: fontSize * 0.8,
                fontWeight: "bold",
                backgroundColor: bgColor,
                padding: [2, 4],
                borderRadius: 3,
                distance: 5
            },
            lineStyle: {
                color: "red",
                type: "dashed",
                width: 2
            }
        });
    }

    // Configure single x-axis for daily, dual x-axes for hourly (UTC bottom, Local top)
    const xAxisOption = isDaily ? {
        type: "category",
        data: xVals,
        axisLabel: {
            color: textColor,
            fontSize: fontSize * 0.8,
            rotate: 0
        },
        axisLine: { lineStyle: { color: gridColor } },
        axisTick: { alignWithLabel: true },
        name: "Date",
        nameLocation: "middle",
        nameGap: 25,
        nameTextStyle: {
            color: textColor,
            fontSize: fontSize * 0.8,
            fontWeight: "bold"
        }
    } : [
        {
            type: "category",
            data: xVals,
            position: "bottom",
            axisLabel: {
                color: textColor,
                fontSize: fontSize * 0.8,
                rotate: -90
            },
            axisLine: { lineStyle: { color: gridColor } },
            axisTick: { alignWithLabel: true },
            name: `Top: Time (UTC) / Bottom: Time (${tzName})`,
            nameLocation: "middle",
            nameGap: 50, // Sitting between the UTC and Local axis labels
            nameTextStyle: {
                color: textColor,
                fontSize: fontSize * 0.8, // Slightly smaller to fit perfectly in the gap
                fontWeight: "bold"
            }
        },
        {
            type: "category",
            data: localXVals,
            position: "bottom",
            offset: 75, // Stack below the UTC axis
            axisLabel: {
                color: textColor,
                fontSize: fontSize * 0.8,
                rotate: -90
            },
            axisLine: { lineStyle: { color: gridColor } },
            axisTick: { alignWithLabel: true }
        }
    ];

    const option = {
        backgroundColor: "transparent",
        title: {
            text: titleText,
            subtext: subTitleText,
            left: "center",
            top: 10, // Bring title down slightly closer to the plot area
            textStyle: {
                color: textColor,
                fontSize: fontSize,
                fontWeight: "bold",
                fontFamily: "Outfit, sans-serif"
            },
            subtextStyle: {
                color: textColor,
                fontSize: fontSize * 0.8,
                fontFamily: "Inter, sans-serif"
            }
        },
        tooltip: {
            trigger: "axis",
            backgroundColor: bgColor,
            borderColor: borderColor,
            borderWidth: 1,
            textStyle: { color: textColor },
            formatter: function (params) {
                if (!params || params.length === 0) return "";
                // Show both UTC and Local Time in tooltip
                let timeHeader = params[0].axisValue;
                if (!isDaily) {
                    const idx = params[0].dataIndex;
                    const localTime = localXVals[idx];
                    timeHeader = `UTC: ${params[0].axisValue} | ${tzName}: ${localTime}`;
                }
                let html = `${timeHeader}<br/>`;
                params.forEach(p => {
                    if (p.value !== undefined && p.value !== null) {
                        const formattedVal = Number(p.value).toFixed(decimals);
                        html += `${p.marker} ${p.seriesName}: <b>${formattedVal}</b><br/>`;
                    }
                });
                return html;
            }
        },
        legend: {
            show: false
        },
        grid: {
            top: 100, // Top axis is gone, so 80 is enough for both daily and hourly
            bottom: isDaily ? 70 : 140, // Increased bottom margin for stacked bottom axes
            left: 55, // Increased from 30 to give room for Y-axis name and ticks
            right: 40, // Increased from 30 to prevent right overflow
            containLabel: true
        },
        xAxis: xAxisOption,
        yAxis: {
            type: "value",
            scale: true, // Enable auto-scaling (stops forcing 0 as minimum)
            axisLabel: {
                color: textColor,
                fontSize: fontSize * 0.8,
                formatter: function (value) {
                    return Number(value).toFixed(decimals);
                }
            },
            axisLine: { lineStyle: { color: gridColor } },
            splitLine: { lineStyle: { color: gridColor } },
            name: yTitle,
            nameLocation: "middle",
            nameGap: 55,
            nameTextStyle: {
                color: textColor,
                fontSize: fontSize * 0.8,
                fontWeight: "bold"
            }
        },
        series: [
            {
                name: activeConfig.title,
                type: "line",
                data: yVals,
                symbol: "circle",
                symbolSize: 8,
                itemStyle: {
                    color: primaryColor,
                    borderColor: bgColor,
                    borderWidth: 2
                },
                lineStyle: {
                    width: 2.5
                },
                markLine: {
                    symbol: ["none", "none"],
                    data: markLineData
                }
            }
        ]
    };

    chart.setOption(option);
}

