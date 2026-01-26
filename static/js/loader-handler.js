
/**
 * 비즈니스 로직: 데이터 로딩, 관련 이벤트 바인딩, 각 모듈(Fetcher, State, UI) 간의 실행 순서를 제어
 */

import * as utils from "./utils.js";
import { DATA_IMPORT_METHOD, ExcludeLayerGroups, DATASET_SOURCE_MAP } from "./layers-def.js";
import { map } from "./map-init.js";
import { saveDate, saveLayerFlag, state } from "./ui-state.js";
import { auth } from "./fb-init.js";
import { triggerRefresh, clearPlotSelectionForLayer } from "./stats-common.js";
import { ensureLayers, applyLayerToggles } from "./layers-handler.js";
import { EMPTY_FC } from "./layers-constants.js";
import { regionStats } from "./layers-state.js";
import { showErrorToast, toggleSpinner, updateWildfireNewsList } from "./loader-ui.js";
import { fetchGeoJSON } from "./loader-fetch.js";
import {
    loadedSources, loadedGeoJSON, modelStatsCache, activeSources,
    metricsMap, COUNT_METRICS, initializeMetrics, clearModelStats,
    resetLoadedSources, mergeModelStats
} from "./loader-state.js";

// ---- [External data] AirNow ----
import { airnowLoadData } from "./airnow-loader.js";
import { showTimeControls, hideTimeControls } from "./ui-time.js";
import { airnowHasActiveLayers } from "./airnow.js";
// ---- [External data] AirNow ----

