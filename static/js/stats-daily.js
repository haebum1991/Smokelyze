
import { DATA_IMPORT_METHOD, LAYER_TEMPLATES } from "./layers-def.js";
import * as utils from "./utils.js";
import * as common from "./stats-common.js";
import { regionStats } from "./layers-state.js";
import { activeSources } from "./loader.js";
import { modelStatsCache } from "./loader.js";
import { renderDailyBarLine } from "./stats-plot-dy-barline.js";
import { renderParCoords } from "./stats-plot-dy-parcoords.js";
import { renderDailyScatter } from "./stats-plot-dy-scatter.js";
import { updateStateShading } from "./layers-colors.js";
import { airnowGetCurrentTime } from "./airnow.js";
import { utcToLocal } from "./ui-time.js";
import { getActiveRasterLayers, getPolygonBBox } from "./map-area-stats.js";
import { getBoundaryFeatures } from "./geo-boundary.js";
import { pointInGeometry } from "./geo-utils.js";
import { rasterDataStore } from "./raster-loader.js";

// No App ref
const dailyCache = {
    burn: {},
    smoke: {},
    fire: {}
};

const rasterCache = new Map();

function loadDailyGeneric(options) {
    const {
        isoDate, regionIDs, dataset, urlFunc,
        fallbackData, initStatsFunc, parseFunc,
        layerId, cacheKey
    } = options;

    if (layerId) {
        const checkbox = document.getElementById(layerId);
        if (checkbox && !checkbox.checked) {
            return Promise.resolve(initStatsFunc(regionIDs));
        }
    }

    const dateKey = isoDate;
    if (cacheKey && dailyCache[cacheKey]?.[dateKey]) {
        const cachedData = dailyCache[cacheKey][dateKey];
        const cachedStats = initStatsFunc(regionIDs);
        const regionSet = new Set(regionIDs);
        parseFunc(cachedData, regionSet, cachedStats);
        return Promise.resolve(cachedStats);
    }

    if (!dataset || !urlFunc) {
        console.error("Invalid dataset or URL function");
        return Promise.resolve({});
    }

    const url = urlFunc(dataset, isoDate);
    if (!url) {
        return Promise.resolve({});
    }

    const regionSet = new Set(regionIDs);
    const stats = initStatsFunc(regionIDs);

    return utils.fetchJson(url, fallbackData).then(data => {
        if (cacheKey && dailyCache[cacheKey]) {
            dailyCache[cacheKey][dateKey] = data;
        }
        parseFunc(data, regionSet, stats);
        return stats;
    });
}

function parseBurnDaily(data, regionSet, stats) {
    if (data?.features && Array.isArray(data.features)) {
        data.features.forEach(fi => {
            const p = fi.properties || {};
            const id = p.ID;
            if (!regionSet.has(id)) return;
            const area = Number(p.area_km2) || 0;
            stats[id] += area;
        });
    }
}

function parseSmokeDaily(data, regionSet, stats) {
    if (Array.isArray(data)) {
        data.forEach(item => {
            const id = item.ID;
            if (!regionSet.has(id)) return;
            const cat = String(item.category || "").toLowerCase();
            const area = Number(item.area_km2) || 0;
            if (stats[id] && Object.prototype.hasOwnProperty.call(stats[id], cat)) {
                stats[id][cat] += area;
            }
        });
    }
}

function parseFireDaily(data, regionSet, stats) {
    if (Array.isArray(data)) {
        data.forEach(item => {
            const id = item.ID;
            if (!regionSet.has(id)) return;
            const cnt = Number(item.n_fires) || 0;
            const frp = Number(item.FRP) || 0;
            stats[id].count += cnt;
            stats[id].frpTotal += frp;
            stats[id].n += 1;
        });
    }
}

export function loadDailyBurn(isoDate, regionIDs) {
    if (modelStatsCache?.burn) {
        console.log("Using cached burn stats from loader.js for burn.");
        const cached = modelStatsCache.burn;
        const stats = common.createBurnStats(regionIDs);
        regionIDs.forEach(id => {
            if (cached[id]?.burn !== undefined) {
                stats[id] = cached[id].burn;
            }
        });
        return Promise.resolve(stats);
    }
    return loadDailyGeneric({
        isoDate,
        regionIDs,
        dataset: DATA_IMPORT_METHOD.burn,
        urlFunc: utils.urlByDateGeo,
        fallbackData: null,
        initStatsFunc: common.createBurnStats,
        parseFunc: parseBurnDaily,
        layerId: "layer-burn",
        cacheKey: "burn"
    });
}

