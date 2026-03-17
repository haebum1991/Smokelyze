
/**
 * AirNow Data Loader Module
 * Handles loading AirNow hourly data from RSIG server
 * Each coverage uses its own separate map source for independent caching
 */

import { refreshHighlight, isRecentlyFailed, failedUrls } from "./utils.js";
import { map } from "./map-init.js";
import { EMPTY_FC } from "./layers-constants.js";
import { loadedGeoJSON, loadedSources } from "./loader-state.js";
import {
    airnowBuildURL,
    airnowFetchData,
    airnowParseCSV,
    airnowCsv2GeoJSON,
    airnowUpdateStatsMap,
    airnowClearStats,
    airnowSetCurrentTime,
    airnowGetActiveCoverages
} from "./airnow.js";
import { updateStateShading } from "./layers-colors.js";
import { triggerRefresh } from "./stats-common.js";
import { showErrorToast, showTaskNotification } from "./loader-ui.js";

let airnowAbortControllers = {};
let lastAirnowSigs = {};

/**
 * Load AirNow data for all active coverages
 * Each coverage loads to its own source: airnow-pm25, airnow-ozone, airnow-no2
 * @param {string} isoDate - Date in YYYY-MM-DD format
 * @returns {Promise<void>}
 */
export async function airnowLoadData(isoDate) {
    // 1. Get local hour
    const timePicker = document.getElementById("timePicker");
    const localHour = timePicker ? parseInt(timePicker.value) : 0;

    // Get active AirNow coverages
    const activeCoverages = airnowGetActiveCoverages();

    // ---- Abort fetches for UNCHECKED layers immediately ----
    const ALL_COVERAGES = ["airnow.pm25", "airnow.ozone", "airnow.no2"];
    ALL_COVERAGES.forEach(coverage => {
        if (!activeCoverages.includes(coverage)) {
            if (airnowAbortControllers[coverage]) {
                airnowAbortControllers[coverage].abort();
                delete airnowAbortControllers[coverage];
            }
            delete lastAirnowSigs[coverage];
        }
    });
    // ---------------------------------------------------------

    // 현지 시간 기준 Date 객체 생성
    const [y, m, d] = isoDate.split("-").map(Number);
    const localDate = new Date(y, m - 1, d, localHour);

    // UTC 기준 날짜/시간 추출
    const utcYear = localDate.getUTCFullYear();
    const utcMonth = String(localDate.getUTCMonth() + 1).padStart(2, "0");
    const utcDay = String(localDate.getUTCDate()).padStart(2, "0");
    const utcHour = localDate.getUTCHours();

    const utcIsoDate = `${utcYear}-${utcMonth}-${utcDay}`;
    const isoDateTime = `${utcIsoDate}T${String(utcHour).padStart(2, "0")}`;

    // 내부 상태 업데이트 (서버 요청용 UTC 시간)
    airnowSetCurrentTime(utcHour);

    // 2. 로드 시작 전 기존 AirNow 데이터 및 통계 초기화
    ["airnow-hourly-pm25", "airnow-hourly-ozone", "airnow-hourly-no2"].forEach(sourceId => {
        if (!map.getSource(sourceId)) {
            map.addSource(sourceId, { type: "geojson", data: EMPTY_FC });
        }
    });

    if (activeCoverages.length === 0) {
        ["airnow-hourly-pm25", "airnow-hourly-ozone", "airnow-hourly-no2"].forEach(sourceId => {
            const source = map.getSource(sourceId);
            if (source) source.setData(EMPTY_FC);
        });
        airnowClearStats();
        updateStateShading();
        if (typeof triggerRefresh === "function") triggerRefresh();
        return;
    }

    try {

        // Coverage to source mapping
        const coverageToSource = {
            "airnow.pm25": "airnow-hourly-pm25",
            "airnow.ozone": "airnow-hourly-ozone",
            "airnow.no2": "airnow-hourly-no2"
        };
        
        // Use fixed BBOX for North America (USA, Canada, Mexico)
        // Covers: West: -170°, South: 15°, East: -50°, North: 72°
        const bbox = "-170,15,-50,72";
        
        // Parallel fetch for all active coverages
        const promises = activeCoverages.map(async (coverage) => {
            const pollutantName = coverage.split(".")[1].toUpperCase();
            const sourceId = coverageToSource[coverage];
            const cacheKey = `${sourceId}_${isoDateTime}`;
            
            // ---- Layer-Specific Tracking & Abortion ----
            // Create signature specifically for this one layer (includes time vs layer state)
            const airnowSig = `${isoDate}_${localHour}_${coverage}`;

            if (lastAirnowSigs[coverage] === airnowSig) {
                return { coverage, sourceId, success: true, bypassed: true };
            }
            lastAirnowSigs[coverage] = airnowSig;
            
            // Abort ONLY this specific layer if a new request is taking over
            if (airnowAbortControllers[coverage]) {
                airnowAbortControllers[coverage].abort();
            }
            airnowAbortControllers[coverage] = new AbortController();
            const signal = airnowAbortControllers[coverage].signal;
            // ---------------------------------------------

            const formattedTime = String(localHour).padStart(2, "0") + ":00";
            const notificationId = `AirNow [${pollutantName}]<br><span style="font-size: 1.2rem; color: var(--text-main);">${isoDate} ${formattedTime}</span>`;
            const notification = showTaskNotification(notificationId, "Fetching data...");

            // Check cache for this specific coverage+time
            if (loadedGeoJSON[cacheKey]) {
                console.log(`Using cached data for ${sourceId}:`, cacheKey);
                const geojson = loadedGeoJSON[cacheKey];
                const source = map.getSource(sourceId);
                if (source) {
                    source.setData(geojson);
                }
                // Update state-level statistics even from cache
                airnowUpdateStatsMap(geojson, coverage);
                loadedSources[sourceId] = cacheKey;
                
                notification.update("Cached", "success");
                return { coverage, sourceId, success: true, cached: true };
            }

            const url = airnowBuildURL(coverage, utcIsoDate, utcHour, bbox);
            
            // [추가] 최근 실패한 이력이 있으면 서버에 요청하지 않고 즉시 종료
            if (isRecentlyFailed(url)) {
                const errorMsg = `AirNow ${pollutantName} data is not available for the selected time. Please try a different time (data is usually 1-2 hours delayed).`;
                showErrorToast(errorMsg);

                const cbId = "layer-" + sourceId;
                const cb = document.getElementById(cbId);
                if (cb) cb.checked = false;

                const source = map.getSource(sourceId);
                if (source) source.setData(EMPTY_FC);
                
                notification.update("Unavailable", "error");
                return { coverage, sourceId, success: false };
            }
            
            try {
                const data = await airnowFetchData(url, signal);
                const rows = airnowParseCSV(data);
                const geojson = await airnowCsv2GeoJSON(rows);

                if (signal.aborted) {
                    notification.update("Cancelled", "error");
                    return { coverage, sourceId, success: false, aborted: true };
                }

                // Update state-level statistics
                airnowUpdateStatsMap(geojson, coverage);

                // Cache and set data for this specific source
                loadedGeoJSON[cacheKey] = geojson;
                loadedSources[sourceId] = cacheKey;

                const source = map.getSource(sourceId);
                if (source) {
                    source.setData(geojson);
                    console.log(`Loaded ${geojson.features.length} features for ${sourceId}`);
                }
                
                notification.update("Complete", "success");
                return { coverage, sourceId, geojson: geojson, success: true, cached: false };
            } catch (e) {
                
                if (e.name === "AbortError") {
                    notification.update("Cancelled", "error");
                    return { coverage, sourceId, success: false, aborted: true };
                }
                
                console.warn(`Failed to load ${coverage}:`, e);
                
                // User-friendly error message
                const errorMsg = `AirNow ${pollutantName} data is not available for the selected time.<br>Please try a different time (data is usually 1-2 hours delayed).`;
                showErrorToast(errorMsg);
                
                // [추가] 실패한 URL 기록 (15분간 재요청 방지)
                if (url && failedUrls) {
                    failedUrls.set(url, Date.now());
                }
                
                // Auto-uncheck failed AirNow layer
                const cbId = "layer-" + sourceId;
                const cb = document.getElementById(cbId);
                if (cb) cb.checked = false;
                
                const source = map.getSource(sourceId);
                if (source) source.setData(EMPTY_FC);
                
                notification.update("Failed", "error");
                return { coverage, sourceId, success: false };
            }
        });

        const results = await Promise.all(promises);
        
        // Refresh state shading to reflect new AirNow stats
        updateStateShading();

        // Refresh stats table and plots
        if (typeof triggerRefresh === "function") {
            triggerRefresh(); // Safely triggers ui refreshes
        }

        // [Added] Refresh highlight/tooltip to reflect new time data
        if (refreshHighlight) {
            refreshHighlight();
        }
        
    } catch (e) {
        console.error("AirNow data loading failed:", e);
        ["airnow-hourly-pm25", "airnow-hourly-ozone", "airnow-hourly-no2"].forEach(sourceId => {
            const source = map.getSource(sourceId);
            if (source) source.setData(EMPTY_FC);
        });
    }
}

