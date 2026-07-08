
/**
 * Annual Report Generator Logic
 * Ported from test.R to JavaScript
 */
import { auth, onAuthStateChanged } from "./fb-init.js";
import { updateAuthButton } from "./signin.js";
import { fetchGeoJSON } from "./loader-fetch.js";
import { ESML, showAuthOverlay } from "./utils.js";
import { logUserAction } from "./fb-logging.js";
import { toggleSpinner } from "./loader-ui.js";
import { downloadFile } from "./ui-download.js";

// --- Configuration ---
// --- Report Type Definitions (Shared) ---
const GAM_V2_TYPES = {
    "by_year": [
        { name: "No. of smoke days", method: "count" },
        { name: "No. of smoke days with SMO > 97.5th quantile", method: "count" },
        { name: "No. of smoke days with SMO > 97.5th quantile (EDM)", method: "count" },
        { name: "No. of smoke days with SMO > 97.5th quantile & MDA8 > 70 ppb", method: "count" },
        { name: "No. of smoke days with SMO > 97.5th quantile & MDA8 > 70 ppb (EDM)", method: "count" },
        { name: "Mean SMO (ppb) on smoke days", method: "mean" },
        { name: "Mean SMO (ppb) on smoke days (EDM)", method: "mean" },
        { name: "Mean SMO quantile on smoke days", method: "mean" },
        { name: "Mean SMO quantile on smoke days (EDM)", method: "mean" },
        { name: "Mean residual (ppb) on non-smoke days", method: "mean" },
        { name: "Mean residual (ppb) on non-smoke days (EDM)", method: "mean" },
        { name: "Mean residual quantile on non-smoke days", method: "mean" },
        { name: "Mean residual quantile on non-smoke days (EDM)", method: "mean" },
        { name: "No. of ExcDays", method: "count" },
        { name: "No. of ExcDays (EDM)", method: "count" },
        { name: "No. of ExcDays with significant SMO", method: "count" },
        { name: "No. of ExcDays with significant SMO (EDM)", method: "count" },
        { name: "No. of ExcDays with minimal SMO", method: "count" },
        { name: "No. of ExcDays with minimal SMO (EDM)", method: "count" },
        { name: "No. of observations (Apr-Oct)", method: "category" },
        { name: "4th-highest-MDA8 (ppb)", method: "mean" },
        { name: "4th-highest-MDA8 (ppb) excluding smoke days with SMO > 97.5th quantile", method: "mean" },
        { name: "4th-highest-MDA8 (ppb) excluding smoke days with SMO > 97.5th quantile (EDM)", method: "mean" }
    ],
    "by_date": [
        { name: "Smoke days (1: Yes, 0: No)", method: "count" },
        { name: "Smoke days with SMO > 97.5th quantile (1: Yes, 0: No)", method: "count" },
        { name: "Smoke days with SMO > 97.5th quantile (1: Yes, 0: No) (EDM)", method: "count" },
        { name: "Smoke days with SMO > 97.5th quantile & MDA8 > 70 ppb (1: Yes, 0: No)", method: "count" },
        { name: "Smoke days with SMO > 97.5th quantile & MDA8 > 70 ppb (1: Yes, 0: No) (EDM)", method: "count" },
        { name: "SMO (ppb) on smoke days", method: "mean" },
        { name: "SMO (ppb) on smoke days (EDM)", method: "mean" },
        { name: "SMO quantile on smoke days", method: "mean" },
        { name: "SMO quantile on smoke days (EDM)", method: "mean" },
        { name: "Obs PM2.5 (ug m-3)", method: "mean" },
        { name: "ExcDay (0: None, 1: Days with minimal SMO, 2: Days with significant SMO)", method: "category" },
        { name: "ExcDay (0: None, 1: Days with minimal SMO, 2: Days with significant SMO) (EDM)", method: "category" },
        { name: "Rank of MDA8", method: "category" },
        { name: "Rank of MDA8 excluding smoke days with SMO > 97.5th quantile", method: "category" },
        { name: "Rank of MDA8 excluding smoke days with SMO > 97.5th quantile (EDM)", method: "category" }
    ]
};

