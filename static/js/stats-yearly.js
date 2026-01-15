
import { DATA_IMPORT_METHOD } from "./layers-def.js";
import * as utils from "./utils.js";
import {
    createBurnStats, createSmokeStats, createFireStats,
    renderStatsTable, setCurrentMonthKey, currentMonthKey,
    setOnUpdateYearStats
} from "./stats-common.js";
import { renderHeatmap } from "./stats-plot-yr-heat.js";
import { renderLinePlot } from "./stats-plot-yr-line.js";

export var yearStatsCache = {
    burn: {},
    smoke: {},
    fire: {}
};


function loadYearGeneric(options) {
    var isoDate = options.isoDate;
    var regionIDs = options.regionIDs;
    var dataset = options.dataset;
    var urlFunc = options.urlFunc;
    var fallbackData = options.fallbackData;
    var initStatsFunc = options.initStatsFunc;
    var parseFunc = options.parseFunc;
    var layerId = options.layerId;
    var monthKey = options.month || "all";
    var cacheKey = options.cacheKey;

    if (layerId) {
        var checkbox = document.getElementById(layerId);
        if (checkbox && !checkbox.checked) {
            return Promise.resolve(initStatsFunc(regionIDs));
        }
    }

    if (!dataset || !urlFunc) {
        console.error("Invalid yearly dataset or URL function");
        return Promise.resolve({});
    }

    var year = isoDate.slice(0, 4);
    if (cacheKey && yearStatsCache[cacheKey] && yearStatsCache[cacheKey][year]) {
        var cachedData = yearStatsCache[cacheKey][year];
        var cachedStats = initStatsFunc(regionIDs);
        parseFunc(cachedData, regionIDs, cachedStats, monthKey);
        return Promise.resolve(cachedStats);
    }

    var url = urlFunc(dataset, isoDate);
    if (!url) {
        console.error("Invalid date:", isoDate);
        return Promise.resolve({});
    }

    var stats = initStatsFunc(regionIDs);

    return utils.fetchJson(url, fallbackData).then(function (data) {
        if (cacheKey && yearStatsCache[cacheKey]) {
            yearStatsCache[cacheKey][year] = data;
        }
        parseFunc(data, regionIDs, stats, monthKey);
        return stats;
    });
}

function parseBurnYearly(data, regionIDs, stats, monthKey) {
    if (!Array.isArray(data) || data.length === 0) return;
    var targetMonth = monthKey === "all" ? 13 : Number(monthKey);
    var row = data.find(function (d) {
        return Number(d.month) === targetMonth;
    });
    if (!row || typeof row !== "object") return;
    regionIDs.forEach(function (id) {
        if (Object.prototype.hasOwnProperty.call(row, id)) {
            var v = row[id];
            stats[id] = Number(v) || 0;
        }
    });
}

function parseSmokeYearly(data, regionIDs, stats, monthKey) {
    if (!Array.isArray(data) || data.length === 0) return;
    var targetMonth = monthKey === "all" ? 13 : Number(monthKey);
    data.forEach(function (item) {
        if (Number(item.month) !== targetMonth) return;
        var cat = String(item.category || "").toLowerCase();
        if (!(cat === "light" || cat === "medium" || cat === "heavy")) return;
        regionIDs.forEach(function (id) {
            if (item[id] !== undefined) {
                stats[id][cat] = Number(item[id]) || 0;
            }
        });
    });
}

function parseFireYearly(data, regionIDs, stats, monthKey) {
    if (!Array.isArray(data) || data.length === 0) return;
    var targetMonth = monthKey === "all" ? 13 : Number(monthKey);
    data.forEach(function (item) {
        if (Number(item.month) !== targetMonth) return;
        var cat = String(item.category || "").toLowerCase();
        regionIDs.forEach(function (id) {
            if (!Object.prototype.hasOwnProperty.call(item, id)) return;
            var v = Number(item[id]) || 0;
            if (cat === "n_fires") {
                stats[id].count = v;
            } else if (cat === "frp") {
                stats[id].frpTotal += v;
                stats[id].n += 1;
            }
        });
    });
}

export function loadYearBurn(isoDate, regionIDs, monthKey) {
    return loadYearGeneric({
        isoDate: isoDate,
        regionIDs: regionIDs,
        dataset: DATA_IMPORT_METHOD.burn,
        urlFunc: utils.urlByYearJson,
        fallbackData: [],
        initStatsFunc: createBurnStats,
        parseFunc: parseBurnYearly,
        month: monthKey || "all",
        layerId: "layer-burn",
        cacheKey: "burn"
    });
}

export function loadYearSmoke(isoDate, regionIDs, monthKey) {
    return loadYearGeneric({
        isoDate: isoDate,
        regionIDs: regionIDs,
        dataset: DATA_IMPORT_METHOD.smoke,
        urlFunc: utils.urlByYearJson,
        fallbackData: [],
        initStatsFunc: createSmokeStats,
        parseFunc: parseSmokeYearly,
        month: monthKey || "all",
        layerId: "layer-smoke",
        cacheKey: "smoke"
    });
}

export function loadYearFire(isoDate, regionIDs, monthKey) {
    return loadYearGeneric({
        isoDate: isoDate,
        regionIDs: regionIDs,
        dataset: DATA_IMPORT_METHOD.fire,
        urlFunc: utils.urlByYearJson,
        fallbackData: [],
        initStatsFunc: createFireStats,
        parseFunc: parseFireYearly,
        month: monthKey || "all",
        layerId: "layer-fire",
        cacheKey: "fire"
    });
}

export function updateYearStats(isoDate, regionIDs, monthKey) {
    setCurrentMonthKey(monthKey);
    var tableYear = document.getElementById("StatsInputYear");
    var tableMonth = monthKey || "all";

    if (tableYear) {
        var year = isoDate.slice(0, 4);
        if (tableYear.dataset.yearValue !== year) {
            tableYear.dataset.yearValue = year;
            tableYear.innerHTML = '<span class="slot-roll">' + utils.ESML(year) + "</span>";
        }
    }

    Promise.all([
        loadYearBurn(isoDate, regionIDs, tableMonth),
        loadYearSmoke(isoDate, regionIDs, tableMonth),
        loadYearFire(isoDate, regionIDs, tableMonth)
    ])
        .then(function (results) {
            var burnStats = results[0] || createBurnStats(regionIDs);
            var smokeStats = results[1] || createSmokeStats(regionIDs);
            var fireStats = results[2] || createFireStats(regionIDs);

            renderStatsTable(regionIDs, burnStats, smokeStats, fireStats, "StatsRegionBodyYear");

            if (currentMonthKey === "all") {
                if (renderLinePlot) renderLinePlot("stats-plot-for-line-year");
                if (renderHeatmap) renderHeatmap("stats-plot-for-heatmap-year");
            }
        })
        .catch(function (err) {
            console.error("Error updating yearly stats:", err);
        });
}

// Register callback
setOnUpdateYearStats(updateYearStats);

