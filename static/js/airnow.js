
/**
 * AirNow Data Module (Optimized)
 * Handles loading and processing of AirNow real-time hourly data from local GCS mirror
 */

import { LAYER_TEMPLATES } from "./layers-def.js";
import { regionStats } from "./layers-state.js";
import { usStates, caStates } from "./stats-common.js";

/**
 * Fetch and decompress AirNow daily bundle
 */
export async function airnowFetchData(url, signal) {
    try {
        const fetchOptions = signal ? { signal } : {};
        const response = await fetch(url, fetchOptions);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer);

        // Manual decompression if needed, otherwise browser handles Content-Encoding: gzip
        if (bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
            const stream = new Response(buffer).body.pipeThrough(new DecompressionStream("gzip"));
            return await new Response(stream).json();
        } else {
            return JSON.parse(new TextDecoder("utf-8").decode(buffer));
        }
    } catch (e) {
        if (e.name !== "AbortError") console.error("AirNow fetch failed:", url, e);
        throw e;
    }
}

/**
 * Activate specific hour data in the GeoJSON object by mapping Txx fields
 */
export function airnowActivateHour(geojson, hour) {
    if (!geojson || !geojson.features) return;

    const hourStr = String(hour).padStart(2, "0");
    const pmField = `PM2.5_T${hourStr}`;
    const ozoneField = `MDA8O3_T${hourStr}`;
    const no2Field = `NO2_T${hourStr}`;

    geojson.features.forEach(f => {
        const p = f.properties;

        p["pm25(ug/m3)"] = p[pmField];
        p["ozone(ppb)"] = p[ozoneField];
        p["no2(ppb)"] = p[no2Field];
        p["current_hour_str"] = `${p["date"] || ""} ${hourStr}:00 UTC`;

        // Use [airnow_hourly] as the representative key for the hourly bundle to ensure map sync and tooltips work properly
        p.dsKeyForFigure = "airnow_hourly";

        ["pm25(ug/m3)", "ozone(ppb)", "no2(ppb)"].forEach(field => {
            if (p[field] !== undefined && p[field] !== null && p[field] !== "") {
                const val = parseFloat(p[field]);
                p[field] = isNaN(val) ? null : val;
            } else {
                p[field] = null;
            }
        });
    });
}

/**
 * Clear AirNow-related stats
 */
export function airnowClearStats() {
    Object.keys(regionStats).forEach(id => {
        delete regionStats[id]["airnow-hourly-pm25"];
        delete regionStats[id]["airnow-hourly-ozone"];
        delete regionStats[id]["airnow-hourly-no2"];
    });
}

/**
 * Update global regionStats for state-level averages
 */
export function airnowUpdateStatsMap(geojson, layerId) {
    if (!geojson || !geojson.features || geojson.features.length === 0) return;

    const tmpl = LAYER_TEMPLATES.find(t => t.id === layerId);
    if (!tmpl) return;

    const field = typeof tmpl.field === "function" ? tmpl.field(layerId) : tmpl.field;

    const stateValues = {};
    const regions = { "US": [], "US_conus": [], "Canada": [] };

    geojson.features.forEach(feature => {
        const stateId = feature.properties.state;
        if (!stateId) return;

        const val = feature.properties[field];
        if (val === null || val < 0) return;

        if (!stateValues[stateId]) stateValues[stateId] = [];
        stateValues[stateId].push(val);

        if (usStates.includes(stateId)) {
            regions["US"].push(val);
            if (stateId !== "Alaska" && stateId !== "Hawaii") regions["US_conus"].push(val);
        } else if (caStates.includes(stateId)) {
            regions["Canada"].push(val);
        }
    });

    for (const [stateId, values] of Object.entries(stateValues)) {
        if (!regionStats[stateId]) regionStats[stateId] = { ID: stateId };
        regionStats[stateId][layerId] = values.reduce((a, b) => a + b, 0) / values.length;
    }

    for (const [regionId, values] of Object.entries(regions)) {
        if (values.length > 0) {
            if (!regionStats[regionId]) regionStats[regionId] = { ID: regionId };
            regionStats[regionId][layerId] = values.reduce((a, b) => a + b, 0) / values.length;
        }
    }
}

// State management (current hour tracking)
let airnowCurrentHour = new Date().getUTCHours();
export function airnowGetCurrentTime() { return airnowCurrentHour; }
export function airnowSetCurrentTime(hour) { airnowCurrentHour = parseInt(hour); }
export function airnowHasActiveLayers() {
    return ["layer-airnow-hourly-pm25", "layer-airnow-hourly-ozone", "layer-airnow-hourly-no2"]
        .some(id => document.getElementById(id)?.checked);
}
export function airnowGetActiveLayerIds() {
    const AIRNOW_LAYERS = [
        "airnow-hourly-pm25",
        "airnow-hourly-ozone",
        "airnow-hourly-no2"
    ];
    return AIRNOW_LAYERS.filter(id => document.getElementById(`layer-${id}`)?.checked);
}