export function loadDailyModel(regionIDs) {
    const createFunc = common?.createModelStats || (ids => {
        const out = {};
        ids.forEach(i => { out[i] = {}; });
        return out;
    });
    const modelStats = createFunc(regionIDs);

    regionIDs.forEach(id => {
        const regionData = regionStats ? regionStats[id] : null;
        if (regionData) {
            // Filter out non-model keys
            const exclude = ["id", "burn", "smokeLight", "smokeMedium", "smokeHeavy", "fireCount", "fireFrp"];
            Object.keys(regionData).forEach(k => {
                if (!exclude.includes(k)) {
                    modelStats[id][k] = regionData[k];
                }
            });
        }
    });
    return Promise.resolve(modelStats);
}

export function loadDailySmoke(isoDate, regionIDs) {
    return loadDailyGeneric({
        isoDate,
        regionIDs,
        dataset: DATA_IMPORT_METHOD.smoke,
        urlFunc: utils.urlByDateJson,
        fallbackData: [],
        initStatsFunc: common.createSmokeStats,
        parseFunc: parseSmokeDaily,
        layerId: "layer-smoke",
        cacheKey: "smoke"
    });
}

export function loadDailyFire(isoDate, regionIDs) {
    return loadDailyGeneric({
        isoDate,
        regionIDs,
        dataset: DATA_IMPORT_METHOD.fire,
        urlFunc: utils.urlByDateJson,
        fallbackData: [],
        initStatsFunc: common.createFireStats,
        parseFunc: parseFireDaily,
        layerId: "layer-fire",
        cacheKey: "fire"
    });
}

export function saveRegionStats(regionIDs, burnStats, smokeStats, fireStats) {
    // regionStats is mutable object exported from layers.js
    regionIDs.forEach(id => {
        const burn = (burnStats[id] !== undefined) ? burnStats[id] : null;
        const smoke = smokeStats[id] || { light: null, medium: null, heavy: null };
        const fire = fireStats[id] || { count: null, frpTotal: null, n: 0 };
        const fireFrp = (fire.n > 0 && fire.frpTotal !== null) ? fire.frpTotal / fire.n : null;
        const existing = regionStats[id] || {};
        regionStats[id] = {
            ...existing,
            id,
            burn,
            smokeLight: smoke.light ?? null,
            smokeMedium: smoke.medium ?? null,
            smokeHeavy: smoke.heavy ?? null,
            fireCount: fire.count ?? null,
            fireFrp
        };
    });
}

export function updateDailyStats(isoDate, regionIDs) {
    const tableDate = document.getElementById("StatsInputDate");
    if (tableDate) {
        let displayStr = utils.ESML(isoDate);

        // Check if any active dataset has hourly duration using activeSources state
        const hasHourly = activeSources.some(sourceKey => {
            const ds = DATA_IMPORT_METHOD[sourceKey];
            return ds?.duration === "hourly";
        });

        if (hasHourly) {
            const utcHour = airnowGetCurrentTime();
            const localHour = utcToLocal(utcHour);
            displayStr += ` ${String(localHour).padStart(2, "0")}:00`;
        }

        tableDate.innerHTML = `<span class='slot-roll'>${displayStr}</span>`;
    }

    Promise.all([
        loadDailyBurn(isoDate, regionIDs),
        loadDailySmoke(isoDate, regionIDs),
        loadDailyFire(isoDate, regionIDs),
        loadDailyModel(regionIDs)
    ])
        .then(results => {
            // Re-fetch common if it was initially undefined
            const c = common;
            const burnStats = results[0] || c.createBurnStats(regionIDs);
            const smokeStats = results[1] || c.createSmokeStats(regionIDs);
            const fireStats = results[2] || c.createFireStats(regionIDs);
            const modelStats = results[3] || c.createModelStats(regionIDs);

            return computeRasterStateAverages(isoDate, regionIDs, modelStats).then(() => {
                // Merge all modelStats (including computed raster averages) into regionStats!
                regionIDs.forEach(id => {
                    if (modelStats[id]) {
                        regionStats[id] = { ...regionStats[id], ...modelStats[id] };
                    }
                });

                saveRegionStats(regionIDs, burnStats, smokeStats, fireStats);

                // Update state shading after satellite stats are loaded
                if (typeof updateStateShading === "function") {
                    updateStateShading();
                }

                // Optimize: Only render the tables and ECharts if the FigurePageDrawer is actually open!
                const drawer = document.getElementById("FigurePageDrawer");
                if (drawer && drawer.classList.contains("open")) {
                    c.renderStatsTable(regionIDs, burnStats, smokeStats, fireStats, "StatsRegionBodyDate", modelStats);

                    if (renderDailyBarLine) renderDailyBarLine("stats-plot-for-barline-date");
                    if (renderParCoords) renderParCoords("stats-plot-for-parcoords-date");
                    if (renderDailyScatter) renderDailyScatter("stats-plot-for-scatter-date");
                }
            });
        })
        .catch(err => {
            console.error("Error updating daily stats:", err);
        });
}