const GAM_V1_TYPES = {
    "by_year": [
        { name: "No. of smoke days", method: "count" },
        { name: "No. of smoke days with SMO > 97.5th quantile", method: "count" },
        { name: "No. of smoke days with SMO > 97.5th quantile & MDA8 > 70 ppb", method: "count" },
        { name: "Mean SMO (ppb) on smoke days", method: "mean" },
        { name: "Mean SMO quantile on smoke days", method: "mean" },
        { name: "Mean residual (ppb) on non-smoke days", method: "mean" },
        { name: "Mean residual quantile on non-smoke days", method: "mean" },
        { name: "No. of ExcDays", method: "count" },
        { name: "No. of ExcDays with significant SMO", method: "count" },
        { name: "No. of ExcDays with minimal SMO", method: "count" },
        { name: "No. of observations (May-Sep)", method: "category" },
        { name: "4th-highest-MDA8 (ppb)", method: "mean" },
        { name: "4th-highest-MDA8 (ppb) excluding smoke days with SMO > 97.5th quantile", method: "mean" }
    ],
    "by_date": [
        { name: "Smoke days (1: Yes, 0: No)", method: "count" },
        { name: "Smoke days with SMO > 97.5th quantile (1: Yes, 0: No)", method: "count" },
        { name: "Smoke days with SMO > 97.5th quantile & MDA8 > 70 ppb (1: Yes, 0: No)", method: "count" },
        { name: "SMO (ppb) on smoke days", method: "mean" },
        { name: "SMO quantile on smoke days", method: "mean" },
        { name: "Obs PM2.5 (ug m-3)", method: "mean" },
        { name: "ExcDay (0: None, 1: Days with minimal SMO, 2: Days with significant SMO)", method: "category" },
        { name: "Rank of MDA8", method: "category" },
        { name: "Rank of MDA8 excluding smoke days with SMO > 97.5th quantile", method: "category" }
    ]
};

const PM_CBSA_TYPES = {
    "by_year": [
        { name: "No. of days with overhead HMS", method: "count" },
        { name: "No. of probable smoke days (HMS + PM2.5 > Criteria 1)", method: "count" },
        { name: "No. of highly probable smoke days (HMS + PM2.5 > Criteria 2)", method: "count" },
        { name: "Mean smoke PM2.5 (ug m-3) on probable smoke days (HMS + PM2.5 > Criteria 1)", method: "mean" },
        { name: "Mean smoke PM2.5 (ug m-3) on highly probable smoke days (HMS + PM2.5 > Criteria 2)", method: "mean" },
        { name: "No. of ExcDays (Criteria 1)", method: "count" },
        { name: "No. of ExcDays (Criteria 2)", method: "count" },
        { name: "No. of ExcDays with smoke PM2.5>0 (Criteria 1)", method: "count" },
        { name: "No. of ExcDays with smoke PM2.5>0 (Criteria 2)", method: "count" },
        { name: "No. of ExcDays with smoke PM2.5=0 (Criteria 1)", method: "count" },
        { name: "No. of ExcDays with smoke PM2.5=0 (Criteria 2)", method: "count" }
    ],
    "by_date": [
        { name: "Days with overhead HMS (1: Yes, 0: No)", method: "count" },
        { name: "Probable smoke days (HMS + PM2.5 > Criteria 1) (1: Yes, 0: No)", method: "count" },
        { name: "Highly probable smoke days (HMS + PM2.5 > Criteria 2) (1: Yes, 0: No)", method: "count" },
        { name: "Smoke PM2.5 (ug m-3) on probable smoke days (HMS + PM2.5 > Criteria 1)", method: "mean" },
        { name: "Smoke PM2.5 (ug m-3) on highly probable smoke days (HMS + PM2.5 > Criteria 2)", method: "mean" },
        { name: "ExcDay (Criteria 1) (0: None, 1: Days with smoke PM2.5=0, 2: Days with smoke PM2.5>0)", method: "category" },
        { name: "ExcDay (Criteria 2) (0: None, 1: Days with smoke PM2.5=0, 2: Days with smoke PM2.5>0)", method: "category" }
    ]
};

// --- Configuration ---
const currentYear = new Date().getFullYear();

/**
 * Creates an array of years from start to (currentYear - 1)
 * Useful for 1-year lagged datasets (e.g. 2025 data becomes available in 2026)
 */
function getLaggedYearRange(startYear) {
    const endYear = currentYear - 1;
    const years = [];
    if (endYear < startYear) return [startYear]; // Minimum fallback
    for (let y = startYear; y <= endYear; y++) years.push(y);
    return years;
}

const REPORT_CONFIG = {
    "gam-v2": {
        years: [2019, 2020, 2021, 2022, 2023, 2024],
        sources: { main: "gam_v2" },
        types: GAM_V2_TYPES
    },
    "gam-v1": {
        years: [2018, 2019, 2020, 2021, 2022, 2023],
        sources: { main: "gam_v1" },
        types: GAM_V1_TYPES
    },
    "pm-cbsa": {
        years: [2019, 2020, 2021, 2022, 2023, 2024],
        sources: { main: "pm_cbsa" },
        types: PM_CBSA_TYPES
    },
    "gam-v2-pred": {
        years: [2019, 2020, 2021, 2022, 2023, 2024].concat(getLaggedYearRange(2025)),
        sources: {
            main: "gam_v2_pred",
            historical: "gam_v2",
            splitYear: 2025
        },
        types: GAM_V2_TYPES
    },
    "pm-cbsa-pred": {
        years: [2019, 2020, 2021, 2022, 2023, 2024].concat(getLaggedYearRange(2025)),
        sources: {
            main: "pm_cbsa_pred",
            historical: "pm_cbsa",
            splitYear: 2025
        },
        types: PM_CBSA_TYPES
    }
};