export async function loadSourceData(sourceKey, isoDate) {
    initializeMetrics();

    const publishedSources = ExcludeLayerGroups.statsSources;
    const isPublishedData = publishedSources.includes(sourceKey);

    if (isPublishedData && !auth.currentUser) {
        console.warn(`Blocking data load for ${sourceKey} - Login required for Published Data.`);
        const ds = DATA_IMPORT_METHOD[sourceKey] || Object.values(DATA_IMPORT_METHOD).find(d => d.source === sourceKey);
        if (ds && ds.source) {
            map.getSource(ds.source)?.setData(EMPTY_FC);
        }

        clearModelStats();
        return;
    }

    if (loadedSources[sourceKey] === isoDate && loadedGeoJSON[sourceKey] !== null) {
        if (modelStatsCache[sourceKey]) {
            console.log("Restoring cached stats for:", sourceKey);
            mergeModelStats(modelStatsCache[sourceKey]);
        }

        if (sourceKey === "wildfire_news" && loadedGeoJSON[sourceKey]) {
            updateWildfireNewsList(loadedGeoJSON[sourceKey].features);
        }

        if (utils.refreshHighlight) {
            utils.refreshHighlight();
        }
        return;
    }

    const ds = DATA_IMPORT_METHOD[sourceKey] || Object.values(DATA_IMPORT_METHOD).find(d => d.source === sourceKey);
    if (!ds) return;

    ensureLayers();

    if (ds.firebase) {
        return;
    }

    const GZIP_DATASETS = ExcludeLayerGroups.formatGzip
    const isGzipDataset = GZIP_DATASETS.includes(sourceKey);

    let url;
    if (isGzipDataset) {
        url = utils.urlByDateGZfile(ds, isoDate);
    } else {
        url = utils.urlByDateGeo(ds, isoDate);
    }

    if (!url) return;

    if (loadedSources[sourceKey] === isoDate && utils.isRecentlyFailed && utils.isRecentlyFailed(url)) {
        handleLoadingError(sourceKey, isoDate);
        return;
    }

    try {
        let data = await fetchGeoJSON(url);
        if (!data) throw new Error("Failed to load data for " + sourceKey);

        const CALC_SOURCES = ExcludeLayerGroups.calcSources

        if (CALC_SOURCES.includes(sourceKey) && data.features) {
            data.features.forEach(f => {
                const p = f.properties;

                if (sourceKey !== "epa_ember") {
                    const condition = (p.MDA8O3_resids > p.p975) && (p.smoke === 1);
                    p.smoke_p975 = condition ? 1 : 0;

                    if (p.edm_MDA8O3_resids !== undefined) {
                        const conditionEdm = (p.edm_MDA8O3_resids > p.edm_p975) && (p.smoke === 1);
                        p.edm_smoke_p975 = conditionEdm ? 1 : 0;

                        if (p.smoke == 0) {
                            p.edm_SMO = null;
                        }
                    }

                    if (p.smoke == 0) {
                        p.SMO = null;
                    }
                }

                const conditionExd = p.MDA8O3 > 70;
                const conditionExd_ember = (p.MDA8O3 > 70) && (p.smoke === 1);
                const conditionExd_v2 = (p.MDA8O3 > 70) && (p.smoke === 1) && (p.MDA8O3_resids > p.p975);
                let conditionExd_v2_edm = false;
                if (p.edm_MDA8O3_resids !== undefined) {
                    conditionExd_v2_edm = (p.MDA8O3 > 70) && (p.smoke === 1) && (p.edm_MDA8O3_resids > p.edm_p975);
                }

                p.exceedance = 0;
                p.edm_exceedance = 0;

                if (conditionExd) {
                    p.exceedance = 1;
                    p.edm_exceedance = 1;

                    if (sourceKey === "epa_ember") {
                        if (conditionExd_ember) {
                            p.exceedance = 2;
                        }
                    } else {
                        if (conditionExd_v2) {
                            p.exceedance = 2;
                        }
                        if (p.edm_MDA8O3_resids !== undefined) {
                            if (conditionExd_v2_edm) {
                                p.edm_exceedance = 2;
                            }
                        }
                    }
                }
            });
        }

        if (sourceKey === "pm_cbsa" && data.features) {
            data.features.forEach(f => {
                const p = f.properties;
                p.exceedance_m0p5m = 0;
                p.exceedance_m1p0m = 0;

                const pmVal = Number(p["PM2.5"]);
                if (!isNaN(pmVal) && pmVal > 9) {
                    const condExd_m0p5m = (p.smoke_m0p5m === 1);
                    const condExd_m1p0m = (p.smoke_m1p0m === 1);
                    p.exceedance_m0p5m = condExd_m0p5m ? 2 : 1;
                    p.exceedance_m1p0m = condExd_m1p0m ? 2 : 1;
                }
            });
        }

        if (sourceKey === "smoke" && Array.isArray(ds.excludeIDs) && Array.isArray(data.features)) {
            data.features = data.features.filter(
                f => !ds.excludeIDs.includes(f?.properties?.category)
            );
        }

        if (sourceKey === "burn" && data.features) {
            data.features = data.features.filter(
                f => !ds.excludeIDs.includes(f?.properties?.ID)
            );

            const burnStatsByRegion = {};
            data.features.forEach(f => {
                const p = f.properties;
                if (p && p.ID) {
                    if (!burnStatsByRegion[p.ID]) burnStatsByRegion[p.ID] = { burn: 0 };
                    burnStatsByRegion[p.ID].burn += (Number(p.area_km2) || 0);
                }
            });

            modelStatsCache.burn = burnStatsByRegion;
            mergeModelStats(burnStatsByRegion);
        }

        if (sourceKey === "wildfire_nifc" && data.features) {
            const stateMap = {
                "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas", "CA": "California",
                "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware", "FL": "Florida", "GA": "Georgia",
                "HI": "Hawaii", "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "IA": "Iowa",
                "KS": "Kansas", "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
                "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi", "MO": "Missouri",
                "MT": "Montana", "NE": "Nebraska", "NV": "Nevada", "NH": "New Hampshire", "NJ": "New Jersey",
                "NM": "New Mexico", "NY": "New York", "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio",
                "OK": "Oklahoma", "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
                "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah", "VT": "Vermont",
                "VA": "Virginia", "WA": "Washington", "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming"
            };
            data.features.forEach(f => {
                if (f.properties && f.properties.POOState) {
                    let s = f.properties.POOState;
                    if (s.startsWith("US-")) {
                        const abbr = s.split("-")[1];
                        if (stateMap[abbr]) f.properties.state = stateMap[abbr];
                    }
                }
            });
        }

        if (sourceKey === "wildfire_news" && data.features) {
            data.features.forEach(f => {
                const p = f.properties;
                const coords = f.geometry && f.geometry.coordinates;
                const canShow = Array.isArray(coords) && coords.length >= 2;

                if (canShow) {
                    const range = 0.5;
                    f.geometry.coordinates[0] += (Math.random() - 0.5) * range;
                    f.geometry.coordinates[1] += (Math.random() - 0.5) * range;
                    f._showOnMap = true;
                } else {
                    f._showOnMap = false;
                }
            });
            updateWildfireNewsList(data.features);
        }

        const mapSource = map.getSource(ds.source);
        if (mapSource) {
            if (sourceKey === "wildfire_news") {
                const filteredData = Object.assign({}, data, {
                    features: data.features.filter(f => f._showOnMap)
                });
                mapSource.setData(filteredData);
            } else {
                mapSource.setData(data);
            }

            loadedSources[sourceKey] = isoDate;
            loadedGeoJSON[sourceKey] = data;

            if (utils.refreshHighlight) {
                utils.refreshHighlight();
            }
        }

        const STATS_SOURCES = ExcludeLayerGroups.statsSources;

        if (STATS_SOURCES.includes(sourceKey) && data.features) {
            const stateSums = {};
            const computedStatsByState = {};

            stateSums["US"] = {};
            stateSums["US_conus"] = {};

            Object.keys(metricsMap).forEach(k => {
                stateSums["US"][k] = { sum: 0, count: 0 };
                stateSums["US_conus"][k] = { sum: 0, count: 0 };
            });

            const keysToReset = [];
            Object.keys(metricsMap).forEach(key => {
                const p = metricsMap[key];
                const fieldName = (typeof p === "function") ? p(sourceKey) : p;
                keysToReset.push(fieldName);
            });

            Object.keys(regionStats).forEach(st => {
                if (!regionStats[st]) return;
                keysToReset.forEach(k => {
                    if (regionStats[st][k] !== undefined) {
                        regionStats[st][k] = null;
                    }
                });
            });

            const dsMap = DATASET_SOURCE_MAP || {};
            const dsKey = Object.keys(dsMap).find(k => dsMap[k] === sourceKey) || sourceKey;

            const resolvedMetrics = [];
            Object.keys(metricsMap).forEach(key => {
                const p = metricsMap[key];
                const fieldName = (typeof p === "function") ? p(dsKey) : p;
                resolvedMetrics.push({ key, field: fieldName });
            });

            data.features.forEach(fi => {
                const s = fi.properties.state;
                if (!s) return;

                if (!stateSums[s]) {
                    stateSums[s] = {};
                    Object.keys(metricsMap).forEach(k => {
                        stateSums[s][k] = { sum: 0, count: 0 };
                    });
                }

                const p = fi.properties;
                const isConus = (s !== "Alaska" && s !== "Hawaii" && s !== "Canada" && s !== "Mexico");

                resolvedMetrics.forEach(m => {
                    const val = p[m.field];

                    if (val !== undefined && val !== null && !isNaN(Number(val))) {
                        const v = Number(val);
                        stateSums[s][m.key].sum += v;
                        stateSums[s][m.key].count++;

                        stateSums["US"][m.key].sum += v;
                        stateSums["US"][m.key].count++;

                        if (isConus) {
                            stateSums["US_conus"][m.key].sum += v;
                            stateSums["US_conus"][m.key].count++;
                        }

                        if (m.key.startsWith("ExcDays")) {
                            const inc1 = (v === 1 ? 1 : 0);
                            const inc2 = (v === 2 ? 1 : 0);

                            stateSums[s][m.key].c1 = (stateSums[s][m.key].c1 || 0) + inc1;
                            stateSums[s][m.key].c2 = (stateSums[s][m.key].c2 || 0) + inc2;

                            stateSums["US"][m.key].c1 = (stateSums["US"][m.key].c1 || 0) + inc1;
                            stateSums["US"][m.key].c2 = (stateSums["US"][m.key].c2 || 0) + inc2;

                            if (isConus) {
                                stateSums["US_conus"][m.key].c1 = (stateSums["US_conus"][m.key].c1 || 0) + inc1;
                                stateSums["US_conus"][m.key].c2 = (stateSums["US_conus"][m.key].c2 || 0) + inc2;
                            }
                        }
                    }
                });
            });

            Object.keys(stateSums).forEach(st => {
                const metricObj = stateSums[st];
                const newStats = {};
                let hasData = false;

                Object.keys(metricsMap).forEach(key => {
                    const item = metricObj[key];

                    if (item && item.count > 0) {
                        if (COUNT_METRICS.includes(key)) {
                            newStats[key] = `${item.sum} / ${item.count}`;
                        } else {
                            newStats[key] = item.sum / item.count;
                        }

                        if (key.startsWith("ExcDays")) {
                            newStats[`${key}_c1`] = item.c1 || 0;
                            newStats[`${key}_c2`] = item.c2 || 0;
                        }
                        hasData = true;
                    } else {
                        newStats[key] = null;
                    }
                });

                if (hasData) {
                    if (sourceKey === "gam_v2") {
                        newStats.label_display = "TMAX (K)";
                    } else {
                        newStats.label_display = "TMAX (°C)";
                    }
                    computedStatsByState[st] = newStats;
                }
            });

            modelStatsCache[sourceKey] = computedStatsByState;
            mergeModelStats(computedStatsByState);
        }

    } catch (e) {
        console.warn(`loadSourceData failed [${sourceKey}]: `, e);
        handleLoadingError(sourceKey, isoDate, ds);
    }
}

