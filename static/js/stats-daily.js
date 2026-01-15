
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
var dailyCache = {
    burn: {},
    smoke: {},
    fire: {}
};

function loadDailyGeneric(options) {
    var isoDate = options.isoDate;
    var regionIDs = options.regionIDs;
    var dataset = options.dataset;
    var urlFunc = options.urlFunc;
    var fallbackData = options.fallbackData;
    var initStatsFunc = options.initStatsFunc;
    var parseFunc = options.parseFunc;
    var layerId = options.layerId;
    var cacheKey = options.cacheKey;

    if (layerId) {
        var checkbox = document.getElementById(layerId);
        if (checkbox && !checkbox.checked) {
            return Promise.resolve(initStatsFunc(regionIDs));
        }
    }

    var dateKey = isoDate;
    if (cacheKey && dailyCache[cacheKey] && dailyCache[cacheKey][dateKey]) {
        var cachedData = dailyCache[cacheKey][dateKey];
        var cachedStats = initStatsFunc(regionIDs);
        var regionSet = new Set(regionIDs);
        parseFunc(cachedData, regionSet, cachedStats);
        return Promise.resolve(cachedStats);
    }

    if (!dataset || !urlFunc) {
        console.error("Invalid dataset or URL function");
        return Promise.resolve({});
    }

    var url = urlFunc(dataset, isoDate);
    if (!url) {
        return Promise.resolve({});
    }

    var regionSet = new Set(regionIDs);
    var stats = initStatsFunc(regionIDs);

    return utils.fetchJson(url, fallbackData).then(function (data) {
        if (cacheKey && dailyCache[cacheKey]) {
            dailyCache[cacheKey][dateKey] = data;
        }
        parseFunc(data, regionSet, stats);
        return stats;
    });
}

function parseBurnDaily(data, regionSet, stats) {
    if (data && Array.isArray(data.features)) {
        data.features.forEach(function (fi) {
            var p = fi.properties || {};
            var id = p.ID;
            if (!regionSet.has(id)) return;
            var area = Number(p.area_km2) || 0;
            stats[id] += area;
        });
    }
}

function parseSmokeDaily(data, regionSet, stats) {
    if (Array.isArray(data)) {
        data.forEach(function (item) {
            var id = item.ID;
            if (!regionSet.has(id)) return;
            var cat = String(item.category || "").toLowerCase();
            var area = Number(item.area_km2) || 0;
            if (stats[id] && Object.prototype.hasOwnProperty.call(stats[id], cat)) {
                stats[id][cat] += area;
            }
        });
    }
}

function parseFireDaily(data, regionSet, stats) {
    if (Array.isArray(data)) {
        data.forEach(function (item) {
            var id = item.ID;
            if (!regionSet.has(id)) return;
            var cnt = Number(item.n_fires) || 0;
            var frp = Number(item.FRP) || 0;
            stats[id].count += cnt;
            stats[id].frpTotal += frp;
            stats[id].n += 1;
        });
    }
}

export function loadDailyBurn(isoDate, regionIDs) {
    if (modelStatsCache && modelStatsCache.burn) {
        console.log("Using cached burn stats from loader.js for burn.");
        var cached = modelStatsCache.burn;
        var stats = common.createBurnStats(regionIDs);
        regionIDs.forEach(function (id) {
            if (cached[id] && cached[id].burn !== undefined) {
                stats[id] = cached[id].burn;
            }
        });
        return Promise.resolve(stats);
    }
    return loadDailyGeneric({
        isoDate: isoDate,
        regionIDs: regionIDs,
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
    var createFunc = (common && common.createModelStats) ? common.createModelStats : function (ids) {
        var out = {}; ids.forEach(function (i) { out[i] = {}; }); return out;
    };
    var modelStats = createFunc(regionIDs);

    regionIDs.forEach(function (id) {
        var regionData = regionStats ? regionStats[id] : null;
        if (regionData) {
            // Filter out non-model keys
            var exclude = ["id", "burn", "smokeLight", "smokeMedium", "smokeHeavy", "fireCount", "fireFrp"];
            Object.keys(regionData).forEach(function (k) {
                if (exclude.indexOf(k) === -1) {
                    modelStats[id][k] = regionData[k];
                }
            });
        }
    });
    return Promise.resolve(modelStats);
}

export function loadDailySmoke(isoDate, regionIDs) {
    return loadDailyGeneric({
        isoDate: isoDate,
        regionIDs: regionIDs,
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
        isoDate: isoDate,
        regionIDs: regionIDs,
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
    regionIDs.forEach(function (id) {
        var burn = (burnStats[id] !== undefined) ? burnStats[id] : null;
        var smoke = smokeStats[id] || { light: null, medium: null, heavy: null };
        var fire = fireStats[id] || { count: null, frpTotal: null, n: 0 };
        var fireFrp = (fire.n > 0 && fire.frpTotal !== null) ? fire.frpTotal / fire.n : null;
        var existing = regionStats[id] || {};
        regionStats[id] = Object.assign({}, existing, {
            id: id,
            burn: burn,
            smokeLight: (smoke.light !== undefined) ? smoke.light : null,
            smokeMedium: (smoke.medium !== undefined) ? smoke.medium : null,
            smokeHeavy: (smoke.heavy !== undefined) ? smoke.heavy : null,
            fireCount: (fire.count !== undefined) ? fire.count : null,
            fireFrp: fireFrp
        });
    });
}

export function updateDailyStats(isoDate, regionIDs) {
    var tableDate = document.getElementById("StatsInputDate");
    if (tableDate) {
        var displayStr = utils.ESML(isoDate);

        // Check if any active dataset has hourly duration using activeSources state
        var hasHourly = activeSources.some(function (sourceKey) {
            var ds = DATA_IMPORT_METHOD[sourceKey];
            return ds && ds.duration === "hourly";
        });

        if (hasHourly) {
            var utcHour = airnowGetCurrentTime();
            var localHour = utcToLocal(utcHour);
            displayStr += " " + String(localHour).padStart(2, "0") + ":00";
        }
        
        tableDate.innerHTML = "<span class='slot-roll'>" + displayStr + "</span>";
    }

    Promise.all([
        loadDailyBurn(isoDate, regionIDs),
        loadDailySmoke(isoDate, regionIDs),
        loadDailyFire(isoDate, regionIDs),
        loadDailyModel(regionIDs)
    ])
        .then(function (results) {
            // Re-fetch common if it was initially undefined
            var c = common;
            var burnStats = results[0] || c.createBurnStats(regionIDs);
            var smokeStats = results[1] || c.createSmokeStats(regionIDs);
            var fireStats = results[2] || c.createFireStats(regionIDs);
            var modelStats = results[3] || c.createModelStats(regionIDs);

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
        .catch(function (err) {
            console.error("Error updating daily stats:", err);
        });
}

// Register callback
common.setOnUpdateDailyStats(updateDailyStats);