export function computeRasterStateAverages(isoDate, regionIDs, modelStats) {
    const activeRasters = getActiveRasterLayers();
    if (activeRasters.length === 0) return Promise.resolve();

    return getBoundaryFeatures()
        .then(boundaryFeatures => {
            const templates = LAYER_TEMPLATES || [];
            const currentDataset = (typeof utils.getEffectiveDataset === "function") ? utils.getEffectiveDataset() : (document.getElementById("MapDataSelect")?.value || "");
            const rasterTrackingMap = {}; // Key: `${regionId}_${rasterLayer.sourceId}` -> { sum, count }

            activeRasters.forEach(rasterLayer => {
                
                const store = rasterDataStore[rasterLayer.sourceId];
                const tmpl = templates.find(t => t.id === rasterLayer.sourceId);
                const isHourly = tmpl && tmpl.duration === "hourly";
                const loadedHour = (isHourly && store) ? store.loadedHour : null;
                
                const cacheKey = (isHourly && loadedHour !== null && loadedHour !== undefined)
                    ? `${isoDate}_H${loadedHour}_${rasterLayer.sourceId}`
                    : `${isoDate}_${rasterLayer.sourceId}`;
                
                // Cache Hit check
                if (rasterCache.has(cacheKey)) {
                    const cachedData = rasterCache.get(cacheKey);
                    Object.keys(cachedData).forEach(regionId => {
                        if (!modelStats[regionId]) {
                            modelStats[regionId] = {};
                        }
                        modelStats[regionId][rasterLayer.sourceId] = cachedData[regionId].avg;
                        modelStats[regionId][cachedData[regionId].fieldKey] = cachedData[regionId].avg;
                    });
                    return;
                }

                if (!store || !store.grayscale) return;
                if (!tmpl) return;

                // Bounding box of the raster extent
                const rMinLng = store.xmin;
                const rMaxLng = store.xmax;
                const rMinLat = store.ymin;
                const rMaxLat = store.ymax;

                const cachedDataForLayer = {};

                regionIDs.forEach(regionId => {
                    // Find the boundary feature corresponding to this regionId (state name)
                    const feat = boundaryFeatures.find(f => f.properties.ID === regionId);
                    if (!feat || !feat.geometry) return;

                    const { minLng, maxLng, minLat, maxLat } = getPolygonBBox(feat.geometry);

                    // Quick overlap check with the raster extent
                    if (maxLng < rMinLng || minLng > rMaxLng || maxLat < rMinLat || minLat > rMaxLat) {
                        return; // Outside raster coverage
                    }

                    // Clamp bounding box to raster extent
                    const clampLngMin = Math.max(minLng, rMinLng);
                    const clampLngMax = Math.min(maxLng, rMaxLng);
                    const clampLatMin = Math.max(minLat, rMinLat);
                    const clampLatMax = Math.min(maxLat, rMaxLat);

                    // Convert coordinates to pixel bounds
                    const minPxX = Math.max(0, Math.floor(((clampLngMin - rMinLng) / store.lngRange) * store.imgW));
                    const maxPxX = Math.min(store.imgW - 1, Math.ceil(((clampLngMax - rMinLng) / store.lngRange) * store.imgW));

                    const latToMercY = (l) => Math.log(Math.tan((Math.PI / 4) + (l * Math.PI / 360)));
                    const mercYMinClamped = latToMercY(clampLatMin);
                    const mercYMaxClamped = latToMercY(clampLatMax);

                    const maxPxY = Math.min(store.imgH - 1, Math.ceil(((store.mercYMax - mercYMinClamped) / store.mercYRange) * store.imgH));
                    const minPxY = Math.max(0, Math.floor(((store.mercYMax - mercYMaxClamped) / store.mercYRange) * store.imgH));

                    let sum = 0;
                    let count = 0;

                    const totalPixels = (maxPxX - minPxX) * (maxPxY - minPxY);
                    let step = 1;
                    if (totalPixels > 100) {
                        step = Math.ceil(Math.sqrt(totalPixels / 100));
                    }

                    for (let pxY = minPxY; pxY <= maxPxY; pxY += step) {
                        const mercY = store.mercYMax - (pxY / store.imgH) * store.mercYRange;
                        const lat = (360 / Math.PI) * Math.atan(Math.exp(mercY)) - 90;

                        for (let pxX = minPxX; pxX <= maxPxX; pxX += step) {
                            const lng = rMinLng + (pxX / store.imgW) * store.lngRange;

                            if (pointInGeometry([lng, lat], feat.geometry)) {
                                const gray = store.grayscale[pxY * store.imgW + pxX];
                                const isGeoscf = rasterLayer.sourceId.includes("geoscf");
                                if (gray !== null && gray !== undefined && (gray !== 0 || isGeoscf)) {
                                    const realValue = store.metadata.min_val + (gray / 255) * (store.metadata.max_val - store.metadata.min_val);
                                    let displayValue = realValue;
                                    if (rasterLayer.sourceId.includes("tempo") || rasterLayer.sourceId.includes("tropomi")) {
                                        displayValue = realValue / 1e14;
                                    } else if (rasterLayer.sourceId.includes("hrrr-colmd")) {
                                        displayValue = realValue / 1e3;
                                    }
                                    sum += displayValue;
                                    count++;
                                }
                            }
                        }
                    }

                    if (count > 0) {
                        const avg = sum / count;
                        if (!modelStats[regionId]) {
                            modelStats[regionId] = {};
                        }
                        // Store under both layer id (for table) and field key (for daily plots)
                        modelStats[regionId][rasterLayer.sourceId] = avg;

                        const fieldKey = (typeof tmpl.field === "function") ? tmpl.field(currentDataset) : tmpl.field;
                        modelStats[regionId][fieldKey] = avg;

                        // Save tracking data for aggregates
                        rasterTrackingMap[`${regionId}_${rasterLayer.sourceId}`] = { sum, count };

                        // Add to cached dataset
                        cachedDataForLayer[regionId] = { avg, fieldKey };
                    }
                });

                // Aggregate values for US, US_conus, and Canada
                const usStatesList = common.usStates || [];
                const caStatesList = common.caStates || [];

                let usSum = 0, usCount = 0;
                let conusSum = 0, conusCount = 0;
                let caSum = 0, caCount = 0;

                regionIDs.forEach(regionId => {
                    const trackingKey = `${regionId}_${rasterLayer.sourceId}`;
                    const track = rasterTrackingMap[trackingKey];
                    if (!track) return;

                    if (usStatesList.includes(regionId)) {
                        usSum += track.sum;
                        usCount += track.count;

                        if (regionId !== "Alaska" && regionId !== "Hawaii") {
                            conusSum += track.sum;
                            conusCount += track.count;
                        }
                    } else if (caStatesList.includes(regionId)) {
                        caSum += track.sum;
                        caCount += track.count;
                    }
                });

                const saveAgg = (aggId, sum, count) => {
                    if (count > 0) {
                        const avg = sum / count;
                        if (!modelStats[aggId]) modelStats[aggId] = {};
                        modelStats[aggId][rasterLayer.sourceId] = avg;
                        
                        const fieldKey = (typeof tmpl.field === "function") ? tmpl.field(currentDataset) : tmpl.field;
                        modelStats[aggId][fieldKey] = avg;

                        cachedDataForLayer[aggId] = { avg, fieldKey };
                    }
                };

                saveAgg("US", usSum, usCount);
                saveAgg("US_conus", conusSum, conusCount);
                saveAgg("Canada", caSum, caCount);

                // Store in global cache
                rasterCache.set(cacheKey, cachedDataForLayer);

                // Limit cache size to 50 entries to prevent memory leak
                if (rasterCache.size > 50) {
                    const oldestKey = rasterCache.keys().next().value;
                    rasterCache.delete(oldestKey);
                }
            });

            return Promise.resolve();
        })
        .catch(err => {
            console.error("Error calculating raster state averages:", err);
            return Promise.resolve();
        });
}

// Register callback
common.setOnUpdateDailyStats(updateDailyStats);

