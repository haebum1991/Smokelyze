
/**
 * AirNow Loader Module (Optimized)
 * Orchestrates fetching of daily bundles and updating Mapbox layers for all hourly pollutants.
 */

import { map } from "./map-init.js";
import { toggleSpinner, showLoaderError } from "./loader-ui.js";
import { updateStateShading } from "./layers-colors.js";
import {
    airnowFetchData,
    airnowActivateHour,
    airnowUpdateStatsMap,
    airnowClearStats,
    airnowSetCurrentTime,
    airnowGetActiveLayerIds
} from "./airnow.js";

import { EMPTY_FC } from "./layers-constants.js";
import { loadedGeoJSON, loadedSources } from "./loader-state.js";
import { triggerRefresh } from "./stats-common.js";
import { logUserAction } from "./fb-logging.js";
import { refreshHighlight, urlByDateGZfile } from "./utils.js";
import { DATA_IMPORT_METHOD } from "./layers-def.js";

/**
 * Main entry point for loading AirNow hourly data
 */
export async function airnowLoadData(isoDate, localHour) {
    // Fallback if localHour is not passed (e.g. called from loader-handler.js)
    if (localHour === undefined) {
        const timePicker = document.getElementById("timePicker");
        localHour = timePicker ? parseInt(timePicker.value) : new Date().getHours();
    }

    const activeLayerIds = airnowGetActiveLayerIds();
    if (activeLayerIds.length === 0) {
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
            const ds = DATA_IMPORT_METHOD["airnow_hourly"];
            const url = urlByDateGZfile(ds, utcIsoDate);
            try {
                dailyGeoJSON = await airnowFetchData(url);
                loadedGeoJSON[dailyCacheKey] = dailyGeoJSON;
            } catch (err) {
                console.error("AirNow bundle load failed:", err);
                dailyGeoJSON = EMPTY_FC;
                showLoaderError("airnow_hourly", isoDate, true);
            }
        }

        // 3. Process and apply data to the unified source
        airnowActivateHour(dailyGeoJSON, utcHour);
        airnowClearStats();

        // Update the unified source once
        const source = map.getSource("airnow_hourly");
        if (source) {
            source.setData(dailyGeoJSON);
            const searchFriendlyKey = `airnow_hourly_${utcIsoDate}_${utcHour}`;
            loadedSources["airnow_hourly"] = searchFriendlyKey;
            loadedGeoJSON[searchFriendlyKey] = dailyGeoJSON;
        }

        // Apply statistics for all active pollutants (using Layer IDs)
        activeLayerIds.forEach(layerId => {
            airnowUpdateStatsMap(dailyGeoJSON, layerId);
        });
        
        // --- [Log the View Action] ---
        logUserAction("view", {
            dataset: "airnow_hourly",
            layer: activeLayerIds.join(", "),
            date: isoDate
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