// --- State ---
let stateDataCache = {};
let reportResults = null; // Store for CSV export
let currentPage = 1;
const ROWS_PER_PAGE = 20;

// --- UI Helpers ---

/**
 * Update the Report Type dropdown based on Dataset and Period
 */
function updateReportTypes() {
    const dataset = document.getElementById("DatadbReportTableDataset").value;
    const period = document.querySelector('input[name="DatadbReportTablePeriod"]:checked').value;
    const typeSelect = document.getElementById("DatadbReportTableType");

    if (!REPORT_CONFIG[dataset]) return;

    const types = REPORT_CONFIG[dataset].types[period];
    const prevVal = typeSelect.value;

    typeSelect.innerHTML = '<option value="">Select Report Type</option>';
    types.forEach(type => {
        const opt = document.createElement("option");
        opt.value = type.name;
        opt.textContent = type.name;
        if (type.name === prevVal) opt.selected = true;
        typeSelect.appendChild(opt);
    });
}

/**
 * Update the Year Checkboxes based on Dataset
 */
function updateYears() {
    const dataset = document.getElementById("DatadbReportTableDataset").value;
    const container = document.getElementById("DatadbReportTableYearCheckboxes");

    if (!REPORT_CONFIG[dataset]) return;

    const years = REPORT_CONFIG[dataset].years;

    // --- Dynamic Date Update for "By Date" Section ---
    const maxYear = Math.max(...years);
    const dateStartInput = document.getElementById("DatadbReportTableDateStart");
    const dateEndInput = document.getElementById("DatadbReportTableDateEnd");
    if (dateStartInput && dateEndInput && maxYear > 0) {
        dateStartInput.value = `${maxYear}-05-01`;
        dateEndInput.value = `${maxYear}-09-30`;
    }

    container.innerHTML = "";
    years.forEach(yr => {
        const label = document.createElement("label");
        label.innerHTML = `<input type="checkbox" name="ReportYear" value="${yr}" checked> ${yr}`;
        container.appendChild(label);
    });
}

/**
 * Cascading dropdown for States (reuse logic from query builder)
 */
// Prediction datasets reuse the same AQS list as their published counterparts
const AQS_LIST_MAP = {
    "gam-v2-pred": "gam_v2",
    "pm-cbsa-pred": "pm_cbsa"
};

async function updateStates() {
    const datasetId = document.getElementById("DatadbReportTableDataset").value;
    const stateSelect = document.getElementById("DatadbReportTableState");
    const fileSuffix = AQS_LIST_MAP[datasetId] || datasetId.replace(/-/g, "_");
    const url = `/aqs_list_${fileSuffix}.geojson.gz`;
    const data = await fetchGeoJSON(url, null);
    if (!data) return;

    // Handle both GeoJSON FeatureCollection and plain array of objects
    const items = data.features ? data.features.map(f => f.properties) : data;
    const states = [...new Set(items.map(item => item.state))].sort();
    const currentState = stateSelect.value;

    stateSelect.innerHTML = '<option value="">Select State</option>';
    states.forEach(state => {
        const option = document.createElement("option");
        option.value = state;
        option.textContent = state;
        if (state === currentState) option.selected = true;
        stateSelect.appendChild(option);
    });
}

/**
 * Handle period radio change
 */
function handlePeriodChange() {
    const period = document.querySelector('input[name="DatadbReportTablePeriod"]:checked').value;
    const yearPicker = document.getElementById("DatadbReportTableYearPicker");
    const datePicker = document.getElementById("DatadbReportTableDatePicker");

    if (period === "by_year") {
        yearPicker.style.display = "block";
        datePicker.style.display = "none";
    } else {
        yearPicker.style.display = "none";
        datePicker.style.display = "block";
    }
    updateReportTypes();
}

// --- Data Processing ---

/**
 * Pivots flat data into a report format: Site as row, Time as columns
 */
