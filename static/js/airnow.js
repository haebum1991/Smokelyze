
/**
 * AirNow Data Module
 * Handles fetching, parsing, and styling of AirNow real-time hourly data from EPA RSIG server
 * All functions prefixed with airnow for modularity
 * https://ofmpub.epa.gov/rsig/rsigserver?SERVICE=wcs&VERSION=1.0.0&REQUEST=GetCapabilities
 */

import { LAYER_TEMPLATES } from "./layers-def.js";
import { getStatesForCoordinates } from "./geo-utils.js";
import { regionStats } from "./layers-state.js";
import { usStates, caStates } from "./stats-common.js";

// ============================================
// Utility Functions
// ============================================
const AIRNOW_LAYERS = {
    "layer-airnow-hourly-pm25": "airnow.pm25",
    "layer-airnow-hourly-ozone": "airnow.ozone",
    "layer-airnow-hourly-no2": "airnow.no2"
};

/**
 * Check if any AirNow layer is currently active
 * @returns {boolean}
 */
export function airnowHasActiveLayers() {
    return Object.keys(AIRNOW_LAYERS).some(id => document.getElementById(id)?.checked);
}

/**
 * Get list of active AirNow coverages
 * @returns {Array<string>} Array of coverage names
 */
export function airnowGetActiveCoverages() {
    return Object.entries(AIRNOW_LAYERS)
        .filter(([id]) => document.getElementById(id)?.checked)
        .map(([_, coverage]) => coverage);
}

// ============================================
// State Management
// ============================================

let airnowCurrentHour = new Date().getUTCHours();

export function airnowGetCurrentTime() {
    return airnowCurrentHour;
}

export function airnowSetCurrentTime(hour) {
    airnowCurrentHour = parseInt(hour);
}

// ============================================
// Data Fetching
// ============================================

/**
 * Build RSIG API URL for AirNow coverage
 * @param {string} coverage - Coverage name (e.g., airnow.pm25, airnow.ozone, airnow.no2)
 * @param {string} isoDate - Date in YYYY-MM-DD format
 * @param {number} hour - Hour in 0-23 range
 * @param {string} bbox - Bounding box as minLng,minLat,maxLng,maxLat
 * @returns {string} Complete RSIG URL
 */
export function airnowBuildURL(coverage, isoDate, hour, bbox) {
    const rsigRoot = "https://ofmpub.epa.gov/rsig/rsigserver";
    const hourStr = String(hour).padStart(2, "0");

    const params = new URLSearchParams({
        SERVICE: "wcs",
        VERSION: "1.0.0",
        REQUEST: "GetCoverage",
        FORMAT: "ascii",
        TIME: `${isoDate}T${hourStr}:00:00Z/${isoDate}T${hourStr}:59:59Z`,
        BBOX: bbox,
        COVERAGE: coverage,
        COMPRESS: "1"
    });

    return `${rsigRoot}?${params.toString()}`;
}

/**
 * Decompress gzip response stream
 * @param {Response} response - Fetch Response object
 * @returns {Promise<string>} Decompressed text
 */
async function airnowDecompressGzip(response) {
    try {
        const ds = new DecompressionStream("gzip");
        const decompressedStream = response.body.pipeThrough(ds);
        const reader = decompressedStream.getReader();

        let text = "";
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            text += new TextDecoder().decode(value);
        }
        return text;
    } catch (e) {
        console.error("Gzip decompression failed:", e);
        throw e;
    }
}

/**
 * Fetch AirNow data from RSIG server
 * @param {string} url - Complete RSIG URL
 * @param {AbortSignal} signal - Optional AbortSignal for cancellation
 * @returns {Promise<string>} CSV text data
 */
export async function airnowFetchData(url, signal) {
    try {
        const fetchOptions = {};
        if (signal) fetchOptions.signal = signal;
        
        const response = await fetch(url, fetchOptions);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // RSIG returns gzip compressed data
        const text = await airnowDecompressGzip(response);
        return text;
    } catch (e) {
        if (e.name === "AbortError") {
            console.log("AirNow fetch aborted for:", url);
        } else {
            console.error("AirNow fetch failed:", url, e);
        }
        throw e;
    }
}

// ============================================
// Data Processing
// ============================================

/**
 * Parse tab-delimited CSV from RSIG
 * @param {string} csvString - Tab-delimited CSV text
 * @returns {Array<Object>} Array of row objects
 */
export function airnowParseCSV(csvString) {
    const lines = csvString.trim().split("\n");
    if (lines.length < 2) {
        console.warn("Empty or invalid CSV data");
        return [];
    }

    const headers = lines[0].toLowerCase().split("\t");
    const result = [];
        
    // Log headers
    console.log("AirNow CSV Headers:", headers);
    
    for (let i = 1; i < lines.length; i++) {
        const currentLine = lines[i].split("\t");
        if (currentLine.length === headers.length) {
            const obj = {};
            for (let j = 0; j < headers.length; j++) {
                obj[headers[j]] = currentLine[j];
            }
            result.push(obj);
        }
    }

    return result;
}

/**
 * Convert CSV rows to GeoJSON FeatureCollection
 * @param {Array<Object>} rows - Parsed CSV rows
 * @param {string} lonKey - Longitude field name
 * @param {string} latKey - Latitude field name
 * @returns {Promise<Object>} GeoJSON FeatureCollection
 */