/**
 * Consolidates error feedback (Uncheck checkbox + Error Toast)
 */
function handleLoadingError(sourceKey, isoDate, ds = null) {
    // 1. Uncheck the corresponding checkbox
    document.querySelectorAll("input[type=checkbox][id^='layer-']").forEach(cb => {
        const shortId = cb.id.replace("layer-", "");
        const currentDataset = document.getElementById("MapDataSelect")?.value;
        const config = DATA_IMPORT_METHOD[`${shortId}-${currentDataset}`] || DATA_IMPORT_METHOD[shortId];
        if (config && config.source === sourceKey) {
            cb.checked = false;
        }
    });

    // 2. Clear Source data if config is provided
    if (ds?.source) {
        map.getSource(ds.source)?.setData(EMPTY_FC);
    }

    // 3. Update global tracking placeholders
    loadedSources[sourceKey] = isoDate;
    loadedGeoJSON[sourceKey] = null;

    if (utils.refreshHighlight) {
        utils.refreshHighlight();
    }

    // 4. Show error toast based on source type
    if (["smoke", "fire"].includes(sourceKey)) {
        showErrorToast(`
          No data found for this date (${utils.ESML(isoDate)}) and dataset (${utils.ESML(sourceKey)}).
          <br>
          "HMS-smoke" and "HMS-fire" are automatically updated everyday, but 
          the latest data is from the previous day.`);
    } else if (ExcludeLayerGroups.statsSources.includes(sourceKey)) {
        showErrorToast(`
          No data found for this date (${utils.ESML(isoDate)}) and dataset (${utils.ESML(sourceKey)}).
          <br>
          Please see the detail information 
          <svg width="24" height="24" style="vertical-align: middle; stroke: white; fill: none; stroke-width: 2;">
            <use xlink:href="#icon-desc" />
          </svg>
          for the valid data period of <span style="color: #FFD700; font-weight: bold;">[Published]</span> data.`);
    } else {
        showErrorToast(`No data found for this date (${utils.ESML(isoDate)}) and dataset (${utils.ESML(sourceKey)})`);
    }

    if (sourceKey === "wildfire_news") {
        updateWildfireNewsList([]);
    }

    if (ExcludeLayerGroups.statsSources.includes(sourceKey)) {
        clearModelStats();
    }

    // 5. [추가] 체크박스가 해제되었으므로 검색 UI 상태도 새로고침
    refreshSearchUIVisibility();
}