function pivotData(data, timeKey, valueKey) {
    const sites = {}; // { site_key: { AQS: string, site_name: string, [time]: value } }
    const timePoints = new Set();

    data.forEach(d => {
        const siteKey = d.AQS || d.AQS_O3 || d.AQS_PM || "Unknown";
        const siteName = d.site_name || "Unknown";

        if (!sites[siteKey]) {
            sites[siteKey] = {
                AQS: siteKey,
                site_name: siteName,
                lon: d.lon !== undefined ? d.lon : "NA",
                lat: d.lat !== undefined ? d.lat : "NA"
            };
        }

        sites[siteKey][d[timeKey]] = d[valueKey];
        timePoints.add(d[timeKey]);
    });

    const sortedTimes = Array.from(timePoints).sort();
    const result = Object.values(sites).sort((a, b) => a.AQS.localeCompare(b.AQS, undefined, { numeric: true }));

    return { data: result, columns: sortedTimes };
}

/**
 * Fetch and Cache State Data (year-split structure)
 * Path: /data_by_state/{dataset}/{year}/data_by_state_{State}.geojson.gz
 */
async function loadStateData(datasetId, state, config, years) {
    const cacheKey = `${datasetId}_${state}_${years.join(",")}`;
    if (stateDataCache[cacheKey]) return stateDataCache[cacheKey];

    const safeState = state.replace(/ /g, "_");
    const { main, historical, splitYear } = config.sources;

    const fetches = years.map(yr => {
        const sourceDir = (historical && splitYear && yr < splitYear) ? historical : main;
        return fetchGeoJSON(`/data_by_state/${sourceDir}/${yr}/data_by_state_${safeState}.geojson.gz`)
            .catch(() => null);
    });
    const results = await Promise.all(fetches);

    let flatData = [];
    for (const geoData of results) {
        if (!geoData || !geoData.features) continue;
        for (const f of geoData.features) {
            const p = { ...f.properties };
            if (f.geometry && f.geometry.coordinates) {
                p.lon = f.geometry.coordinates[0];
                p.lat = f.geometry.coordinates[1];
            }
            flatData.push(p);
        }
    }

    if (flatData.length === 0) return null;

    stateDataCache[cacheKey] = flatData;
    return flatData;
}

/**
 * Core Logic: Generate Report
 */
