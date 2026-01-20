
/**
 * Data Page Query Builder Logic
 * Handles cascading dropdowns and data table display
 */


import { fetchGeoJSON } from "./loader-fetch.js";
import { auth, onAuthStateChanged } from "./fb-init.js";
import { showAuthOverlay, fetchJson } from "./utils.js";

let datasetCache = {};
let currentTableData = null; // Store for CSV download
let currentTableKeys = [];  // Store sorted keys for CSV download
let currentDatasetId = "";  // Track for filename
let currentAqs = "";        // Track for filename

// Pagination State
const ROWS_PER_PAGE = 15;
let currentPage = 1;
let totalPages = 1;
let currentFeatures = [];

const QUERY_IMPORT_CONFIG = {
    "gam-v2": {
        source: "gam_v2",
        prefix: "data_by_aqs_",
        baseUrl: "/data_by_aqs",
        extension: ".geojson.gz",
        metaBaseUrl: "/data_by_aqs_meta",
        metaPrefix: "data_by_aqs_meta_",
        metaExtension: ".json"
    },
    "gam-v1": {
        source: "gam_v1",
        prefix: "data_by_aqs_",
        baseUrl: "/data_by_aqs",
        extension: ".geojson.gz",
        metaBaseUrl: "/data_by_aqs_meta",
        metaPrefix: "data_by_aqs_meta_",
        metaExtension: ".json"
    },
    "pm-cbsa": {
        source: "pm_cbsa",
        prefix: "data_by_aqs_",
        baseUrl: "/data_by_aqs",
        extension: ".geojson.gz",
        metaBaseUrl: "/data_by_aqs_meta",
        metaPrefix: "data_by_aqs_meta_",
        metaExtension: ".json"
    },
    "epa-ember": {
        source: "epa_ember",
        prefix: "data_by_aqs_",
        baseUrl: "/data_by_aqs",
        extension: ".geojson.gz",
        metaBaseUrl: "/data_by_aqs_meta",
        metaPrefix: "data_by_aqs_meta_",
        metaExtension: ".json"
    }
};

/**
 * Fetch dataset JSON from server (the AQS list)
 */