/**
 * Re-scans checkboxes to show/hide the Site Search UI
 */
export function refreshSearchUIVisibility() {
    const searchWrapper = document.getElementById("SiteSearchWrapper");
    if (!searchWrapper) return;

    const checkboxes = document.querySelectorAll("input[type=checkbox][id^='layer-']");
    let hasSearchable = false;
    const EXCLUDED = ExcludeLayerGroups.searchSite;

    checkboxes.forEach(cb => {
        if (!cb.checked) return;
        const shortId = cb.id.replace("layer-", "");
        if (!EXCLUDED.includes(shortId)) {
            hasSearchable = true;
        }
    });

    if (hasSearchable) {
        searchWrapper.style.display = "block";
    } else {
        searchWrapper.style.display = "none";
        if (utils.clearHighlight) utils.clearHighlight();
    }
}

export async function updateAllActiveSources() {
    toggleSpinner(true);
    try {
        const isoDate = utils.currentDate();
        const currentDataset = document.getElementById("MapDataSelect")?.value;
        const checkboxes = document.querySelectorAll("input[type=checkbox][id^='layer-']");

        const sourcesToLoad = new Set();
        const activeShortIds = new Set();

        checkboxes.forEach(cb => {
            if (!cb.checked) return;

            const shortId = cb.id.replace("layer-", "");
            const contextKey = `${shortId}-${currentDataset}`;
            const globalKey = shortId;

            activeShortIds.add(shortId);

            let targetConfig = null;

            if (DATA_IMPORT_METHOD[contextKey]) {
                targetConfig = DATA_IMPORT_METHOD[contextKey];
            } else if (DATA_IMPORT_METHOD[globalKey]) {
                targetConfig = DATA_IMPORT_METHOD[globalKey];
            }

            if (targetConfig?.source) {
                sourcesToLoad.add(targetConfig.source);
            }
        });

        // Update activeSources in state so drill-down stats (AQS) can find data
        activeSources.length = 0;
        sourcesToLoad.forEach(s => activeSources.push(s));

        const publishedSources = ExcludeLayerGroups.statsSources;
        const tryingToLoadPublished = Array.from(sourcesToLoad).some(s => publishedSources.includes(s));

        // 로그인 안 되어 있고 Published data 로드 시도 시 데이터 클리어
        if (!auth.currentUser && tryingToLoadPublished) {

            // Clear all published source data to remove any cached state colors/data
            publishedSources.forEach(sourceKey => {
                const ds = DATA_IMPORT_METHOD[sourceKey] || Object.values(DATA_IMPORT_METHOD).find(d => d.source === sourceKey);
                if (ds?.source) {
                    map.getSource(ds.source)?.setData(EMPTY_FC);
                }
                // Clear from loaded state
                delete loadedSources[sourceKey];
                delete loadedGeoJSON[sourceKey];
                delete modelStatsCache[sourceKey];
            });

            // Clear all model stats to remove state colors
            clearModelStats();
        }

        // previous code before adding AirNow data
        // const promises = [];
        // sourcesToLoad.forEach(sourceKey => {
        //     promises.push(loadSourceData(sourceKey, isoDate));
        // });
        // await Promise.all(promises);

        // ---- [External data] Hourly vs Daily load synchronization ----
        const promises = [];
        let hasHourly = false;

        sourcesToLoad.forEach(sourceKey => {
            const ds = DATA_IMPORT_METHOD[sourceKey] || Object.values(DATA_IMPORT_METHOD).find(d => d.source === sourceKey);
            const duration = ds ? ds.duration : "daily";

            if (duration === "hourly") {
                hasHourly = true;
            } else {
                promises.push(loadSourceData(sourceKey, isoDate));
            }
        });

        await Promise.all(promises);

        if (hasHourly) {
            if (typeof showTimeControls === "function") showTimeControls();
            toggleSpinner(true);
            airnowLoadData(isoDate)
                .catch(e => console.error("Hourly background load failed:", e))
                .finally(() => toggleSpinner(false));
        } else {
            if (typeof hideTimeControls === "function") hideTimeControls();
        }
        // ---- [External data] Hourly vs Daily load synchronization ----

        applyLayerToggles();
        refreshSearchUIVisibility();

        if (typeof triggerRefresh === "function") {
            triggerRefresh();
        }

    } catch (e) {
        console.error("updateAllActiveSources failed", e);
    } finally {
        toggleSpinner(false);
    }
}