async function generateReport() {

    if (!auth.currentUser) {
        showAuthOverlay();
        return;
    }
    
    const datasetId = document.getElementById("DatadbReportTableDataset").value;
    const state = document.getElementById("DatadbReportTableState").value;
    const period = document.querySelector('input[name="DatadbReportTablePeriod"]:checked').value;
    const reportType = document.getElementById("DatadbReportTableType").value;

    if (!state || !reportType) {
        alert("Please select both a State and a Report Type.");
        return;
    }

    const btn = document.getElementById("DatadbReportTableBtnGenerate");
    const originalText = btn.textContent;
    btn.textContent = "Processing...";
    btn.disabled = true;
    toggleSpinner(true, "Loading state report data...", true);

    try {
        const config = REPORT_CONFIG[datasetId];

        // Determine which years to fetch based on period selection
        let selectedYears;
        if (period === "by_year") {
            selectedYears = Array.from(document.querySelectorAll('input[name="ReportYear"]:checked')).map(cb => parseInt(cb.value));
        } else {
            const start = document.getElementById("DatadbReportTableDateStart").value;
            const end = document.getElementById("DatadbReportTableDateEnd").value;
            const startYr = start ? parseInt(start.substring(0, 4)) : Math.min(...config.years);
            const endYr = end ? parseInt(end.substring(0, 4)) : Math.max(...config.years);
            selectedYears = config.years.filter(yr => yr >= startYr && yr <= endYr);
        }

        if (selectedYears.length === 0) {
            alert("Please select at least one year.");
            return;
        }

        let flatData = await loadStateData(datasetId, state, config, selectedYears);

        if (!flatData) {
            alert("No data found for the selected state.");
            return;
        }

        let filteredData = [...flatData];

        // Filter by date range (by_date mode only — year filtering already handled by fetch)
        if (period === "by_date") {
            const start = document.getElementById("DatadbReportTableDateStart").value;
            const end = document.getElementById("DatadbReportTableDateEnd").value;
            if (start) filteredData = filteredData.filter(d => d.date >= start);
            if (end) filteredData = filteredData.filter(d => d.date <= end);
        }

        // 4. Calculate Values based on Report Type
        const timeKey = period === "by_year" ? "YEAR" : "date";
        const typeConfig = config.types[period].find(t => t.name === reportType);
        const method = typeConfig ? typeConfig.method : "count";
        const result = calculateReportValues(filteredData, datasetId, reportType, timeKey, method);

        // 5. Store and Render
        reportResults = result;
        currentPage = 1;
        renderDatadbReportTable();
          
        // [Report to Brain]
        logUserAction("view", {
            dataset: datasetId,
            state: state,
            report_type: reportType
        });
        
        // Update Title with Truncated Report Type
        const titleEl = document.getElementById("DatadbReportTableTitle");
        if (titleEl) {
            titleEl.textContent = `[${datasetId}] [${state}] [${reportType}]`;
        }
        
        document.getElementById("DatadbReportTableWrapper").style.display = "block";

    } catch (err) {
        console.error("Report generation failed:", err);
        alert("An error occurred while generating the report.");
    } finally {
        toggleSpinner(false);
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

/**
 * Logic to calculate metrics (Mirrors R switch case)
 */
function calculateReportValues(data, datasetId, reportType, timeKey, method) {
    const siteKey = datasetId.startsWith("pm-cbsa") ? "AQS_PM" : "AQS_O3";
    const isEdmReport = reportType.endsWith("(EDM)");
    const baseReportType = isEdmReport ? reportType.replace(" (EDM)", "") : reportType;

    // Grouping by Site & Time
    const grouped = {};

    data.forEach(d => {
        const gKey = `${d[siteKey]}_${d[timeKey]}`;
        if (!grouped[gKey]) {
            grouped[gKey] = {
                count: 0,
                sum: 0,
                site_name: d.site_name,
                lon: d.lon,
                lat: d.lat,
                [siteKey]: d[siteKey],
                [timeKey]: d[timeKey]
            };
        }

        let val = 0;
        let isMatch = false;

        // Implementation of R conditions
        if (datasetId.startsWith("gam")) {
            switch (baseReportType) {
                case "No. of smoke days":
                case "Smoke days (1: Yes, 0: No)":
                    isMatch = (d.smoke === 1);
                    break;
                case "No. of smoke days with SMO > 97.5th quantile":
                case "Smoke days with SMO > 97.5th quantile (1: Yes, 0: No)":
                    if (isEdmReport) {
                        isMatch = (d.smoke === 1 && d.edm_MDA8O3_resids > d.edm_p975);
                    } else {
                        isMatch = (d.smoke === 1 && d.MDA8O3_resids > d.p975);
                    }
                    break;
                case "No. of smoke days with SMO > 97.5th quantile & MDA8 > 70 ppb":
                case "Smoke days with SMO > 97.5th quantile & MDA8 > 70 ppb (1: Yes, 0: No)":
                    if (isEdmReport) {
                        isMatch = (d.smoke === 1 && d.edm_MDA8O3_resids > d.edm_p975 && d.MDA8O3 > 70);
                    } else {
                        isMatch = (d.smoke === 1 && d.MDA8O3_resids > d.p975 && d.MDA8O3 > 70);
                    }
                    break;
                case "Mean SMO (ppb) on smoke days":
                case "SMO (ppb) on smoke days":
                    if (d.smoke === 1) {
                        isMatch = true;
                        val = isEdmReport ? d.edm_MDA8O3_resids : d.MDA8O3_resids;
                    }
                    break;
                case "Mean residual (ppb) on non-smoke days":
                    if (d.smoke === 0) {
                        isMatch = true;
                        val = isEdmReport ? d.edm_MDA8O3_resids : d.MDA8O3_resids;
                    }
                    break;
                case "Mean SMO quantile on smoke days":
                case "SMO quantile on smoke days":
                    if (d.smoke === 1) {
                        isMatch = true;
                        val = isEdmReport ? d.edm_Quant_MDA8O3_resids : d.Quant_MDA8O3_resids;
                    }
                    break;
                case "Mean residual quantile on non-smoke days":
                    if (d.smoke === 0) {
                        isMatch = true;
                        val = isEdmReport ? d.edm_Quant_MDA8O3_resids : d.Quant_MDA8O3_resids;
                    }
                    break;
                case "Obs PM2.5 (ug m-3)":
                    isMatch = true;
                    val = d["PM2.5"];
                    break;
                case "No. of ExcDays":
                    const excVal1 = isEdmReport ? d.edm_exceedance : d.exceedance;
                    isMatch = (excVal1 !== null && excVal1 >= 1);
                    break;
                case "No. of ExcDays with significant SMO":
                    const excVal2 = isEdmReport ? d.edm_exceedance : d.exceedance;
                    isMatch = (excVal2 !== null && excVal2 === 2);
                    break;
                case "No. of ExcDays with minimal SMO":
                    const excVal3 = isEdmReport ? d.edm_exceedance : d.exceedance;
                    isMatch = (excVal3 !== null && excVal3 === 1);
                    break;
                case "ExcDay (0: None, 1: Days with minimal SMO, 2: Days with significant SMO)":
                    isMatch = true;
                    val = isEdmReport ? d.edm_exceedance : d.exceedance;
                    if (val === null || val === undefined) isMatch = false;
                    break;
                case "No. of observations (May-Sep)":
                case "No. of observations (Apr-Oct)":
                    if (d.n_obs_by_year !== undefined && d.n_obs_by_year !== null && d.n_obs_by_year !== "NA") {
                        isMatch = true;
                        val = d.n_obs_by_year;
                    }
                    break;
                case "4th-highest-MDA8 (ppb)":
                    if (d.fourth_MDA8O3 !== undefined && d.fourth_MDA8O3 !== null && d.fourth_MDA8O3 !== "NA") {
                        isMatch = true;
                        val = d.fourth_MDA8O3;
                    }
                    break;
                case "4th-highest-MDA8 (ppb) excluding smoke days with SMO > 97.5th quantile":
                    {
                        const fldName = isEdmReport ? "edm_fourth_MDA8O3_wo_smoke_p975" : "fourth_MDA8O3_wo_smoke_p975";
                        const fVal = d[fldName];
                        if (fVal !== undefined && fVal !== null && fVal !== "NA") {
                            isMatch = true;
                            val = fVal;
                        }
                    }
                    break;
                case "Rank of MDA8":
                    if (d.rank_MDA8O3 !== undefined && d.rank_MDA8O3 !== null && d.rank_MDA8O3 !== "NA") {
                        isMatch = true;
                        val = d.rank_MDA8O3;
                    }
                    break;
                case "Rank of MDA8 excluding smoke days with SMO > 97.5th quantile":
                    {
                        const fldName = isEdmReport ? "edm_rank_MDA8O3_wo_smoke_p975" : "rank_MDA8O3_wo_smoke_p975";
                        const rVal = d[fldName];
                        if (rVal !== undefined && rVal !== null && rVal !== "NA") {
                            isMatch = true;
                            val = rVal;
                        }
                    }
                    break;
            }
        } else if (datasetId.startsWith("pm-cbsa")) {
            const del_0p5 = d.smoke_m0p5m === 1 ? d["PM2.5"] - d["PM2.5_Crit_m0p5m"] : 0;
            const del_1p0 = d.smoke_m1p0m === 1 ? d["PM2.5"] - d["PM2.5_Crit_m1p0m"] : 0;

            switch (baseReportType) {
                case "No. of days with overhead HMS":
                case "Days with overhead HMS (1: Yes, 0: No)":
                    isMatch = (d.HMS === 1);
                    break;
                case "No. of probable smoke days (HMS + PM2.5 > Criteria 1)":
                case "Probable smoke days (HMS + PM2.5 > Criteria 1) (1: Yes, 0: No)":
                    isMatch = (d.smoke_m0p5m === 1);
                    break;
                case "No. of highly probable smoke days (HMS + PM2.5 > Criteria 2)":
                case "Highly probable smoke days (HMS + PM2.5 > Criteria 2) (1: Yes, 0: No)":
                    isMatch = (d.smoke_m1p0m === 1);
                    break;
                case "Mean smoke PM2.5 (ug m-3) on probable smoke days (HMS + PM2.5 > Criteria 1)":
                case "Smoke PM2.5 (ug m-3) on probable smoke days (HMS + PM2.5 > Criteria 1)":
                    if (d.smoke_m0p5m === 1) { isMatch = true; val = del_0p5; }
                    break;
                case "Mean smoke PM2.5 (ug m-3) on highly probable smoke days (HMS + PM2.5 > Criteria 2)":
                case "Smoke PM2.5 (ug m-3) on highly probable smoke days (HMS + PM2.5 > Criteria 2)":
                    if (d.smoke_m1p0m === 1) { isMatch = true; val = del_1p0; }
                    break;
                case "No. of ExcDays (Criteria 1)":
                    isMatch = (d.exceedance_m0p5m !== null && d.exceedance_m0p5m >= 1);
                    break;
                case "No. of ExcDays (Criteria 2)":
                    isMatch = (d.exceedance_m1p0m !== null && d.exceedance_m1p0m >= 1);
                    break;
                case "No. of ExcDays with smoke PM2.5>0 (Criteria 1)":
                    isMatch = (d.exceedance_m0p5m !== null && d.exceedance_m0p5m === 2);
                    break;
                case "No. of ExcDays with smoke PM2.5>0 (Criteria 2)":
                    isMatch = (d.exceedance_m1p0m !== null && d.exceedance_m1p0m === 2);
                    break;
                case "No. of ExcDays with smoke PM2.5=0 (Criteria 1)":
                    isMatch = (d.exceedance_m0p5m !== null && d.exceedance_m0p5m === 1);
                    break;
                case "No. of ExcDays with smoke PM2.5=0 (Criteria 2)":
                    isMatch = (d.exceedance_m1p0m !== null && d.exceedance_m1p0m === 1);
                    break;
                case "ExcDay (Criteria 1) (0: None, 1: Days with smoke PM2.5=0, 2: Days with smoke PM2.5>0)":
                    isMatch = true;
                    val = d.exceedance_m0p5m;
                    if (val === null || val === undefined) isMatch = false;
                    break;
                case "ExcDay (Criteria 2) (0: None, 1: Days with smoke PM2.5=0, 2: Days with smoke PM2.5>0)":
                    isMatch = true;
                    val = d.exceedance_m1p0m;
                    if (val === null || val === undefined) isMatch = false;
                    break;
            }
        }

        if (isMatch) {
            grouped[gKey].count++;
            grouped[gKey].sum += val;
        }
    });

    // Finalize Aggregation
    const aggregated = Object.values(grouped).map(g => {
        let finalVal = "NA";
        if (method === "mean") {
            finalVal = g.count > 0 ? (g.sum / g.count).toFixed(1) : "NA";
        } else if (method === "category") {
            finalVal = g.count > 0 ? Math.round(g.sum / g.count) : "NA";
        } else {
            finalVal = g.count;
        }
        return {
            [siteKey]: g[siteKey],
            [timeKey]: g[timeKey],
            site_name: g.site_name,
            lon: g.lon,
            lat: g.lat,
            result: finalVal
        };
    });

    return pivotData(aggregated, timeKey, "result");
}


/**
 * Render Results Table
 */
function renderDatadbReportTable() {
    const head = document.getElementById("DatadbReportTableHead");
    const body = document.getElementById("DatadbReportTableBody");
    const info = document.getElementById("DatadbReportTablePageInfo");
    const pagination = document.getElementById("DatadbReportTablePagination");

    if (!head || !body || !reportResults) return;

    // Header: AQS, Site Name, [Time Columns]
    const baseCols = ["AQS", "site_name", "lon", "lat"];
    const allCols = baseCols.concat(reportResults.columns);
    head.innerHTML = allCols.map(c => `<th>${c}</th>`).join("");

    // Rows
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    const end = start + ROWS_PER_PAGE;
    const pageData = reportResults.data.slice(start, end);

    body.innerHTML = pageData.map(row => {
        return `<tr>${allCols.map(c => {
            const val = row[c];
            const displayVal = (val !== undefined && val !== null) ? val : "NA";
            return `<td>${ESML(displayVal)}</td>`;
        }).join("")}</tr>`;
    }).join("");
    
    // Trigger feedback animation
    body.classList.remove("datadb-table-refreshing");
    void body.offsetWidth; // Force reflow to restart animation
    body.classList.add("datadb-table-refreshing");
    
    // Pagination
    const totalPages = Math.ceil(reportResults.data.length / ROWS_PER_PAGE);
    info.textContent = `Page ${currentPage} of ${totalPages} (${reportResults.data.length} sites)`;
    pagination.style.display = totalPages > 1 ? "flex" : "none";

    document.getElementById("DatadbReportTableBtnPrev").disabled = (currentPage === 1);
    document.getElementById("DatadbReportTableBtnNext").disabled = (currentPage === totalPages);
}

function changeReportPage(delta) {
    currentPage += delta;
    renderDatadbReportTable();
}

/**
 * Export CSV
 */
function downloadReportCSV() {
    
    if (!auth.currentUser) {
        showAuthOverlay();
        return;
    }
    
    if (!reportResults) return;

    const datasetId = document.getElementById("DatadbReportTableDataset").value;
    const state = document.getElementById("DatadbReportTableState").value;
    const reportType = document.getElementById("DatadbReportTableType").value;

    const safeSource = datasetId.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const safeState = state.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const safeType = reportType.replace(/[^a-z0-9]/gi, "_").toLowerCase();

    const baseCols = ["AQS", "site_name", "lon", "lat"];
    const allCols = baseCols.concat(reportResults.columns);

    const csvContent = [
        allCols.join(","),
        ...reportResults.data.map(row => allCols.map(c => {
            const val = row[c];
            const displayVal = (val !== undefined && val !== null) ? val : "NA";
            return `"${displayVal}"`;
        }).join(","))
    ].join("\n");

    const fileName = `state_report_${safeSource}_${safeState}_${safeType}.csv`;
    downloadFile(fileName, csvContent);
    
    // [Report to Brain]
    logUserAction("download", {
        dataset: datasetId,
        state: state,
        report_type: reportType,
        filename: fileName
    });
}

/**
 * Export All Report Types in a single CSV (Stacked)
 */
async function downloadAllReportsCSV() {
    
    if (!auth.currentUser) {
        showAuthOverlay();
        return;
    }

    const datasetId = document.getElementById("DatadbReportTableDataset").value;
    const state = document.getElementById("DatadbReportTableState").value;
    const period = document.querySelector('input[name="DatadbReportTablePeriod"]:checked').value;

    if (!state) {
        alert("Please select a State.");
        return;
    }

    const config = REPORT_CONFIG[datasetId];
    if (!config) return;

    const btn = document.getElementById("DatadbReportTableBtnDownloadAll");
    const originalText = btn.textContent;
    btn.textContent = "Preparing...";
    btn.disabled = true;
    toggleSpinner(true, "Preparing all types of reports...", true);

    try {
        // Determine which years to fetch
        let selectedYears;
        if (period === "by_year") {
            selectedYears = Array.from(document.querySelectorAll('input[name="ReportYear"]:checked')).map(cb => parseInt(cb.value));
        } else {
            const start = document.getElementById("DatadbReportTableDateStart").value;
            const end = document.getElementById("DatadbReportTableDateEnd").value;
            const startYr = start ? parseInt(start.substring(0, 4)) : Math.min(...config.years);
            const endYr = end ? parseInt(end.substring(0, 4)) : Math.max(...config.years);
            selectedYears = config.years.filter(yr => yr >= startYr && yr <= endYr);
        }

        if (selectedYears.length === 0) {
            alert("Please select at least one year.");
            return;
        }

        let flatData = await loadStateData(datasetId, state, config, selectedYears);
        if (!flatData) {
            alert("No data found for the selected state.");
            return;
        }

        let filteredData = [...flatData];
        if (period === "by_date") {
            const start = document.getElementById("DatadbReportTableDateStart").value;
            const end = document.getElementById("DatadbReportTableDateEnd").value;
            if (start) filteredData = filteredData.filter(d => d.date >= start);
            if (end) filteredData = filteredData.filter(d => d.date <= end);
        }

        const timeKey = period === "by_year" ? "YEAR" : "date";
        const allTypes = config.types[period];
        let allResultRows = [];
        let allTimeColumns = new Set();

        // Generate each report type and stack them
        for (const type of allTypes) {
            const result = calculateReportValues(filteredData, datasetId, type.name, timeKey, type.method);
            
            result.columns.forEach(c => allTimeColumns.add(c));
            
            const rows = result.data.map(row => {
                return {
                    report_type: type.name,
                    ...row
                };
            });
            allResultRows = allResultRows.concat(rows);
        }

        const sortedTimes = Array.from(allTimeColumns).sort();
        const baseCols = ["report_type", "AQS", "site_name", "lon", "lat"];
        const allCols = baseCols.concat(sortedTimes);

        // CSV Construction
        const csvContent = [
            allCols.join(","),
            ...allResultRows.map(row => allCols.map(c => {
                const val = row[c];
                const displayVal = (val !== undefined && val !== null) ? val : "NA";
                return `"${displayVal}"`;
            }).join(","))
        ].join("\n");

        const safeSource = datasetId.replace(/[^a-z0-9]/gi, "_").toLowerCase();
        const safeState = state.replace(/[^a-z0-9]/gi, "_").toLowerCase();
        const fileName = `state_report_all_${safeSource}_${safeState}_${period}.csv`;
        downloadFile(fileName, csvContent);

        logUserAction("download", {
            dataset: datasetId,
            state: state,
            period: period,
            filename: fileName
        });

    } catch (err) {
        console.error("Batch report generation failed:", err);
        alert("An error occurred while generating all reports.");
    } finally {
        toggleSpinner(false);
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// --- Initialization ---
function initReport() {
    const dsSelect = document.getElementById("DatadbReportTableDataset");
    const periodRadios = document.querySelectorAll('input[name="DatadbReportTablePeriod"]');

    if (dsSelect) {
        dsSelect.addEventListener("change", () => {
            updateStates();
            updateYears();
            updateReportTypes();
        });
        updateStates();
        updateYears();
        updateReportTypes();
    }

    periodRadios.forEach(r => r.addEventListener("change", handlePeriodChange));
    
    // Button Event Listeners
    const btnGenerate = document.getElementById("DatadbReportTableBtnGenerate");
    if (btnGenerate) btnGenerate.addEventListener("click", generateReport);

    const btnDownload = document.getElementById("DatadbReportTableBtnDownload");
    if (btnDownload) btnDownload.addEventListener("click", downloadReportCSV);
    
    const btnDownloadAll = document.getElementById("DatadbReportTableBtnDownloadAll");
    if (btnDownloadAll) btnDownloadAll.addEventListener("click", downloadAllReportsCSV);
    
    const btnPrev = document.getElementById("DatadbReportTableBtnPrev");
    if (btnPrev) btnPrev.addEventListener("click", () => changeReportPage(-1));

    const btnNext = document.getElementById("DatadbReportTableBtnNext");
    if (btnNext) btnNext.addEventListener("click", () => changeReportPage(1));
    
    onAuthStateChanged(auth, (user) => {
        updateAuthButton("DatadbReportTableBtnGenerate", user, "Generate Report");
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initReport);
} else {
    initReport();
}

