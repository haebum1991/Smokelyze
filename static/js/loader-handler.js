
/**
 * 비즈니스 로직: 데이터 로딩, 관련 이벤트 바인딩, 각 모듈(Fetcher, State, UI) 간의 실행 순서를 제어
 */

import * as utils from "./utils.js";
import { DATA_IMPORT_METHOD, ExcludeLayerGroups, DATASET_SOURCE_MAP, LAYER_TEMPLATES } from "./layers-def.js";
import { map } from "./map-init.js";
import { saveDate, saveLayerFlag, state } from "./ui-state.js";
import { auth } from "./fb-init.js";
import { triggerRefresh, clearPlotSelectionForLayer, usStates, caStates } from "./stats-common.js";
import { ensureLayers, applyLayerToggles } from "./layers-handler.js";
import { EMPTY_FC } from "./layers-constants.js";
import { regionStats } from "./layers-state.js";
import { updateSearchVisibility } from "./stats-data-search.js";
import { toggleSpinner, updateWildfireNewsList, showLoaderError } from "./loader-ui.js";
import { fetchGeoJSON } from "./loader-fetch.js";
import {
    loadedSources, loadedGeoJSON, modelStatsCache, activeSources,
    metricsMap, COUNT_METRICS, initializeMetrics, clearModelStats,
    resetLoadedSources, mergeModelStats
} from "./loader-state.js";
import { logUserAction } from "./fb-logging.js";

// ---- [External data] AirNow ----
import { airnowLoadData } from "./airnow-loader.js";
import { showTimeControls, hideTimeControls } from "./ui-time.js";
import { airnowHasActiveLayers } from "./airnow.js";
// ---- [External data] AirNow ----

import { 
    tempoLoadData, 
    tropomiLoadData, 
    hrrrLoadData, 
    goesLoadData,
    viirsLoadData,
    geoscfLoadData
} from "./raster-loader.js";