export function bindEvents() {
    const datePicker = document.getElementById("datePicker");
    if (datePicker) {
        const onDateChange = utils.debounce((e) => {
            if (saveDate) saveDate(e.target.value);
            resetLoadedSources(updateWildfireNewsList);
            updateAllActiveSources();
        }, 200);
        datePicker.addEventListener("change", onDateChange);
        datePicker.addEventListener("input", onDateChange);
    }

    const dataSelect = document.getElementById("MapDataSelect");
    if (dataSelect) {
        dataSelect.addEventListener("change", () => {
            const newVal = dataSelect.value;
            if (state?.currentHighlight) {
                const newSourceKey = DATASET_SOURCE_MAP[newVal] || newVal;
                state.currentHighlight.dsKey = newVal;
                state.currentHighlight.dataSource = newSourceKey;
            }

            clearModelStats();
            updateAllActiveSources();
        });
    }

    const onLayerChange = utils.debounce(() => {
        updateAllActiveSources();
    }, 200);

    document.querySelectorAll("input[type=checkbox][id^='layer-']").forEach(cb => {
        cb.addEventListener("change", () => {
            const shortId = cb.id.replace("layer-", "");
            if (saveLayerFlag) saveLayerFlag(shortId, cb.checked);

            // Published data 체크 시 로그인 확인 (사용자 클릭 이벤트 내에서 처리)
            if (cb.checked && !auth.currentUser) {
                const publishedSources = ExcludeLayerGroups.statsSources;
                const currentDataset = document.getElementById("MapDataSelect")?.value;
                const contextKey = `${shortId}-${currentDataset}`;
                const globalKey = shortId;

                let targetConfig = null;
                if (DATA_IMPORT_METHOD[contextKey]) {
                    targetConfig = DATA_IMPORT_METHOD[contextKey];
                } else if (DATA_IMPORT_METHOD[globalKey]) {
                    targetConfig = DATA_IMPORT_METHOD[globalKey];
                }

                // Published data인 경우 오버레이 표시
                if (targetConfig?.source && publishedSources.includes(targetConfig.source)) {
                    utils.showAuthOverlay();
                }
            }

            if (!cb.checked && ExcludeLayerGroups.satelliteLayers.indexOf(shortId) !== -1) {
                if (typeof clearPlotSelectionForLayer === "function") {
                    clearPlotSelectionForLayer(cb.id);
                }
            }

            onLayerChange();
        });
    });

    // ---- [External data] AirNow ----
    // AirNow time picker event listener
    const timePicker = document.getElementById("timePicker");
    if (timePicker) {
        timePicker.addEventListener("change", utils.debounce(async () => {
            if (airnowHasActiveLayers()) {
                toggleSpinner(true);
                try {
                    await airnowLoadData(utils.currentDate());
                } finally {
                    toggleSpinner(false);
                }
            }
        }, 200));
    }
    // ---- [External data] AirNow ----
}

