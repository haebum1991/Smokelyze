
/**
 * 데이터 상태 및 캐시 관리: 불러온 데이터, 통계치, 캐시 상태 등을 기억/가공
 */
 
import { regionStats } from "./layers-state.js";
import { updateStateColors } from "./layers-colors.js";
import { LAYER_TEMPLATES, DATASET_SOURCE_MAP } from "./layers-def.js";

// Internal state
let loadedNewsFeatures = [];  // 내부 전용
export const loadedSources = {};
export const loadedGeoJSON = {};
export const modelStatsCache = {};
export let activeSources = [];

export let metricsMap = {};
export let COUNT_METRICS = [];
export let metricsInitialized = false;

export function getLoadedNewsFeatures() {
    return loadedNewsFeatures || [];
}

export function setLoadedNewsFeatures(val) {
    loadedNewsFeatures = val;
}

export function initializeMetrics() {
    if (metricsInitialized || !LAYER_TEMPLATES) return;
    LAYER_TEMPLATES.forEach(function (tmpl) {
        metricsMap[tmpl.id] = tmpl.field;
        if (tmpl.decimals === 0) {
            COUNT_METRICS.push(tmpl.id);
        }
    });
    metricsInitialized = true;
}

export function clearModelStats() {
    if (!regionStats) return;
    var stats = regionStats;
    var keysToClear = Object.keys(metricsMap).concat(["label_display"]);

    Object.keys(stats).forEach(function (state) {
        if (!stats[state]) return;
        keysToClear.forEach(function (k) {
            if (stats[state][k] !== undefined) {
                delete stats[state][k];
            }
        });
    });

    if (updateStateColors) {
        updateStateColors();
    }
    console.log("Model stats cleared.");
}

export function resetLoadedSources(updateWildfireNewsList) {
    Object.keys(loadedSources).forEach(key => {
        delete loadedSources[key];
    });
    loadedNewsFeatures.length = 0;
    Object.keys(modelStatsCache).forEach(key => delete modelStatsCache[key]);
    if (updateWildfireNewsList) updateWildfireNewsList([]); // Clear UI immediately
    console.log("Loader cache cleared.");
}

export function mergeModelStats(modelStats) {
    Object.keys(modelStats).forEach(function (state) {
        var existing = regionStats[state] || {};
        regionStats[state] = Object.assign({}, existing, modelStats[state]);
    });
}

export function getSiteStatsForState(targetState) {
    var loaded = loadedGeoJSON;
    if (!loaded) return {};

    var siteStats = {};
    var localMetricsMap = {};

    if (LAYER_TEMPLATES) {
        LAYER_TEMPLATES.forEach(function (tmpl) {
            localMetricsMap[tmpl.id] = tmpl.field;
        });
    }

    var dsMap = DATASET_SOURCE_MAP || {};

    Object.keys(loaded).forEach(function (sourceKey) {
        // Match sourceKey against activeSources.
        // Match if sourceKey is exact ID, or starts with ID_ (AirNow hourly cache)
        var matchedAct = null;
        if (activeSources) {
            for (var i = 0; i < activeSources.length; i++) {
                var act = activeSources[i];
                // 1. sourceKey exactly matches the active source ID (standard/model data)
                // 2. sourceKey is the specific version/timestamp currently loaded for this source (AirNow)
                if (sourceKey === act || (loadedSources[act] && sourceKey === loadedSources[act])) {
                    matchedAct = act;
                    break;
                }
            }
        }
        if (!matchedAct) return;

        var fc = loaded[sourceKey];
        if (!fc || !fc.features) return;

        var dsKey = Object.keys(dsMap).find(function (k) { return dsMap[k] === matchedAct; }) || matchedAct;


        fc.features.forEach(function (fi) {
            var p = fi.properties;
            if (!p.state) return;
            if (p.state !== targetState) return;

            var id = p.AQS || p.AQS_O3 || p.AQS_PM || p.site_name || p.ID;
            if (id === undefined || id === null || id === "") return;

            if (!siteStats[id]) {
                siteStats[id] = {
                    _properties: p,
                    _coords: fi.geometry ? fi.geometry.coordinates : null
                };
            }

            Object.keys(localMetricsMap).forEach(function (mKey) {
                var fieldDef = localMetricsMap[mKey];
                var fieldName = (typeof fieldDef === "function") ? fieldDef(dsKey) : fieldDef;

                if (p[fieldName] !== undefined) {
                    siteStats[id][mKey] = p[fieldName];
                }
            });

            if (sourceKey === "gam_v2" || sourceKey === "gam_v2_edm") {
                siteStats[id].label_display = "TMAX (K)";
            } else {
                siteStats[id].label_display = "TMAX (°C)";
            }
        });
    });

    return siteStats;
}

