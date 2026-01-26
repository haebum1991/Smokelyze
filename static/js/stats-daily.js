
import { DATA_IMPORT_METHOD } from "./layers-def.js";
import * as utils from "./utils.js";
import * as common from "./stats-common.js";
import { regionStats } from "./layers-state.js";
import { activeSources } from "./loader-state.js";
import { modelStatsCache } from "./loader.js";
import { renderDailyBarLine } from "./stats-plot-dy-barline.js";
import { renderParCoords } from "./stats-plot-dy-parcoords.js";
import { renderDailyScatter } from "./stats-plot-dy-scatter.js";
import { updateStateColors } from "./layers-colors.js";
import { airnowGetCurrentTime } from "./airnow.js";
import { utcToLocal } from "./ui-time.js";

// No App ref
const dailyCache = {
    burn: {},
    smoke: {},
    fire: {}
};

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

            saveRegionStats(regionIDs, burnStats, smokeStats, fireStats);

            // Update state colors after satellite stats are loaded
            if (typeof updateStateColors === "function") {
                updateStateColors();
            }

            c.renderStatsTable(regionIDs, burnStats, smokeStats, fireStats, "StatsRegionBodyDate", modelStats);

            if (renderDailyBarLine) renderDailyBarLine("stats-plot-for-barline-date");
            if (renderParCoords) renderParCoords("stats-plot-for-parcoords-date");
            if (renderDailyScatter) renderDailyScatter("stats-plot-for-scatter-date");
        })
        .catch(err => {
            console.error("Error updating daily stats:", err);
        });
}

// Register callback
common.setOnUpdateDailyStats(updateDailyStats);

