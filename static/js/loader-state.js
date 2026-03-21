
/**
 * 데이터 상태 및 캐시 관리: 불러온 데이터, 통계치, 캐시 상태 등을 기억/가공
 */
 
import { regionStats } from "./layers-state.js";
import { updateStateShading } from "./layers-colors.js";
import { LAYER_TEMPLATES, DATASET_SOURCE_MAP, DATA_IMPORT_METHOD } from "./layers-def.js";
import { map } from "./map-init.js";
import { EMPTY_FC } from "./layers-constants.js";

// Internal state
let loadedNewsFeatures = [];  // 내부 전용
export const loadedSources = {};
export const loadedGeoJSON = {};
export const modelStatsCache = {};
export let activeSources = [];

export let metricsMap = {};
export let COUNT_METRICS = [];

let metricsInitialized = false;

export function getLoadedNewsFeatures() {
    return loadedNewsFeatures || [];
}

export function setLoadedNewsFeatures(val) {
    loadedNewsFeatures = val;
}

export function initializeMetrics() {
    if (metricsInitialized || !LAYER_TEMPLATES) return;
    LAYER_TEMPLATES.forEach(tmpl => {
        metricsMap[tmpl.id] = tmpl.field;
        if (tmpl.decimals === 0) {
            COUNT_METRICS.push(tmpl.id);
        }
    });
    metricsInitialized = true;
}

export function clearModelStats() {
    if (!regionStats) return;
    const stats = regionStats;
    const keysToClear = Object.keys(metricsMap).concat(["label_display"]);

    Object.keys(stats).forEach(state => {
        if (!stats[state]) return;
        keysToClear.forEach(k => {
            if (stats[state][k] !== undefined) {
                delete stats[state][k];
            }
        });
    });

    if (updateStateShading) {
        updateStateShading();
    }
    console.log("Model stats cleared.");
}

export function resetLoadedSources(updateWildfireNewsList) {
    
    // 1. [Fix] Force WebGL context to clear textures by feeding empty data 
    // before destroying the JS variables. This prevents Mapbox black screen crashes.
    if (map && map.isStyleLoaded()) {
        Object.keys(loadedSources).forEach(sourceKey => {
            const ds = DATA_IMPORT_METHOD[sourceKey] || Object.values(DATA_IMPORT_METHOD).find(d => d.source === sourceKey);
            const targetSourceId = (ds && ds.source) ? ds.source : sourceKey;
            
            const mapSource = map.getSource(targetSourceId);
            if (mapSource && typeof mapSource.setData === "function") {
                mapSource.setData(EMPTY_FC);
            }
        });
    }
    
    Object.keys(loadedSources).forEach(key => {
        loadedSources[key] = null;
        delete loadedSources[key];
    });
    Object.keys(loadedGeoJSON).forEach(key => {
        loadedGeoJSON[key] = null;
        delete loadedGeoJSON[key];
    });
    loadedNewsFeatures.length = 0;
    Object.keys(modelStatsCache).forEach(key => {
        modelStatsCache[key] = null;
        delete modelStatsCache[key];
    });
    
    if (updateWildfireNewsList) updateWildfireNewsList([]); // Clear UI immediately
    console.log("Loader cache cleared.");
}

export function mergeModelStats(modelStats) {
    Object.keys(modelStats).forEach(state => {
        const existing = regionStats[state] || {};
        regionStats[state] = { ...existing, ...modelStats[state] };
    });
}

export function getSiteStatsForState(targetState) {
    const loaded = loadedGeoJSON;
    if (!loaded) return {};

    const siteStats = {};
    const localMetricsMap = {};

    if (LAYER_TEMPLATES) {
        LAYER_TEMPLATES.forEach(tmpl => {
            localMetricsMap[tmpl.id] = tmpl.field;
        });
    }

    const dsMap = DATASET_SOURCE_MAP || {};

    Object.keys(loaded).forEach(sourceKey => {
        // Match sourceKey against activeSources.
        // Match if sourceKey is exact ID, or starts with ID_ (AirNow hourly cache)
        let matchedAct = null;
        if (activeSources) {
            for (const act of activeSources) {
                // 1. sourceKey exactly matches the active source ID (standard/model data)
                // 2. sourceKey is the specific version/timestamp currently loaded for this source (AirNow)
                if (sourceKey === act || (loadedSources[act] && sourceKey === loadedSources[act])) {
                    matchedAct = act;
                    break;
                }
            }
        }
        if (!matchedAct) return;

        const fc = loaded[sourceKey];
        if (!fc || !fc.features) return;

        const relevantDsKeys = Object.keys(dsMap).filter(k => dsMap[k] === matchedAct);
        if (relevantDsKeys.length === 0) relevantDsKeys.push(matchedAct);

        fc.features.forEach(fi => {
            const p = fi.properties;
            if (!p.state) return;
            if (p.state !== targetState) return;

            const id = p.AQS || p.AQS_O3 || p.AQS_PM || p.site_name || p.ID;
            if (id === undefined || id === null || id === "") return;

            if (!siteStats[id]) {
                siteStats[id] = {
                    _properties: p,
                    _coords: fi.geometry ? fi.geometry.coordinates : null
                };
            }

            Object.keys(localMetricsMap).forEach(mKey => {
                const fieldDef = localMetricsMap[mKey];

                relevantDsKeys.forEach(dsK => {
                    const fieldName = (typeof fieldDef === "function") ? fieldDef(dsK) : fieldDef;
                    if (p[fieldName] !== undefined && p[fieldName] !== null) {
                        siteStats[id][mKey] = p[fieldName];
                    }
                });
            });

            if (sourceKey === "gam_v2") {
                siteStats[id].label_display = "TMAX (K)";
            } else {
                siteStats[id].label_display = "TMAX (°C)";
            }
        });
    });

    return siteStats;
}

