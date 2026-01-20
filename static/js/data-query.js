
/**
 * Data Page Query Builder Logic
 * Handles cascading dropdowns and data table display
 */

import { fetchGeoJSON } from "./loader-fetch.js";
import { auth, onAuthStateChanged } from "./fb-init.js";
import { showAuthOverlay } from "./utils.js";

let datasetCache = {};
let currentTableData = null; // Store for CSV download
let currentTableKeys = [];  // Store sorted keys for CSV download
let currentDatasetId = "";  // Track for filename
let currentAqs = "";        // Track for filename

// Pagination State
let currentPage = 1;
const ROWS_PER_PAGE = 30;
let totalPages = 1;
let currentFeatures = [];


const QUERY_IMPORT_CONFIG = {
    "gam-v2": {
        source: "gam_v2",
        prefix: "data_by_aqs_",
        baseUrl: "/data_by_aqs",
        extension: ".geojson.gz"
    },
    "gam-v1": {
        source: "gam_v1",
        prefix: "data_by_aqs_",
        baseUrl: "/data_by_aqs",
        extension: ".geojson.gz"
    },
    "pm-cbsa": {
        source: "pm_cbsa",
        prefix: "data_by_aqs_",
        baseUrl: "/data_by_aqs",
        extension: ".geojson.gz"
    },
    "epa-ember": {
        source: "epa_ember",
        prefix: "data_by_aqs_",
        baseUrl: "/data_by_aqs",
        extension: ".geojson.gz"
    }
};

/**
 * Fetch dataset JSON from server (the AQS list)
 */
async function fetchDatasetList(datasetId) {
    if (datasetCache[datasetId]) return datasetCache[datasetId];

    const fileSuffix = datasetId.replace(/-/g, "_");
    const url = `/aqs_list_${fileSuffix}.json`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        datasetCache[datasetId] = data;
        return data;
    } catch (err) {
        console.error("Error loading aqs list:", err);
        return null;
    }
}

/**
 * Update State dropdown based on selected Dataset
 */
async function updateStates() {
    const datasetSelect = document.getElementById("DatadbDataSource");
    const stateSelect = document.getElementById("DatadbDataState");
    const aqsSelect = document.getElementById("DatadbDataAQS");

    if (!datasetSelect || !stateSelect) return;

    const datasetId = datasetSelect.value;
    const data = await fetchDatasetList(datasetId);

    if (!data) {
        stateSelect.innerHTML = '<option value="">Select State</option>';
        aqsSelect.innerHTML = '<option value="">Select AQS</option>';
        return;
    }

    const states = [...new Set(data.map(item => item.state))].sort();

    const currentState = stateSelect.value;
    stateSelect.innerHTML = '<option value="">Select State</option>';
    states.forEach(state => {
        const option = document.createElement("option");
        option.value = state;
        option.textContent = state;
        if (state === currentState) option.selected = true;
        stateSelect.appendChild(option);
    });

    if (!states.includes(currentState)) {
        aqsSelect.innerHTML = '<option value="">Select AQS</option>';
    } else {
        updateAQS();
    }
}

/**
 * Update AQS dropdown based on selected State
 */
function updateAQS() {
    const datasetSelect = document.getElementById("DatadbDataSource");
    const stateSelect = document.getElementById("DatadbDataState");
    const aqsSelect = document.getElementById("DatadbDataAQS");

    if (!datasetSelect || !stateSelect || !aqsSelect) return;

    const datasetId = datasetSelect.value;
    const state = stateSelect.value;

    const data = datasetCache[datasetId];
    if (!data || !state) {
        aqsSelect.innerHTML = '<option value="">Select AQS</option>';
        return;
    }

    const aqsList = data
        .filter(item => item.state === state)
        .map(item => item.AQS)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const currentAQS = aqsSelect.value;
    aqsSelect.innerHTML = '<option value="">Select AQS</option>';
    aqsList.forEach(aqs => {
        const option = document.createElement("option");
        option.value = aqs;
        option.textContent = aqs;
        if (aqs === currentAQS) option.selected = true;
        aqsSelect.appendChild(option);
    });
}

/**
 * Handle Query: Fetch AQS data and render table
 */
