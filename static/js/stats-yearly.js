
import { DATA_IMPORT_METHOD } from "./layers-def.js";
import * as utils from "./utils.js";
import {
    createBurnStats, createSmokeStats, createFireStats,
    renderStatsTable, setCurrentMonthKey, currentMonthKey,
    setOnUpdateYearStats
} from "./stats-common.js";
import { renderHeatmap } from "./stats-plot-yr-heat.js";
import { renderLinePlot } from "./stats-plot-yr-line.js";

export const yearStatsCache = {
    burn: {},
    smoke: {},
    fire: {}
};

function loadYearGeneric(options) {
    const {
        isoDate, regionIDs, dataset, urlFunc,
        fallbackData, initStatsFunc, parseFunc,
        layerId, month = "all", cacheKey
    } = options;

    if (layerId) {
        const checkbox = document.getElementById(layerId);
        if (checkbox && !checkbox.checked) {
            return Promise.resolve(initStatsFunc(regionIDs));
        }
    }

    if (!dataset || !urlFunc) {
        console.error("Invalid yearly dataset or URL function");
        return Promise.resolve({});
    }

    const year = isoDate.slice(0, 4);
    if (cacheKey && yearStatsCache[cacheKey]?.[year]) {
        const cachedData = yearStatsCache[cacheKey][year];
        const cachedStats = initStatsFunc(regionIDs);
        parseFunc(cachedData, regionIDs, cachedStats, month);
        return Promise.resolve(cachedStats);
    }

    const url = urlFunc(dataset, isoDate);
    if (!url) {
        console.error("Invalid date:", isoDate);
        return Promise.resolve({});
    }

    const stats = initStatsFunc(regionIDs);

    return utils.fetchJson(url, fallbackData).then(data => {
        if (cacheKey && yearStatsCache[cacheKey]) {
            yearStatsCache[cacheKey][year] = data;
        }
        parseFunc(data, regionIDs, stats, month);
        return stats;
    });
}

function parseBurnYearly(data, regionIDs, stats, monthKey) {
    if (!Array.isArray(data) || data.length === 0) return;
    const targetMonth = monthKey === "all" ? 13 : Number(monthKey);
    const row = data.find(d => Number(d.month) === targetMonth);
    if (!row || typeof row !== "object") return;

    regionIDs.forEach(id => {
        if (Object.prototype.hasOwnProperty.call(row, id)) {
            const v = row[id];
            stats[id] = Number(v) || 0;
        }
    });
}

function parseSmokeYearly(data, regionIDs, stats, monthKey) {
    if (!Array.isArray(data) || data.length === 0) return;
    const targetMonth = monthKey === "all" ? 13 : Number(monthKey);
    data.forEach(item => {
        if (Number(item.month) !== targetMonth) return;
        const cat = String(item.category || "").toLowerCase();
        if (!["light", "medium", "heavy"].includes(cat)) return;

        regionIDs.forEach(id => {
            if (item[id] !== undefined) {
                stats[id][cat] = Number(item[id]) || 0;
            }
        });
    });
}

function parseFireYearly(data, regionIDs, stats, monthKey) {
    if (!Array.isArray(data) || data.length === 0) return;
    const targetMonth = monthKey === "all" ? 13 : Number(monthKey);
    data.forEach(item => {
        if (Number(item.month) !== targetMonth) return;
        const cat = String(item.category || "").toLowerCase();
        regionIDs.forEach(id => {
            if (!Object.prototype.hasOwnProperty.call(item, id)) return;
            const v = Number(item[id]) || 0;
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
        isoDate,
        regionIDs,
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
        isoDate,
        regionIDs,
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
        isoDate,
        regionIDs,
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
    const tableYear = document.getElementById("StatsInputYear");
    const tableMonth = monthKey || "all";

    if (tableYear) {
        const year = isoDate.slice(0, 4);
        if (tableYear.dataset.yearValue !== year) {
            tableYear.dataset.yearValue = year;
            tableYear.innerHTML = `<span class="slot-roll">${utils.ESML(year)}</span>`;
        }
    }

    Promise.all([
        loadYearBurn(isoDate, regionIDs, tableMonth),
        loadYearSmoke(isoDate, regionIDs, tableMonth),
        loadYearFire(isoDate, regionIDs, tableMonth)
    ])
        .then(results => {
            const burnStats = results[0] || createBurnStats(regionIDs);
            const smokeStats = results[1] || createSmokeStats(regionIDs);
            const fireStats = results[2] || createFireStats(regionIDs);

            renderStatsTable(regionIDs, burnStats, smokeStats, fireStats, "StatsRegionBodyYear");

            if (currentMonthKey === "all") {
                if (renderLinePlot) renderLinePlot("stats-plot-for-line-year");
                if (renderHeatmap) renderHeatmap("stats-plot-for-heatmap-year");
            }
        })
        .catch(err => {
            console.error("Error updating yearly stats:", err);
        });
}

// Register callback
setOnUpdateYearStats(updateYearStats);