export async function loadSourceData(sourceKey, isoDate) {
    if (!map) return;
    initializeMetrics();

    const restrictedSources = ExcludeLayerGroups.restrictedSources;
    const isRestrictedData = restrictedSources.includes(sourceKey);

    if (isRestrictedData && !auth.currentUser) {
        console.warn(`Blocking data load for ${sourceKey} - Login required for Published Data.`);
        const ds = DATA_IMPORT_METHOD[sourceKey] || Object.values(DATA_IMPORT_METHOD).find(d => d.source === sourceKey);
        if (ds && ds.source) {
            map.getSource(ds.source)?.setData(EMPTY_FC);
        }

        clearModelStats();
        return;
    }

    const ds = DATA_IMPORT_METHOD[sourceKey] || Object.values(DATA_IMPORT_METHOD).find(d => d.source === sourceKey);
    const isHourly = ds?.duration === "hourly";
    const timeVal = document.getElementById("timePicker")?.value || "12";
    const effectiveCacheKey = isHourly ? `${isoDate}_h${timeVal}` : isoDate;

    const isCachedForDate = loadedSources[sourceKey] === effectiveCacheKey ||
        (loadedSources[sourceKey] && loadedSources[sourceKey].startsWith(`${isoDate}_lookback_`));

    if (isCachedForDate && loadedGeoJSON[sourceKey] !== null) {
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

    if (!ds) return;
    
    const liveKeys = ExcludeLayerGroups.liveKeys || [];
    if (liveKeys.includes(sourceKey)) {
        if (loadedGeoJSON[sourceKey]) {
            const targetSourceId = (ds && ds.source) ? ds.source : sourceKey;
            const mapSource = map.getSource(targetSourceId);
            if (mapSource && typeof mapSource.setData === "function") {
                mapSource.setData(loadedGeoJSON[sourceKey]);
            }
            ensureLayers();
            return;
        }
        isoDate = "LIVE";
    }

    ensureLayers();

    if (ds.firebase) {
        return;
    }

    const GZIP_DATASETS = ExcludeLayerGroups.formatGzip;
    const isGzipDataset = GZIP_DATASETS.includes(sourceKey) || GZIP_DATASETS.includes(ds.source) || Boolean(ds.gzfileBaseUrlDate);

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

        if (sourceKey === "smoke" && Array.isArray(ds.excludeIDs) && Array.isArray(data.features)) {
            data.features = data.features.filter(
                f => !ds.excludeIDs.includes(f?.properties?.category)
            );
        }

        if (sourceKey === "burn" && data.features) {
            
            // Compute stats from ALL features first (including US/US_conus/Canada aggregates)
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

            // THEN filter out aggregate polygons for map rendering
            data.features = data.features.filter(
                f => !ds.excludeIDs.includes(f?.properties?.ID)
            );
        }

        if (["wildfire_inci", "wildfire_peri", "wildfire_inci_curr", "wildfire_peri_curr"].includes(ds.source) && data.features) {
            const stateMap = {
                "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas", "CA": "California",
                "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware", "DC": "District of Columbia", "FL": "Florida", "GA": "Georgia",
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
                if (!f.properties) return;
                const rawSt = f.properties.attr_POOState || f.properties.POOState;
                if (rawSt) {
                    let s = String(rawSt).trim();
                    const abbr = s.startsWith("US-") ? s.split("-")[1] : s;
                    if (stateMap[abbr]) {
                        f.properties.state = stateMap[abbr];
                    } else if (!f.properties.state && abbr) {
                        f.properties.state = abbr;
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
        
            // [Root Fix] Tag all features with their source key for consistent tooltip handling
            if (data.features) {
                data.features.forEach(f => {
                    if (f.properties && !f.properties.dsKeyForFigure) {
                        f.properties.dsKeyForFigure = sourceKey;
                    }
                });
            }
            
            if (sourceKey === "wildfire_news") {
                const filteredData = Object.assign({}, data, {
                    features: data.features.filter(f => f._showOnMap)
                });
                mapSource.setData(filteredData);
            } else {
                mapSource.setData(data);
            }

            loadedSources[sourceKey] = effectiveCacheKey;
            loadedGeoJSON[sourceKey] = data;
            
            // [Refined] Identify which UI toggles (checkboxes) are using this source
            const currentDataset = utils.getEffectiveDataset(isoDate);
            const activeLayers = Array.from(document.querySelectorAll("input[type=checkbox][id^='layer-']:checked"))
                .map(cb => cb.id.replace("layer-", ""))
                .filter(shortId => {
                    // 1. Check direct DATA_IMPORT_METHOD mapping
                    const cfg = DATA_IMPORT_METHOD[`${shortId}-${currentDataset}`] || DATA_IMPORT_METHOD[shortId];
                    if (cfg && cfg.source === sourceKey) return true;

                    // 2. Check DATASET_SOURCE_MAP for consolidated sources (e.g. airnow-hourly-pm25 -> airnow_hourly)
                    const mapping = DATASET_SOURCE_MAP[shortId];
                    const mappedSource = (mapping && typeof mapping === "object") ? mapping.source : mapping;
                    return mappedSource === sourceKey;
                })
                .join(", ");

            logUserAction("view", {
                dataset: sourceKey,
                layer: activeLayers || sourceKey,
                date: isoDate,
                filename: url
            });
            
            if (utils.refreshHighlight) {
                utils.refreshHighlight();
            }
        }

        const restrictedSources = ExcludeLayerGroups.restrictedSources;
        const publicStatsSources = ExcludeLayerGroups.publicStatsSources;
        const allStatsSources = [...restrictedSources, ...publicStatsSources];

        if (allStatsSources.includes(sourceKey) && data.features) {
            const stateSums = {};
            const computedStatsByState = {};

            stateSums["US"] = {};
            stateSums["US_conus"] = {};
            stateSums["Canada"] = {};

            Object.keys(metricsMap).forEach(k => {
                stateSums["US"][k] = { sum: 0, count: 0 };
                stateSums["US_conus"][k] = { sum: 0, count: 0 };
                stateSums["Canada"][k] = { sum: 0, count: 0 };
            });

            const dsMap = DATASET_SOURCE_MAP || {};
            const keysToReset = [];
            const resolvedMetrics = [];

            Object.keys(metricsMap).forEach(key => {
                const tmpl = LAYER_TEMPLATES.find(t => t.id === key);
                if (!tmpl || !tmpl.datasets) return;

                // Find if this template has any dataset that maps to the loaded sourceKey
                const relevantDsKeys = tmpl.datasets.filter(dk => dsMap[dk] === sourceKey);

                // If no mapping found in DATASET_SOURCE_MAP, check for direct match (fallback)
                if (relevantDsKeys.length === 0) {
                    if (tmpl.id === sourceKey || key === sourceKey) {
                        relevantDsKeys.push(key);
                    } else {
                        return;
                    }
                }

                keysToReset.push(key);

                // Resolve the field name using the first relevant dsKey
                const dsKeyForField = relevantDsKeys[0];
                const p = metricsMap[key];
                const fieldName = (typeof p === "function") ? p(dsKeyForField) : p;
                resolvedMetrics.push({ key, field: fieldName });
            });

            Object.keys(regionStats).forEach(st => {
                if (!regionStats[st]) return;
                keysToReset.forEach(k => {
                    if (regionStats[st][k] !== undefined) {
                        regionStats[st][k] = null;
                    }
                });
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

                        // Aggregate to regional totals
                        const isUSState = usStates.includes(s);
                        const isCAState = caStates.includes(s);

                        if (isUSState) {
                            stateSums["US"][m.key].sum += v;
                            stateSums["US"][m.key].count++;

                            if (isConus) {
                                stateSums["US_conus"][m.key].sum += v;
                                stateSums["US_conus"][m.key].count++;
                            }
                        } else if (isCAState) {
                            stateSums["Canada"][m.key].sum += v;
                            stateSums["Canada"][m.key].count++;
                        }

                        if (m.key.startsWith("ExcDays")) {
                            const inc1 = (v === 1 ? 1 : 0);
                            const inc2 = (v === 2 ? 1 : 0);

                            stateSums[s][m.key].c1 = (stateSums[s][m.key].c1 || 0) + inc1;
                            stateSums[s][m.key].c2 = (stateSums[s][m.key].c2 || 0) + inc2;

                            if (isUSState) {
                                stateSums["US"][m.key].c1 = (stateSums["US"][m.key].c1 || 0) + inc1;
                                stateSums["US"][m.key].c2 = (stateSums["US"][m.key].c2 || 0) + inc2;

                                if (isConus) {
                                    stateSums["US_conus"][m.key].c1 = (stateSums["US_conus"][m.key].c1 || 0) + inc1;
                                    stateSums["US_conus"][m.key].c2 = (stateSums["US_conus"][m.key].c2 || 0) + inc2;
                                }
                            } else if (isCAState) {
                                stateSums["Canada"][m.key].c1 = (stateSums["Canada"][m.key].c1 || 0) + inc1;
                                stateSums["Canada"][m.key].c2 = (stateSums["Canada"][m.key].c2 || 0) + inc2;
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
                    } else if (keysToReset.includes(key)) {
                        // 중요: 현재 로드 중인 소스가 이 metric(id)을 담당하는 경우에만 null 할당
                        newStats[key] = null;
                        hasData = true;
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

            if (resolvedMetrics.length > 0) {
                modelStatsCache[sourceKey] = computedStatsByState;
                mergeModelStats(computedStatsByState);
            }
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
        const currentDataset = utils.getEffectiveDataset(isoDate);
        const config = DATA_IMPORT_METHOD[`${shortId}-${currentDataset}`] || DATA_IMPORT_METHOD[shortId];
        if (config && config.source === sourceKey) {
            // [User UX Disabled part]: 실패시 체크박스 해제 로직
            // cb.checked = false;
        }
    });

    // 2. Clear Source data if config is provided
    if (map && ds?.source) {
        map.getSource(ds.source)?.setData(EMPTY_FC);
    }

    // 3. Update global tracking placeholders
    loadedSources[sourceKey] = isoDate;
    loadedGeoJSON[sourceKey] = null;

    if (utils.refreshHighlight) {
        utils.refreshHighlight();
    }

    // 4. Delegate to central showLoaderError helper
    showLoaderError(sourceKey, isoDate);

    if (sourceKey === "wildfire_news") {
        updateWildfireNewsList([]);
    }

    const restrictedSources = ExcludeLayerGroups.restrictedSources;
    const publicStatsSources = ExcludeLayerGroups.publicStatsSources;
    const allStatsSources = [...restrictedSources, ...publicStatsSources];

    if (allStatsSources.includes(sourceKey)) {
        clearModelStats();
    }

    // [Refined] Update Search UI Visibility (delegated to stats-data-search.js)
    updateSearchVisibility();
}

/**
 * Utility: Wait for Firebase Auth to initialize before proceeding with permission-sensitive tasks.
 */
async function waitForAuth() {
    if (window.fbAuthReady) return auth.currentUser;
    return new Promise(resolve => {
        const check = () => {
            if (window.fbAuthReady) {
                window.removeEventListener("authStateChanged", check);
                resolve(auth.currentUser);
            }
        };
        window.addEventListener("authStateChanged", check);
        // Timeout as a fallback to prevent hanging the page (e.g. 5s)
        setTimeout(() => {
            window.removeEventListener("authStateChanged", check);
            resolve(auth.currentUser);
        }, 3000);
    });
}

export async function updateAllActiveSources() {
    console.log("[DATA-LOAD] updateAllActiveSources started...");
    
    // Ensure auth status is verified before assessing restrictions
    await waitForAuth();
    
    if (!map) return;
    toggleSpinner(true);
    try {
        const isoDate = utils.currentDate();
        const currentDataset = utils.getEffectiveDataset(isoDate);
        console.log(`[DATA-LOAD] Date: ${isoDate}, Dataset: ${currentDataset}`);
        const checkboxes = document.querySelectorAll("input[type=checkbox][id^='layer-']");
        const sourcesToLoad = new Set();
        
        // [Smart News Fetch] Load news if switch is on or drawer is open
        const newsSwitchOn = document.getElementById("layer-wildfire-news")?.checked;
        const newsDrawerOpen = document.getElementById("WFnewsDrawer")?.classList.contains("open");

        if (newsSwitchOn || newsDrawerOpen) {
            sourcesToLoad.add("wildfire_news");
        }

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
        console.log("[DATA-LOAD] Sources to fetch:", Array.from(sourcesToLoad));

        const restrictedSources = ExcludeLayerGroups.restrictedSources;
        const tryingToLoadRestricted = Array.from(sourcesToLoad).some(s => restrictedSources.includes(s));

        // Use the global fbAuthReady flag to avoid race conditions on page reload (i.e. before Firebase initializes)
        if (tryingToLoadRestricted && window.fbAuthReady && !auth.currentUser) {
            
            // Uncheck restricted checkboxes
            checkboxes.forEach(cb => {
                const shortId = cb.id.replace("layer-", "");
                const contextKey = `${shortId}-${currentDataset}`;
                const globalKey = shortId;
                const targetConfig = DATA_IMPORT_METHOD[contextKey] || DATA_IMPORT_METHOD[globalKey];

                if (targetConfig?.source && restrictedSources.includes(targetConfig.source)) {
                    cb.checked = false;
                }
            });
            
            // Clear all restricted source data to remove any cached state shading/data
            restrictedSources.forEach(sourceKey => {
                const ds = DATA_IMPORT_METHOD[sourceKey] || Object.values(DATA_IMPORT_METHOD).find(d => d.source === sourceKey);
                if (ds?.source) {
                    map.getSource(ds.source)?.setData(EMPTY_FC);
                }
                // Clear from loaded state
                delete loadedSources[sourceKey];
                delete loadedGeoJSON[sourceKey];
                delete modelStatsCache[sourceKey];
            });

            // Clear all model stats to remove state shading
            clearModelStats();
        }

        // ---- [External data] Hourly vs Daily load synchronization ----
        const promises = [];
        let hasHourly = false;

        sourcesToLoad.forEach(sourceKey => {
            const ds = DATA_IMPORT_METHOD[sourceKey] || Object.values(DATA_IMPORT_METHOD).find(d => d.source === sourceKey);
            if (ds?.duration === "hourly") hasHourly = true;

            if (!ExcludeLayerGroups.pngLayers.includes(sourceKey)) {
                promises.push(loadSourceData(sourceKey, isoDate));
            }
        });

        await Promise.all(promises);

        if (hasHourly) {
            if (typeof showTimeControls === "function") showTimeControls();

            // Load all hourly data in parallel, properly awaited
            toggleSpinner(true);
            try {
                await Promise.all([
                    airnowLoadData(isoDate),
                    tempoLoadData(isoDate),
                    tropomiLoadData(isoDate),
                    hrrrLoadData(isoDate),
                    goesLoadData(isoDate),
                    viirsLoadData(isoDate),
                    geoscfLoadData(isoDate)
                ]);
            } catch (e) {
                console.error("Hourly background load failed:", e);
            } finally {
                toggleSpinner(false);
            }
        } else {
            if (typeof hideTimeControls === "function") hideTimeControls();

            // Clear hourly data (AirNow + raster layers)
            try {
                await Promise.all([
                    airnowLoadData(isoDate),
                    tempoLoadData(isoDate),
                    tropomiLoadData(isoDate),
                    hrrrLoadData(isoDate),
                    goesLoadData(isoDate),
                    viirsLoadData(isoDate),
                    geoscfLoadData(isoDate)
                ]);
            } catch (e) {
                console.error("Hourly clear failed:", e);
            }
        }
        // ---- [External data] Hourly vs Daily load synchronization ----
        
        ensureLayers(); // Ensure layers exist before toggling visibility
        applyLayerToggles();
        updateSearchVisibility();

        if (typeof triggerRefresh === "function") {
            triggerRefresh();
        }

    } catch (e) {
        console.error("updateAllActiveSources failed", e);
    } finally {
        toggleSpinner(false);
        window.dispatchEvent(new Event("map-data-loaded"));
    }
}

function bindEventsLoaderHandler() {
    console.log("[BIND-EVENTS] Starting event binding...");
    const datePicker = document.getElementById("datePicker");
    if (datePicker) {
        const onDateChange = utils.debounce((e) => {
            if (saveDate) saveDate(e.target.value);
            resetLoadedSources(updateWildfireNewsList);
            
            // Update timezone label (PST/PDT) based on the newly selected date
            import("./ui-time.js").then(module => {
                module.updateTimezoneLabel(e.target.value);
            });
            
            // Auto-align dataset dropdown based on selected year
            const targetDateStr = e.target.value;
            let datasetChanged = false;
            if (targetDateStr) {
                const year = parseInt(targetDateStr.split("-")[0], 10);
                const dataSelect = document.getElementById("MapDataSelect");
                if (dataSelect) {
                    const currentVal = dataSelect.value;
                    let newVal = currentVal;
                    if (year >= 2025) {
                        if (currentVal === "gam-v2") {
                            newVal = "gam-v2-pred";
                        } else if (currentVal === "pm-cbsa") {
                            newVal = "pm-cbsa-pred";
                        }
                    } else if (year >= 2019 && year <= 2024) {
                        if (currentVal === "gam-v2-pred") {
                            newVal = "gam-v2";
                        } else if (currentVal === "pm-cbsa-pred") {
                            newVal = "pm-cbsa";
                        }
                    }
                    if (newVal !== currentVal) {
                        dataSelect.value = newVal;
                        dataSelect.dispatchEvent(new Event("change", { bubbles: true }));
                        datasetChanged = true;
                    }
                }
            }
            
            if (!datasetChanged) {
                updateAllActiveSources();
            }
        }, 500);
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
    }, 300);

    // Event Delegation for all layer checkboxes (handles dynamic switches)
    document.body.addEventListener("change", (e) => {
        const cb = e.target;
        if (cb.type === "checkbox" && cb.id.startsWith("layer-")) {
            console.log(`[CHECKBOX-CLICK] ID: ${cb.id}, Checked: ${cb.checked}`);
            const shortId = cb.id.replace("layer-", "");
            if (saveLayerFlag) saveLayerFlag(shortId, cb.checked);

            // Published data 체크 시 로그인 확인
            if (cb.checked && !auth.currentUser) {
                const restrictedSources = ExcludeLayerGroups.restrictedSources;
                const currentDataset = utils.getEffectiveDataset(utils.currentDate());
                const contextKey = `${shortId}-${currentDataset}`;
                const globalKey = shortId;

                let targetConfig = null;
                if (DATA_IMPORT_METHOD[contextKey]) {
                    targetConfig = DATA_IMPORT_METHOD[contextKey];
                } else if (DATA_IMPORT_METHOD[globalKey]) {
                    targetConfig = DATA_IMPORT_METHOD[globalKey];
                }

                if (targetConfig?.source && restrictedSources.includes(targetConfig.source)) {
                    cb.checked = false;
                    utils.showAuthOverlay();
                }
            }

            if (!cb.checked && ExcludeLayerGroups.satelliteLayers.indexOf(shortId) !== -1) {
                if (typeof clearPlotSelectionForLayer === "function") {
                    clearPlotSelectionForLayer(cb.id);
                }
            }

            onLayerChange();
        }
    });

    // ---- [External data] AirNow ----
    // AirNow time picker event listener
    const timePicker = document.getElementById("timePicker");
    if (timePicker) {
        timePicker.addEventListener("change", utils.debounce(async () => {
            const hasTempo = !!document.querySelector("input[id^='layer-tempo-']:checked");
            const hasHrrr = !!document.querySelector("input[id^='layer-hrrr-']:checked");
            const hasGoes = !!document.querySelector("input[id^='layer-goes-']:checked");
            const hasViirs = !!document.querySelector("input[id='layer-viirs-truecolor']:checked");
            const hasGeoscf = !!document.querySelector("input[id^='layer-geoscf-']:checked");
            const isoDate = utils.currentDate();

            // Load all hourly data in parallel, properly awaited.
            // Each loader manages its own spinner internally.
            const promises = [];
            
            // Automatically reload active hourly vector sources (e.g. AirFuse)
            const activeHourlyVectors = Array.from(document.querySelectorAll("input[type=checkbox][id^='layer-']:checked"))
                .map(cb => cb.id.replace("layer-", ""))
                .filter(shortId => {
                    const ds = DATA_IMPORT_METHOD[shortId];
                    return ds?.duration === "hourly" && !ExcludeLayerGroups.pngLayers.includes(shortId);
                });

            activeHourlyVectors.forEach(key => promises.push(loadSourceData(key, isoDate)));

            if (airnowHasActiveLayers()) {
                promises.push(airnowLoadData(isoDate));
            }

            if (hasTempo) {
                promises.push(tempoLoadData(isoDate));
            }
            
            if (hasHrrr) {
                promises.push(hrrrLoadData(isoDate));
            }
            
            if (hasGoes) {
                promises.push(goesLoadData(isoDate));
            }
            
            if (hasViirs) {
                promises.push(viirsLoadData(isoDate));
            }
            
            if (hasGeoscf) {
                promises.push(geoscfLoadData(isoDate));
            }

            if (promises.length > 0) {
                toggleSpinner(true);
                try {
                    await Promise.all(promises);
                } finally {
                    toggleSpinner(false);
                }
            }

            // Keep Statistical Tools date and charts completely in sync with the new time
            triggerRefresh();
            window.dispatchEvent(new Event("map-data-loaded"));
        }, 500));
    }
    // ---- [External data] AirNow ----
    
    // [Smart News Fetch] Listen for drawer opening to load missing data
    window.addEventListener("news-drawer-opened", () => {
        const isoDate = utils.currentDate();
        if (loadedSources["wildfire_news"] !== isoDate) {
            updateAllActiveSources();
        }
    });

    // Auth listener moved here from loader.js (Facade)
    window.addEventListener("authStateChanged", (e) => {
        if (e.detail.user) {
            console.log("User logged in - refreshing all active sources.");
            updateAllActiveSources();
        } else {
            console.log("User logged out - clearing all sources.");
            resetLoadedSources(updateWildfireNewsList);
            updateAllActiveSources();
        }
    });
}

/**
 * Main initialization call.
 * This should be called once from ui-init.js.
 */
export function initLoaderRuntime() {
    if (!map) return;

    // 1. Bind UI events immediately
    console.log("[LOADER] Binding events immediately...");
    try {
        bindEventsLoaderHandler();
    } catch (e) {
        console.error("[LOADER] bindEventsLoaderHandler failed:", e);
    }

    const startLoader = () => {
        console.log("[LOADER] Calling ensureLayers...");
        ensureLayers();
        console.log("[LOADER] Calling updateAllActiveSources...");
        updateAllActiveSources();
    };

    // 2. Map-dependent initialization
    if (map.loaded() || map.isStyleLoaded()) {
        console.log("[LOADER] Map/Style already loaded. Initializing layers...");
        startLoader();
    } else {
        console.log("[LOADER] Waiting for map style.load event...");
        map.once("style.load", startLoader);
    }
}