async function fetchDatasetList(datasetId) {
    if (datasetCache[datasetId]) return datasetCache[datasetId];

    const fileSuffix = datasetId.replace(/-/g, "_");
    const url = `/aqs_list_${fileSuffix}.json`;

    const data = await fetchJson(url, null);
    if (data) datasetCache[datasetId] = data;
    return data;
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
        aqsSelect.innerHTML = '<option value="">Select State</option>';
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
 * Render Metadata section
 */
function renderDataMeta(data) {
    const container = document.getElementById("DatadbMetaContainer");
    const content = document.getElementById("DatadbMetaContent");
    if (!container || !content || !data.meta) return;

    let html = "";
    data.meta.forEach(row => {
        // Pair 1
        if (row.Contents && row.Descriptions) {
            html += `
                <div class="datadb-meta-item">
                    <span class="datadb-meta-label">${row.Contents}</span>
                    <span class="datadb-meta-value">${row.Descriptions}</span>
                </div>
            `;
        }
        // Pair 2
        if (row["Contents.1"] && row["Descriptions.1"]) {
            html += `
                <div class="datadb-meta-item">
                    <span class="datadb-meta-label">${row["Contents.1"]}</span>
                    <span class="datadb-meta-value">${row["Descriptions.1"]}</span>
                </div>
            `;
        }
    });

    if (data.terms && data.terms.length > 0) {
        html += `<div style="grid-column: 1 / -1; margin-top: 2rem; border-top: 0.1rem solid var(--border-light); padding-top: 1rem;">
                    <h5 style="margin-bottom: 1rem; font-size: 1.6rem; color: var(--text-main);">Model Terms (EDF & F-statistic)</h5>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem;">`;

        data.terms.forEach(term => {
            if (term.term) {
                html += `<div class="datadb-meta-item" style="border-bottom: none; background: rgba(0,0,0,0.02); padding: 0.5rem; border-radius: 0.4rem;">
                            <span class="datadb-meta-label" style="font-size: 1.2rem;">${term.term}</span>
                            <span class="datadb-meta-value" style="font-size: 1.2rem;">EDF: ${term.edf} / F: ${term.F}</span>
                         </div>`;
            }
            if (term["term.1"]) {
                html += `<div class="datadb-meta-item" style="border-bottom: none; background: rgba(0,0,0,0.02); padding: 0.5rem; border-radius: 0.4rem;">
                            <span class="datadb-meta-label" style="font-size: 1.2rem;">${term["term.1"]}</span>
                            <span class="datadb-meta-value" style="font-size: 1.2rem;">EDF: ${term["edf.1"]} / F: ${term["F.1"]}</span>
                         </div>`;
            }
        });
        html += `</div></div>`;
    }

    content.innerHTML = html;
}

/**
 * Render Table Body
 */
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

/**
 * Update Pagination UI
 */
function updatePaginationUI() {
    const prevBtn = document.getElementById("DatadbPrevBtn");
    const nextBtn = document.getElementById("DatadbNextBtn");
    const pageInfo = document.getElementById("DatadbPageInfo");

    if (prevBtn) prevBtn.disabled = (currentPage === 1);
    if (nextBtn) nextBtn.disabled = (currentPage === totalPages);
    if (pageInfo) pageInfo.textContent = `Page ${currentPage} of ${totalPages} (${currentTableData.length} total rows)`;
}

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
    currentTableData = currentFeatures.map(f => {
        const p = { ...f.properties };
        if (f.geometry && f.geometry.coordinates) {
            p.lon = f.geometry.coordinates[0];
            p.lat = f.geometry.coordinates[1];
        }

        if (p.smoke === 0) {
            p.SMO = null;
            p.edm_SMO = null;
        }

        return p;
    });

    let baseKeys = Object.keys(currentTableData[0]);
    const finalKeys = [];
    const addedCoords = new Set(["lon", "lat"]);

    baseKeys.forEach(k => {
        if (k === "lon" || k === "lat") return;
        finalKeys.push(k);
        if (k === "site_name") {
            finalKeys.push("lon", "lat");
            addedCoords.clear();
        }
    });

    addedCoords.forEach(c => finalKeys.push(c));
    currentTableKeys = finalKeys;

    totalPages = Math.ceil(currentTableData.length / ROWS_PER_PAGE);

    if (totalPages > 1) {
        pagination.style.display = "flex";
        updatePaginationUI();
    } else {
        pagination.style.display = "none";
    }

    head.innerHTML = currentTableKeys.map(k => `<th>${k}</th>`).join("");
    renderTableBody();
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

    const url = `${config.baseUrl}/${config.source}/${config.prefix}${aqsSite}${config.extension}`;
    const metaUrl = `${config.metaBaseUrl}/${config.source}/${config.metaPrefix}${aqsSite}${config.metaExtension}`;

    try {
        const [data, metaData] = await Promise.all([
            fetchGeoJSON(url),
            fetchJson(metaUrl, null)
        ]);

        if (data && data.features) {
            currentDatasetId = datasetId;
            currentAqs = aqsSite;
            currentFeatures = data.features;
            currentPage = 1;

            if (metaData) {
                renderDataMeta(metaData);
            }

            renderDataTable();
            document.getElementById("DatadbTableWrapper").style.display = "block";

            // Default to Metadata tab on new query
            const metaTabBtn = document.getElementById("BtnMetaTab");
            if (metaTabBtn) metaTabBtn.click();
            
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
 * Exposed functions for HTML
 */
window.changePage = function (delta) {
    const newPage = currentPage + delta;
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        renderTableBody();
        updatePaginationUI();

        const container = document.querySelector(".datadb-table-container");
        if (container) container.scrollTop = 0;
    }
};

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

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initQueryBuilder);
} else {
    initQueryBuilder();
}

