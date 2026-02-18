
/**
 * Annual Report Generator Logic
 * Ported from test.R to JavaScript
 */

import { fetchGeoJSON } from "./loader-fetch.js";
import { auth, onAuthStateChanged } from "./fb-init.js";
import { fetchJson, ESML, showAuthOverlay } from "./utils.js";
import { updateAuthButton } from "./signin.js";

// --- Configuration ---
const REPORT_CONFIG = {
    "gam-v2": {
        years: [2019, 2020, 2021, 2022, 2023, 2024],
        sources: {
            main: "gam_v2"
        },
        types: {
            "by_year": [
                { name: "No. of smoke days", method: "count" },
                { name: "No. of smoke days with MDA8 residual > 97.5th quantile", method: "count" },
                { name: "No. of smoke days with MDA8 residual > 97.5th quantile (EDM)", method: "count" },
                { name: "No. of smoke days with MDA8 residual > 97.5th quantile & MDA8 > 70 ppb", method: "count" },
                { name: "No. of smoke days with MDA8 residual > 97.5th quantile & MDA8 > 70 ppb (EDM)", method: "count" },
                { name: "Mean residual (ppb) on smoke days", method: "mean" },
                { name: "Mean residual (ppb) on smoke days (EDM)", method: "mean" },
                { name: "Mean residual (ppb) on non-smoke days", method: "mean" },
                { name: "Mean residual (ppb) on non-smoke days (EDM)", method: "mean" },
                { name: "Mean residual quantile on smoke days", method: "mean" },
                { name: "Mean residual quantile on smoke days (EDM)", method: "mean" },
                { name: "Mean residual quantile on non-smoke days", method: "mean" },
                { name: "Mean residual quantile on non-smoke days (EDM)", method: "mean" }
            ],
            "by_date": [
                { name: "Smoke days (1: Yes, 0: No)", method: "count" },
                { name: "Smoke days with MDA8 residual > 97.5th quantile (1: Yes, 0: No)", method: "count" },
                { name: "Smoke days with MDA8 residual > 97.5th quantile (1: Yes, 0: No) (EDM)", method: "count" },
                { name: "Smoke days with MDA8 residual > 97.5th quantile & MDA8 > 70 ppb (1: Yes, 0: No)", method: "count" },
                { name: "Smoke days with MDA8 residual > 97.5th quantile & MDA8 > 70 ppb (1: Yes, 0: No) (EDM)", method: "count" },
                { name: "Residual (ppb) on smoke days", method: "mean" },
                { name: "Residual (ppb) on smoke days (EDM)", method: "mean" },
                { name: "Residual quantile on smoke days", method: "mean" },
                { name: "Residual quantile on smoke days (EDM)", method: "mean" },
                { name: "Ob PM2.5 (ug m-3)", method: "mean" }
            ]
        }
    },
    "gam-v1": {
        years: [2018, 2019, 2020, 2021, 2022, 2023],
        sources: {
            main: "gam_v1"
        },
        types: {
            "by_year": [
                { name: "No. of smoke days", method: "count" },
                { name: "No. of smoke days with MDA8 residual > 97.5th quantile", method: "count" },
                { name: "No. of smoke days with MDA8 residual > 97.5th quantile & MDA8 > 70 ppb", method: "count" },
                { name: "Mean residual (ppb) on smoke days", method: "mean" },
                { name: "Mean residual (ppb) on non-smoke days", method: "mean" },
                { name: "Mean residual quantile on smoke days", method: "mean" },
                { name: "Mean residual quantile on non-smoke days", method: "mean" }
            ],
            "by_date": [
                { name: "Smoke days (1: Yes, 0: No)", method: "count" },
                { name: "Smoke days with MDA8 residual > 97.5th quantile (1: Yes, 0: No)", method: "count" },
                { name: "Smoke days with MDA8 residual > 97.5th quantile & MDA8 > 70 ppb (1: Yes, 0: No)", method: "count" },
                { name: "Residual (ppb) on smoke days", method: "mean" },
                { name: "Residual quantile on smoke days", method: "mean" },
                { name: "Ob PM2.5 (ug m-3)", method: "mean" }
            ]
        }
    },
    "pm-cbsa": {
        years: [2019, 2020, 2021, 2022, 2023, 2024],
        sources: {
            main: "pm_cbsa"
        },
        types: {
            "by_year": [
                { name: "No. of days with overhead HMS", method: "count" },
                { name: "No. of probable smoke days (HMS + PM2.5 > Criteria 1)", method: "count" },
                { name: "No. of highly probable smoke days (HMS + PM2.5 > Criteria 2)", method: "count" },
                { name: "Mean smoke PM2.5 (ug m-3) on probable smoke days (HMS + PM2.5 > Criteria 1)", method: "mean" },
                { name: "Mean smoke PM2.5 (ug m-3) on highly probable smoke days (HMS + PM2.5 > Criteria 2)", method: "mean" }
            ],
            "by_date": [
                { name: "Days with overhead HMS (1: Yes, 0: No)", method: "count" },
                { name: "Probable smoke days (HMS + PM2.5 > Criteria 1) (1: Yes, 0: No)", method: "count" },
                { name: "Highly probable smoke days (HMS + PM2.5 > Criteria 2) (1: Yes, 0: No)", method: "count" },
                { name: "Smoke PM2.5 (ug m-3) on probable smoke days (HMS + PM2.5 > Criteria 1)", method: "mean" },
                { name: "Smoke PM2.5 (ug m-3) on highly probable smoke days (HMS + PM2.5 > Criteria 2)", method: "mean" }
            ]
        }
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
async function updateStates() {
    const datasetId = document.getElementById("DatadbReportTableDataset").value;
    const stateSelect = document.getElementById("DatadbReportTableState");
    const fileSuffix = datasetId.replace(/-/g, "_");
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
 * Fetch and Cache State Data
 */
async function loadStateData(datasetId, state, config) {
    const cacheKey = `${datasetId}_${state}`;
    if (stateDataCache[cacheKey]) return stateDataCache[cacheKey];

    // Sanitize state name for URL: replace spaces with underscores
    const safeState = state.replace(/ /g, "_");
    const { main } = config.sources;
    const stateUrl = `/data_by_state/${main}/data_by_state_${safeState}.geojson.gz`;
    const geoData = await fetchGeoJSON(stateUrl);

    if (!geoData || !geoData.features) return null;

    let flatData = geoData.features.map(f => {
        const p = { ...f.properties };
        if (f.geometry && f.geometry.coordinates) {
            p.lon = f.geometry.coordinates[0];
            p.lat = f.geometry.coordinates[1];
        }
        return p;
    });

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

    try {
        const config = REPORT_CONFIG[datasetId];
        let flatData = await loadStateData(datasetId, state, config);

        if (!flatData) {
            alert("No data found for the selected state.");
            return;
        }

        let filteredData = [...flatData];

        // 3. Filter by Time
        if (period === "by_year") {
            const selectedYears = Array.from(document.querySelectorAll('input[name="ReportYear"]:checked')).map(cb => parseInt(cb.value));
            filteredData = filteredData.filter(d => selectedYears.includes(d.YEAR));
        } else {
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
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

/**
 * Logic to calculate metrics (Mirrors R switch case)
 */
function calculateReportValues(data, datasetId, reportType, timeKey, method) {
    const siteKey = datasetId === "pm-cbsa" ? "AQS_PM" : "AQS_O3";
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
                case "No. of smoke days with MDA8 residual > 97.5th quantile":
                case "Smoke days with MDA8 residual > 97.5th quantile (1: Yes, 0: No)":
                    if (isEdmReport) {
                        isMatch = (d.smoke === 1 && d.edm_MDA8O3_resids > d.edm_p975);
                    } else {
                        isMatch = (d.smoke === 1 && d.MDA8O3_resids > d.p975);
                    }
                    break;
                case "No. of smoke days with MDA8 residual > 97.5th quantile & MDA8 > 70 ppb":
                case "Smoke days with MDA8 residual > 97.5th quantile & MDA8 > 70 ppb (1: Yes, 0: No)":
                    if (isEdmReport) {
                        isMatch = (d.smoke === 1 && d.edm_MDA8O3_resids > d.edm_p975 && d.MDA8O3 > 70);
                    } else {
                        isMatch = (d.smoke === 1 && d.MDA8O3_resids > d.p975 && d.MDA8O3 > 70);
                    }
                    break;
                case "Mean residual (ppb) on smoke days":
                case "Residual (ppb) on smoke days":
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
                case "Mean residual quantile on smoke days":
                case "Residual quantile on smoke days":
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
                case "Ob PM2.5 (ug m-3)":
                    isMatch = true;
                    val = d["PM2.5"];
                    break;
            }
        } else if (datasetId === "pm-cbsa") {
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

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    const datasetId = document.getElementById("DatadbReportTableDataset").value;
    const state = document.getElementById("DatadbReportTableState").value;
    const reportType = document.getElementById("DatadbReportTableType").value;
    const sourceMain = REPORT_CONFIG[datasetId]?.sources.main || datasetId;
    const safeState = state.replace(/ /g, "_");
    const safeSource = sourceMain.replace(/ /g, "_");
    const safeType = reportType.replace(/ /g, "_").replace(/\./g, "");
    const fileName = `state_report_${safeSource}_${safeState}_${safeType}.csv`;

    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

    const btnPrev = document.getElementById("DatadbReportTableBtnPrev");
    if (btnPrev) btnPrev.addEventListener("click", () => changeReportPage(-1));

    const btnNext = document.getElementById("DatadbReportTableBtnNext");
    if (btnNext) btnNext.addEventListener("click", () => changeReportPage(1));
    
    onAuthStateChanged(auth, (user) => {
        updateAuthButton("DatadbReportTableBtnGenerate", user, "Generate Report");
        updateAuthButton("DatadbReportTableBtnDownload", user, "Download CSV");
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initReport);
} else {
    initReport();
}

