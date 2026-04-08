
/**
 * AirNow Loader Module (Optimized)
 * Orchestrates fetching of daily bundles and updating Mapbox layers for all hourly pollutants.
 */

import { map } from "./map-init.js";
import { toggleSpinner } from "./loader-ui.js";
import { updateStateShading } from "./layers-colors.js";
import {
    airnowBuildURL,
    airnowFetchData,
    airnowActivateHour,
    airnowUpdateStatsMap,
    airnowClearStats,
    airnowSetCurrentTime,
    airnowGetActiveCoverages
} from "./airnow.js";

import { EMPTY_FC } from "./layers-constants.js";
import { loadedGeoJSON, loadedSources } from "./loader-state.js";
import { triggerRefresh } from "./stats-common.js";
import { logUserAction } from "./fb-logging.js";
import { refreshHighlight } from "./utils.js";

/**
 * Main entry point for loading AirNow hourly data
 */
export async function airnowLoadData(isoDate, localHour) {
    // Fallback if localHour is not passed (e.g. called from loader-handler.js)
    if (localHour === undefined) {
        const timePicker = document.getElementById("timePicker");
        localHour = timePicker ? parseInt(timePicker.value) : new Date().getHours();
    }

    const activeCoverages = airnowGetActiveCoverages();
    if (activeCoverages.length === 0) {
        airnowClearStats();
        updateStateShading();
        return;
    }

    try {
        toggleSpinner(true);

        // 1. Calculate UTC Time (Needed for file path and column selection)
        const dateParts = isoDate.split("-").map(Number);
        if (dateParts.length < 3 || dateParts.some(isNaN)) {
            console.warn("AirNow: Invalid isoDate received:", isoDate);
            toggleSpinner(false);
            return;
        }

        const [y, m, d] = dateParts;
        const localDate = new Date(y, m - 1, d, localHour);

        if (isNaN(localDate.getTime())) {
            console.warn("AirNow: Failed to create valid Date object:", { y, m, d, localHour });
            toggleSpinner(false);
            return;
        }

        const utcIsoDate = localDate.toISOString().split("T")[0];
        const utcHour = localDate.getUTCHours();
        airnowSetCurrentTime(utcHour);

        // 2. Fetch the daily bundle (cached per UTC date)
        const dailyCacheKey = `airnow_daily_${utcIsoDate}`;
        let dailyGeoJSON = loadedGeoJSON[dailyCacheKey];

        if (!dailyGeoJSON) {
            const url = airnowBuildURL(null, utcIsoDate);
            try {
                dailyGeoJSON = await airnowFetchData(url);
                loadedGeoJSON[dailyCacheKey] = dailyGeoJSON;
                
                // --- Log the download/view action ---
                logUserAction("view", {
                    dataset: "airnow_hourly_geojson",
                    layer: "airnow_hourly",
                    date: utcIsoDate,
                    filename: url
                });
                
            } catch (err) {
                console.error("AirNow bundle load failed:", err);
                dailyGeoJSON = EMPTY_FC;
            }
        }

        // 3. Process and apply data to each active layer
        // We activate the correct hour once, then update all sources
        airnowActivateHour(dailyGeoJSON, utcHour);
        airnowClearStats();

        const coverageToSource = {
            "airnow.pm25": "airnow-hourly-pm25",
            "airnow.ozone": "airnow-hourly-ozone",
            "airnow.no2": "airnow-hourly-no2"
        };

        activeCoverages.forEach(coverage => {
            const sourceId = coverageToSource[coverage];
            const source = map.getSource(sourceId);

            // Apply statistics
            airnowUpdateStatsMap(dailyGeoJSON, coverage);

            // Update Mapbox source
            if (source) {
                source.setData(dailyGeoJSON);
                const searchFriendlyKey = `${sourceId}_${utcIsoDate}_${utcHour}`;
                loadedSources[sourceId] = searchFriendlyKey;
                loadedGeoJSON[searchFriendlyKey] = dailyGeoJSON;
            }
        });

        // 4. Refresh global state shading
        updateStateShading();
        
        // 5. Explicitly refresh Statistical Tools (text and charts)
        triggerRefresh();
        
        // 6. Refresh locked tooltip (if any)
        refreshHighlight();

        toggleSpinner(false);

    } catch (e) {
        console.error("AirNow orchestration failed:", e);
        toggleSpinner(false);
    }
}

