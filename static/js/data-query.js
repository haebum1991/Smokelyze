
/**
 * Data Page Query Builder Logic
 * Handles cascading dropdowns and data table display
 */
import { fetchGeoJSON } from "./loader-fetch.js";
import { auth, onAuthStateChanged } from "./fb-init.js";
import { showAuthOverlay, fetchJson, ESML } from "./utils.js";
import { updateAuthButton } from "./signin.js";
import { renderAQSPlots as drawAQSPlots } from "./data-query-plots.js";
import { logUserAction } from "./fb-logging.js";

/**
 * Local utility: Same as ESML but specifically allows <br> tags for line breaks
 */
function ESML_BR(str) {
    if (str === null || str === undefined) return "";
    return ESML(str).replace(/&lt;br&gt;/gi, "<br>");
}

let datasetCache = {};
let currentTableData = null; // Store for CSV download
let currentTableKeys = [];  // Store sorted keys for CSV download
let currentDatasetId = "";  // Track for filename
let currentQueryState = ""; // Track for filename
let currentAqs = "";        // Track for filename
let currentLocationData = null; // Store location info (lon, lat, site_name)
let locationMap = null; // MapLibre GL map instance for Location tab
let locationMarker = null; // Marker instance for Location tab
let mapLibraryLoaded = false; // Track if MapLibre GL is loaded
let mapLibraryLoading = false; // Track if library is currently loading
let defaultDateStart = null; // Store original min date
let defaultDateEnd = null; // Store original max date
let pendingFlyTo = false; // Flag to trigger map movement only after import

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
    const url = `/aqs_list_${fileSuffix}.geojson.gz`;
    const data = await fetchGeoJSON(url, null);
    
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

    const items = data.features ? data.features.map(f => f.properties) : data;
    const aqsList = items
        .filter(item => item.state === state)
        .map(item => ({ aqs: item.AQS, name: item.site_name || item.name || "" }))
        .sort((a, b) => a.aqs.localeCompare(b.aqs, undefined, { numeric: true }));

    const currentAQS = aqsSelect.value;
    aqsSelect.innerHTML = '<option value="">Select AQS</option>';
    aqsList.forEach(obj => {
        const option = document.createElement("option");
        option.value = obj.aqs;
        option.textContent = obj.name ? `${obj.aqs} (${obj.name})` : obj.aqs;
        if (obj.aqs === currentAQS) option.selected = true;
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
                    <span class="datadb-meta-label">${ESML(row.Contents)}</span>
                    <span class="datadb-meta-value">${ESML_BR(row.Descriptions)}</span>
                </div>
            `;
        }
        // Pair 2
        if (row["Contents.1"] && row["Descriptions.1"]) {
            html += `
                <div class="datadb-meta-item">
                    <span class="datadb-meta-label">${ESML(row["Contents.1"])}</span>
                    <span class="datadb-meta-value">${ESML_BR(row["Descriptions.1"])}</span>
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
                html += `<div class="datadb-meta-item" style="border-bottom: none; background: rgba(0,0,0,0.02); padding: 0.5rem; border-radius: var(--border-radius-0p8rem);">
                            <span class="datadb-meta-label" style="font-size: 1.2rem;">${ESML(term.term)}</span>
                            <span class="datadb-meta-value" style="font-size: 1.2rem;">EDF: ${ESML(term.edf)} / F: ${ESML(term.F)}</span>
                         </div>`;
            }
            if (term["term.1"]) {
                html += `<div class="datadb-meta-item" style="border-bottom: none; background: rgba(0,0,0,0.02); padding: 0.5rem; border-radius: var(--border-radius-0p8rem);">
                            <span class="datadb-meta-label" style="font-size: 1.2rem;">${ESML(term["term.1"])}</span>
                            <span class="datadb-meta-value" style="font-size: 1.2rem;">EDF: ${ESML(term["edf.1"])} / F: ${ESML(term["F.1"])}</span>
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
    const body = document.getElementById("DatadbDataTableBody");
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    const end = start + ROWS_PER_PAGE;
    const pageData = currentTableData.slice(start, end);

    body.innerHTML = pageData.map(p => {
        return `<tr>${currentTableKeys.map(k => {
            const val = p[k];
            const displayVal = (val !== undefined && val !== null) ? val : "NA";
            return `<td>${ESML(displayVal)}</td>`;
        }).join("")}</tr>`;
    }).join("");
    
    // Trigger feedback animation
    body.classList.remove("datadb-table-refreshing");
    void body.offsetWidth; // Force reflow to restart animation
    body.classList.add("datadb-table-refreshing");
}

/**
 * Update Pagination UI
 */
function updatePaginationUI() {
    const prevBtn = document.getElementById("DatadbDataTableBtnPrev");
    const nextBtn = document.getElementById("DatadbDataTableBtnNext");
    const pageInfo = document.getElementById("DatadbDataTablePageInfo");

    if (prevBtn) prevBtn.disabled = (currentPage === 1);
    if (nextBtn) nextBtn.disabled = (currentPage === totalPages);
    if (pageInfo) pageInfo.textContent = `Page ${currentPage} of ${totalPages} (${currentTableData.length} total rows)`;
}

/**
 * Render Location Information
 */
function renderLocationInfo() {
    if (!currentLocationData) return;

    const siteName = currentLocationData.site_name || "NA";
    const aqs = currentLocationData.AQS || currentAqs || "NA";
    const lon = currentLocationData.lon !== undefined ? currentLocationData.lon.toFixed(6) : "NA";
    const lat = currentLocationData.lat !== undefined ? currentLocationData.lat.toFixed(6) : "NA";

    document.getElementById("DatadbLocationSiteName").textContent = siteName;
    document.getElementById("DatadbLocationAQS").textContent = aqs;
    document.getElementById("DatadbLocationLon").textContent = lon;
    document.getElementById("DatadbLocationLat").textContent = lat;
}

/**
 * Set date range inputs to min/max from data
 */
function setDateRangeFromData(features) {
    if (!features || features.length === 0) return;

    const dateStartInput = document.getElementById("DatadbDataDateStart");
    const dateEndInput = document.getElementById("DatadbDataDateEnd");

    if (!dateStartInput || !dateEndInput) return;

    // Extract all dates from features (as strings to avoid timezone issues)
    const dateStrings = features
        .map(f => f.properties?.date)
        .filter(date => date && typeof date === "string") // Remove null/undefined
        .filter(date => /^\d{4}-\d{2}-\d{2}/.test(date)); // Validate YYYY-MM-DD format

    if (dateStrings.length === 0) return;

    // Find min and max dates (string comparison works for YYYY-MM-DD format)
    const minDate = dateStrings.reduce((min, date) => date < min ? date : min);
    const maxDate = dateStrings.reduce((max, date) => date > max ? date : max);
    const extractDate = (dateStr) => dateStr.split("T")[0].split(" ")[0];
    
    const minDateFormatted = extractDate(minDate);
    const maxDateFormatted = extractDate(maxDate);

    // Set date range for both Table and Plot inputs
    const setInputs = (startId, endId) => {
        const start = document.getElementById(startId);
        const end = document.getElementById(endId);
        if (start && end) {
            start.value = minDateFormatted;
            end.value = maxDateFormatted;
        }
    };

    setInputs("DatadbDataDateStart", "DatadbDataDateEnd");
    setInputs("DatadbPlotDateStart", "DatadbPlotDateEnd");
}

/**
 * Render GeoJSON features into the results table
 */
function renderDataTable() {
    const head = document.getElementById("DatadbDataTableHead");
    const body = document.getElementById("DatadbDataTableBody");
    const title = document.getElementById("DatadbDataTableTitle");
    const pagination = document.getElementById("DatadbDataTablePagination");

    if (!head || !body) return;

    title.textContent = `[${currentDatasetId}] [${currentQueryState}] [${currentAqs}]`;

    if (currentFeatures.length === 0) {
        head.innerHTML = "";
        body.innerHTML = "<tr><td>No data available</td></tr>";
        pagination.style.display = "none";
        return;
    }
    
    // Get date range from inputs
    const dateStart = document.getElementById("DatadbDataDateStart")?.value;
    const dateEnd = document.getElementById("DatadbDataDateEnd")?.value;

    // Filter features by date range
    let filteredFeatures = currentFeatures;
    if (dateStart && dateEnd) {
        const startDate = new Date(dateStart);
        const endDate = new Date(dateEnd);

        filteredFeatures = currentFeatures.filter(f => {
            const featureDate = f.properties.date;
            if (!featureDate) return true; // Include if no date field

            const fDate = new Date(featureDate);
            return fDate >= startDate && fDate <= endDate;
        });
    }

    // Use keys from the first feature to maintain "original" JSON order
    currentTableData = filteredFeatures.map(f => {
        const p = { ...f.properties };
        if (f.geometry && f.geometry.coordinates) {
            p.lon = f.geometry.coordinates[0];
            p.lat = f.geometry.coordinates[1];
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

    head.innerHTML = currentTableKeys.map(k => `<th>${ESML(k)}</th>`).join("");
    renderTableBody();
}

/**
 * Handle Query: Fetch AQS data and render table
 */
async function handleQuery() {
    if (!auth.currentUser) {
        showAuthOverlay();
        return;
    }

    const datasetId = document.getElementById("DatadbDataSource")?.value;
    const stateVal = document.getElementById("DatadbDataState")?.value;
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
            currentQueryState = stateVal;
            currentAqs = aqsSite;
            currentFeatures = data.features;
            currentPage = 1;
            
            // Extract location data from first feature
            if (data.features.length > 0) {
                const firstFeature = data.features[0];
                currentLocationData = {
                    site_name: firstFeature.properties?.site_name || "NA",
                    AQS: firstFeature.properties?.AQS || aqsSite,
                    lon: firstFeature.geometry?.coordinates?.[0],
                    lat: firstFeature.geometry?.coordinates?.[1]
                };
                renderLocationInfo();
            }
            
            // Set date range to data min/max
            setDateRangeFromData(data.features);
            
            if (metaData) {
                renderDataMeta(metaData);
            }

            renderDataTable();
            
            // [Report to Brain]
            logUserAction("view", {
                dataset: datasetId,
                aqs: aqsSite,
                state: stateVal
            });
            
            if (drawAQSPlots) drawAQSPlots(currentTableData, currentDatasetId, currentAqs);

            pendingFlyTo = true;
            document.getElementById("DatadbDataTableWrapper").style.display = "block";

            // Default to Metadata tab on new query
            const initTabBtn = document.getElementById("datadbBtnLocationTab");
            if (initTabBtn) initTabBtn.click();
            
        } else {
            alert("No detailed data found for this AQS site in the selected dataset.");
            document.getElementById("DatadbDataTableWrapper").style.display = "none";
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
 * Load MapLibre GL library dynamically (lazy loading)
 */
async function loadMapLibrary() {
    if (mapLibraryLoaded) return true;
    if (mapLibraryLoading) {
        // Wait for ongoing load
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (mapLibraryLoaded) {
                    clearInterval(checkInterval);
                    resolve(true);
                }
            }, 100);
        });
    }

    mapLibraryLoading = true;

    try {
        // Load CSS
        const cssLink = document.createElement("link");
        cssLink.rel = "stylesheet";
        cssLink.href = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css";
        document.head.appendChild(cssLink);

        // Load JS
        await new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js";
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });

        mapLibraryLoaded = true;
        mapLibraryLoading = false;
        return true;
    } catch (error) {
        console.error("Failed to load MapLibre GL:", error);
        mapLibraryLoading = false;
        return false;
    }
}

/**
 * Initialize and display location on embedded map (optimized with lazy loading)
 */
async function initLocationMap() {
    if (!currentLocationData || currentLocationData.lon === undefined || currentLocationData.lat === undefined) {
        return;
    }

    const mapContainer = document.getElementById("DatadbLocationMap");
    if (!mapContainer) return;

    const libraryLoaded = await loadMapLibrary();
    if (!libraryLoaded) {
        const errorDiv = document.createElement("div");
        errorDiv.style.cssText = "padding: 2rem; text-align: center; color: var(--text-main);";
        errorDiv.textContent = "Failed to load map library. Please refresh the page.";
        mapContainer.innerHTML = "";
        mapContainer.appendChild(errorDiv);
        return;
    }

    if (locationMap) {
        locationMap.resize(); // Always fix alignment

        if (pendingFlyTo) {
            locationMap.flyTo({
                center: [currentLocationData.lon, currentLocationData.lat],
                zoom: 8,
                essential: true
            });
            pendingFlyTo = false; // Reset flag
        }

        refreshLocationMarker();
        return;
    }

    // Show loading indicator with safe DOM creation
    const loadingDiv = document.createElement("div");
    const loadingSpan = document.createElement("span");
    
    loadingDiv.style.cssText = "display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-main);";
    loadingSpan.textContent = "Loading map...";
    loadingDiv.appendChild(loadingSpan);
    mapContainer.innerHTML = "";
    mapContainer.appendChild(loadingDiv);
    
    // Small delay to ensure container is visible
    await new Promise(resolve => setTimeout(resolve, 50));

    // Clear container
    mapContainer.innerHTML = "";

    // Initialize map
    locationMap = new maplibregl.Map({
        container: "DatadbLocationMap",
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: [currentLocationData.lon, currentLocationData.lat],
        zoom: 8,
        attributionControl: false
    });

    // Add controls
    locationMap.addControl(new maplibregl.NavigationControl(), "top-right");
    locationMap.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

    // Add marker and popup when map is loaded
    locationMap.on("load", () => {
        refreshLocationMarker();
    });
}

/**
 * Refresh or create the location marker
 */
function refreshLocationMarker() {
    if (!locationMap || !currentLocationData) return;

    const lon = currentLocationData.lon;
    const lat = currentLocationData.lat;
    if (lon === undefined || lat === undefined) return;

    if (locationMarker) {
        // Update existing marker
        locationMarker.setLngLat([lon, lat]);
    } else {
        // Create new marker
        locationMarker = new maplibregl.Marker({ color: "#a366ff" })
            .setLngLat([lon, lat])
            .addTo(locationMap);
    }
}

/**
 * Reset date range to original min/max
 */
function resetDateRange() {
    if (!defaultDateStart || !defaultDateEnd) {
        alert("No default date range available. Please import data first.");
        return;
    }

    const dateStartInput = document.getElementById("DatadbDataDateStart");
    const dateEndInput = document.getElementById("DatadbDataDateEnd");

    if (dateStartInput && dateEndInput) {
        dateStartInput.value = defaultDateStart;
        dateEndInput.value = defaultDateEnd;

        // Re-render table with full date range
        if (currentFeatures.length > 0) {
            currentPage = 1;
            renderDataTable();
        }
    }
}

/**
 * Reset PLOT date range to original min/max
 */
function resetPlotDateRange() {
    if (!defaultDateStart || !defaultDateEnd) return;

    const dateStartInput = document.getElementById("DatadbPlotDateStart");
    const dateEndInput = document.getElementById("DatadbPlotDateEnd");

    if (dateStartInput && dateEndInput) {
        dateStartInput.value = defaultDateStart;
        dateEndInput.value = defaultDateEnd;

        if (currentFeatures.length > 0) {
            // Plots use their own filtered set of currentFeatures, but here we just pass the full set
            if (drawAQSPlots) drawAQSPlots(currentFeatures.map(f => ({ ...f.properties, lon: f.geometry?.coordinates?.[0], lat: f.geometry?.coordinates?.[1] })), currentDatasetId, currentAqs);
        }
    }
}

/**
 * Apply current date range filter
 */
function applyDateRange() {
    if (currentFeatures.length === 0) {
        alert("No data loaded. Please import data first.");
        return;
    }

    const dateStartInput = document.getElementById("DatadbDataDateStart");
    const dateEndInput = document.getElementById("DatadbDataDateEnd");

    if (!dateStartInput?.value || !dateEndInput?.value) {
        alert("Please select both start and end dates.");
        return;
    }

    // Re-render table with current date range
    currentPage = 1;
    renderDataTable();
}

/**
 * Apply current PLOT date range filter
 */
function applyPlotDateRange() {
    if (currentFeatures.length === 0) return;

    const dateStart = document.getElementById("DatadbPlotDateStart")?.value;
    const dateEnd = document.getElementById("DatadbPlotDateEnd")?.value;

    if (!dateStart || !dateEnd) return;

    const startDate = new Date(dateStart);
    const endDate = new Date(dateEnd);

    // Filter features for PLOT independently
    const filteredForPlot = currentFeatures
        .filter(f => {
            const fDate = new Date(f.properties.date);
            return fDate >= startDate && fDate <= endDate;
        })
        .map(f => {
            const p = { ...f.properties };
            if (f.geometry && f.geometry.coordinates) {
                p.lon = f.geometry.coordinates[0];
                p.lat = f.geometry.coordinates[1];
            }
            return p;
        });

    if (drawAQSPlots) drawAQSPlots(filteredForPlot, currentDatasetId, currentAqs);
}

/**
 * Exposed functions for HTML
 */
function changePage(delta) {
    const newPage = currentPage + delta;
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        renderTableBody();
        updatePaginationUI();

        const container = document.querySelector(".datadb-table-container");
        if (container) container.scrollTop = 0;
    }
}

function downloadCSV() {

    if (!auth.currentUser) {
        showAuthOverlay();
        return;
    }
    
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
    
    // [Report to Brain]
    logUserAction("download", {
        dataset: currentDatasetId,
        aqs: currentAqs,
        state: currentQueryState,
        filename: fileName
    });
}


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
    
    // Button Listeners
    const btnImport = document.getElementById("DatadbDataTableBtnImport");
    if (btnImport) btnImport.addEventListener("click", handleQuery);

    const btnDownload = document.getElementById("DatadbDataTableBtnDownload");
    if (btnDownload) btnDownload.addEventListener("click", downloadCSV);

    const btnDefault = document.getElementById("DatadbDataTableBtnDateDefault");
    if (btnDefault) btnDefault.addEventListener("click", resetDateRange);

    const btnSetRange = document.getElementById("DatadbDataTableBtnDateSetRange");
    if (btnSetRange) btnSetRange.addEventListener("click", applyDateRange);

    const btnPrev = document.getElementById("DatadbDataTableBtnPrev");
    if (btnPrev) btnPrev.addEventListener("click", () => changePage(-1));

    const btnNext = document.getElementById("DatadbDataTableBtnNext");
    if (btnNext) btnNext.addEventListener("click", () => changePage(1));

    // Plot-specific Button Listeners
    const btnPlotDefault = document.getElementById("DatadbPlotBtnDateDefault");
    if (btnPlotDefault) btnPlotDefault.addEventListener("click", resetPlotDateRange);

    const btnPlotSetRange = document.getElementById("DatadbPlotBtnDateSetRange");
    if (btnPlotSetRange) btnPlotSetRange.addEventListener("click", applyPlotDateRange);

    // Custom Event Listeners (Tab Switching)
    window.addEventListener("tabOpenLocation", () => {
        // Debounce or just check visibility logic is inside initLocationMap usually
        if (initLocationMap) initLocationMap();
    });

    window.addEventListener("tabOpenPlots", () => {
        if (currentFeatures.length > 0) {
            applyPlotDateRange();
            setTimeout(() => {
                ["DatadbPlot1", "DatadbPlot2", "DatadbPlot3", "DatadbPlot4"].forEach(id => {
                    const el = document.getElementById(id);
                    if (el && window.Plotly) Plotly.Plots.resize(el);
                });
            }, 100);
        }
    });
    
    onAuthStateChanged(auth, (user) => {
        updateAuthButton("DatadbDataTableBtnImport", user, "Import data");
        updateAuthButton("DatadbDataTableBtnDownload", user, "Download CSV");
        updateAuthButton("DatadbDataTableBtnDateDefault", user, "Default date");
        updateAuthButton("DatadbDataTableBtnDateSetRange", user, "Set range");
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initQueryBuilder);
} else {
    initQueryBuilder();
}