export async function airnowCsv2GeoJSON(rows, lonKey = "longitude(deg)", latKey = "latitude(deg)") {
    const features = rows.map(row => {
        const lon = parseFloat(row[lonKey]);
        const lat = parseFloat(row[latKey]);

        if (isNaN(lon) || isNaN(lat)) {
            return null;
        }
        
        // Parse site_name: 840121152002 ; 88101
        const siteNameFull = row["site_name"] || "";
        const parts = siteNameFull.split(";");
        const siteId = parts[0]?.trim() || "";
        const paramCode = parts[1]?.trim() || "";
        const AQS = siteId.slice(3);

        let dsKeyForFigure = null;
        if (paramCode === "88101" || paramCode === "88502") dsKeyForFigure = "airnow-hourly-pm25";
        else if (paramCode === "44201") dsKeyForFigure = "airnow-hourly-ozone";
        else if (paramCode === "42602") dsKeyForFigure = "airnow-hourly-no2";

        const properties = Object.assign({}, row, {
            paramCode,
            AQS,
            dsKeyForFigure
        });
        
        // Convert numeric pollutant fields from string to number for chart compatibility
        ["pm25(ug/m3)", "ozone(ppb)", "no2(ppb)"].forEach(field => {
            if (properties[field] !== undefined && properties[field] !== "") {
                const val = parseFloat(properties[field]);
                if (!isNaN(val)) properties[field] = val;
            }
        });

        return {
            type: "Feature",
            properties: properties,
            geometry: {
                type: "Point",
                coordinates: [lon, lat]
            }
        };
    }).filter(f => f !== null);

    const geojson = {
        type: "FeatureCollection",
        features: features
    };

    // Enrich with state information
    await airnowEnrichWithState(geojson);

    return geojson;
}

/**
 * Enrich GeoJSON features with state/region information
 * @param {Object} geojson - GeoJSON FeatureCollection
 * @returns {Promise<void>}
 */
async function airnowEnrichWithState(geojson) {
    if (!geojson || !geojson.features || geojson.features.length === 0) {
        return;
    }

    try {
        const coordinates = geojson.features.map(feature => {
            const [lon, lat] = feature.geometry.coordinates;
            return { lon, lat };
        });

        const states = await getStatesForCoordinates(coordinates);

        geojson.features.forEach((feature, index) => {
            feature.properties.state = states[index];
        });

        const withState = states.filter(s => s !== null).length;
        console.log(`AirNow state enrichment: ${withState}/${geojson.features.length} stations matched`);
    } catch (error) {
        console.error("Failed to enrich AirNow data with state information:", error);
    }
}


/**
 * Clear AirNow-related stats from regionStats
 */
export function airnowClearStats() {
    Object.keys(regionStats).forEach(id => {
        delete regionStats[id]["airnow-hourly-pm25"];
        delete regionStats[id]["airnow-hourly-ozone"];
        delete regionStats[id]["airnow-hourly-no2"];
    });
}


/**
 * Update global regionStats with aggregated AirNow data
 * Calculates state-level averages and updates the shared regionStats object
 * @param {Object} geojson - GeoJSON FeatureCollection with state information
 * @param {string} coverage - Coverage name (e.g., airnow.pm25)
 */
export function airnowUpdateStatsMap(geojson, coverage) {
    if (!geojson || !geojson.features || geojson.features.length === 0) {
        return;
    }

    // Convert coverage like "airnow.pm25" to "airnow-pm25" to match stats keys
    const coverageMap = {
        "airnow.pm25": "airnow-hourly-pm25",
        "airnow.ozone": "airnow-hourly-ozone",
        "airnow.no2": "airnow-hourly-no2"
    };
    const layerId = coverageMap[coverage];

    // Get field name from LAYER_TEMPLATES
    const tmpl = LAYER_TEMPLATES.find(t => t.id === layerId);
    if (!tmpl) {
        console.warn(`Template not found for ${layerId}, skipping stats update`);
        return;
    }
    const field = typeof tmpl.field === "function" ? tmpl.field(layerId) : tmpl.field;

    // Group by state
    const stateValues = {}; // { stateId: [values] }
    const regions = {
        "US": [],
        "US_conus": [],
        "Canada": []
    };

    geojson.features.forEach(feature => {
        const stateId = feature.properties.state;
        if (!stateId) return;

        const val = parseFloat(feature.properties[field]);
        if (isNaN(val) || val < 0) return;

        // State grouping
        if (!stateValues[stateId]) {
            stateValues[stateId] = [];
        }
        stateValues[stateId].push(val);

        // Regional grouping
        if (usStates.includes(stateId)) {
            regions["US"].push(val);
            if (stateId !== "Alaska" && stateId !== "Hawaii") {
                regions["US_conus"].push(val);
            }
        } else if (caStates.includes(stateId)) {
            regions["Canada"].push(val);
        }
    });

    // Calculate state averages
    for (const [stateId, values] of Object.entries(stateValues)) {
        if (!regionStats[stateId]) {
            regionStats[stateId] = { ID: stateId };
        }
        const sum = values.reduce((a, b) => a + b, 0);
        regionStats[stateId][layerId] = sum / values.length;
    }

    // Calculate regional averages
    for (const [regionId, values] of Object.entries(regions)) {
        if (values.length > 0) {
            if (!regionStats[regionId]) {
                regionStats[regionId] = { ID: regionId };
            }
            const sum = values.reduce((a, b) => a + b, 0);
            regionStats[regionId][layerId] = sum / values.length;
        }
    }

    console.log(`AirNow stats updated for ${Object.keys(stateValues).length} states and ${Object.keys(regions).length} regions (${layerId})`);
}