window.handleQuery = async function () {

    if (!auth.currentUser) {
        showAuthOverlay();
        return;
    }
    
    const datasetId = document.getElementById("DatadbDataSource")?.value;
    const state = document.getElementById("DatadbDataState")?.value;
    const aqsSite = document.getElementById("DatadbDataAQS")?.value;

    if (!aqsSite) {
        alert("Please select a specific AQS site to proceed.");
        return;
    }

    const config = QUERY_IMPORT_CONFIG[datasetId];
    if (!config) return;

    const btn = document.querySelector(".datadb-query-btn");
    const originalText = btn.textContent;
    btn.textContent = "Loading...";
    btn.disabled = true;

    // Construct URL: /data_by_aqs/{source}/data_by_aqs_{aqs}.geojson.gz
    const url = `${config.baseUrl}/${config.source}/${config.prefix}${aqsSite}${config.extension}`;

    try {
        const data = await fetchGeoJSON(url);
        if (data && data.features) {
            currentDatasetId = datasetId;
            currentAqs = aqsSite;
            currentFeatures = data.features;
            currentPage = 1;
            renderDataTable();
            document.getElementById("DatadbTableWrapper").style.display = "block";
        } else {
            alert("No detailed data found for this AQS site in the selected dataset.");
            document.getElementById("DatadbTableWrapper").style.display = "none";
        }
    } catch (err) {
        console.error("Query failed:", err);
        alert("Failed to fetch data. Please try again later.");
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
};

/**
 * Render GeoJSON features into the results table
 */
function renderDataTable() {
    const head = document.getElementById("DatadbTableHead");
    const body = document.getElementById("DatadbTableBody");
    const title = document.getElementById("DatadbTableTitle");
    const pagination = document.getElementById("DatadbPagination");

    if (!head || !body) return;

    title.textContent = `[${currentDatasetId}] [${currentAqs}]`;

    if (currentFeatures.length === 0) {
        head.innerHTML = "";
        body.innerHTML = "<tr><td>No data available</td></tr>";
        pagination.style.display = "none";
        return;
    }

    // Use keys from the first feature to maintain "original" JSON order
    currentTableKeys = Object.keys(currentFeatures[0].properties);
    currentTableData = currentFeatures.map(f => f.properties);

    // Calculate pagination
    totalPages = Math.ceil(currentTableData.length / ROWS_PER_PAGE);

    // Show/hide pagination
    if (totalPages > 1) {
        pagination.style.display = "flex";
        updatePaginationUI();
    } else {
        pagination.style.display = "none";
    }

    // Render header
    head.innerHTML = currentTableKeys.map(k => `<th>${k}</th>`).join("");

    // Render current page body
    renderTableBody();
}

function renderTableBody() {
    const body = document.getElementById("DatadbTableBody");
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    const end = start + ROWS_PER_PAGE;
    const pageData = currentTableData.slice(start, end);

    body.innerHTML = pageData.map(p => {
        return `<tr>${currentTableKeys.map(k => {
            const val = p[k];
            return `<td>${val === null || val === undefined ? "NA" : val}</td>`;
        }).join("")}</tr>`;
    }).join("");
}

function updatePaginationUI() {
    const prevBtn = document.getElementById("DatadbPrevBtn");
    const nextBtn = document.getElementById("DatadbNextBtn");
    const pageInfo = document.getElementById("DatadbPageInfo");

    if (prevBtn) prevBtn.disabled = (currentPage === 1);
    if (nextBtn) nextBtn.disabled = (currentPage === totalPages);
    if (pageInfo) pageInfo.textContent = `Page ${currentPage} of ${totalPages} (${currentTableData.length} total rows)`;
}

window.changePage = function (delta) {
    const newPage = currentPage + delta;
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        renderTableBody();
        updatePaginationUI();

        // Scroll back to top of table container
        const container = document.querySelector(".datadb-table-container");
        if (container) container.scrollTop = 0;
    }
};


/**
 * Download current table data as CSV
 */
window.downloadCSV = function () {
    if (!currentTableData || currentTableData.length === 0 || currentTableKeys.length === 0) return;

    const csvContent = [
        currentTableKeys.join(","),
        ...currentTableData.map(row => currentTableKeys.map(k => {
            const val = row[k];
            return `"${val === null || val === undefined ? "NA" : val}"`;
        }).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    const fileName = `aqs_${currentAqs}_${currentDatasetId}.csv`;

    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

/**
 * Initialize event listeners
 */
function initQueryBuilder() {
    const datasetSelect = document.getElementById("DatadbDataSource");
    const stateSelect = document.getElementById("DatadbDataState");

    if (datasetSelect) {
        datasetSelect.addEventListener("change", updateStates);
        updateStates();
    }

    if (stateSelect) {
        stateSelect.addEventListener("change", updateAQS);
    }
    
    // Auth state listener to enable/disable button
    onAuthStateChanged(auth, (user) => {
        const btn = document.querySelector(".datadb-query-btn");
        if (btn) {
            if (user) {
                btn.classList.remove("disabled-auth");
                btn.textContent = "Import data";
                btn.title = "";
            } else {
                btn.classList.add("disabled-auth");
                btn.textContent = "Import data (Login required)";
                btn.title = "Please login to import data";
            }
        }
    });
}

// Run on load
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initQueryBuilder);
} else {
    initQueryBuilder();
}

