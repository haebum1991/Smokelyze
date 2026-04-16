
import { loadedGeoJSON, loadSourceData, toggleSpinner } from "./loader.js";
import { DATASET_SOURCE_MAP } from "./layers-def.js";
import { logUserAction } from "./fb-logging.js";
import { airnowBuildURL, airnowFetchData, airnowActivateHour, airnowGetCurrentTime } from "./airnow.js";
import { convertToCSV, downloadFile, createExportButton } from "./ui-download.js";

/**
 * Generic dataset download with fetch-on-demand
 * Exported for use in ui-param-desc.js (Layer Description UI)
 */
export async function handleDownloadForLayer(dataset, options = {}) {
    const title = options.title || dataset;
    const dateInput = document.getElementById("datePicker");
    const date = dateInput ? dateInput.value : "data";

    toggleSpinner(true, `Preparing ${title} data...`);
    try {
        let geoJSONData = null;

        if (dataset.startsWith("airnow-hourly-")) {
            // Hourly data is managed via daily bundles
            const url = airnowBuildURL(null, date);
            geoJSONData = await airnowFetchData(url);
        } else {
            // Standard daily data
            const sourceKey = DATASET_SOURCE_MAP[dataset] || dataset;
            await loadSourceData(sourceKey, date);
            geoJSONData = loadedGeoJSON[sourceKey];
        }

        if (!geoJSONData || !geoJSONData.features || geoJSONData.features.length === 0) {
            alert(`No data available for ${title} on ${date}`);
            return;
        }

        // Deep clone data to avoid modifying the original source in memory (since we use delete p[k])
        geoJSONData = JSON.parse(JSON.stringify(geoJSONData));

        // Flexible Filtering Logic: Remove specific undesired columns instead of whitelisting
        if (dataset === "airnow-daily-mda8") {
            geoJSONData.features.forEach(f => {
                delete f.properties["PM2.5"]; // User only wants MDA8
            });
        } else if (dataset === "airnow-daily-pm25") {
            geoJSONData.features.forEach(f => {
                delete f.properties["MDA8O3"]; // User only wants PM2.5
            });
        } else if (dataset.startsWith("airnow-hourly-")) {
            const utcHour = airnowGetCurrentTime();
            airnowActivateHour(geoJSONData, utcHour);

            const isO3 = dataset === "airnow-hourly-ozone";
            const isPM = dataset === "airnow-hourly-pm25";
            const isNO2 = dataset === "airnow-hourly-no2";

            const hourStr = utcHour.toString().padStart(2, "0");

            geoJSONData.features.forEach(f => {
                const p = f.properties;
                // Identify the actual suffix format used in the source data (e.g., _T01 or _01T)
                let suffix = `_T${hourStr}`; 
                if (Object.keys(p).some(k => k.endsWith(`_${hourStr}T`))) suffix = `_${hourStr}T`;

                const targetVal = isO3 ? p["ozone(ppb)"] : isPM ? p["pm25(ug/m3)"] : p["no2(ppb)"];
                const targetHeader = isO3 ? "O3" : isPM ? "PM2.5" : "NO2";

                // 1. Update date to be specific (includes hour) and clean up undesired columns
                p.date = p["current_hour_str"] || p.date;

                Object.keys(p).forEach(k => {
                    if (/_([0-2]\dT|T[0-2]\d)$/.test(k)) delete p[k];
                    if (k === "pm25(ug/m3)" || k === "ozone(ppb)" || k === "no2(ppb)" || k === "current_hour_str") delete p[k];
                });

                // 2. Add back the selected measurement with a clean header
                if (targetVal !== undefined && targetVal !== null) {
                    p[targetHeader] = targetVal;
                }
            });
        }

        const csv = convertToCSV(geoJSONData);
        if (csv) {
            let filename = `${dataset}_${date}.csv`;
            if (dataset.startsWith("airnow-hourly-")) {
                const hourStr = airnowGetCurrentTime().toString().padStart(2, "0");
                filename = `${dataset}_${date}-${hourStr}.csv`;
            }
            downloadFile(filename, csv);
            logUserAction("download", { dataset, date, filename });
        } else {
            alert("Failed to convert data to CSV.");
        }
    } catch (err) {
        console.error("Download failed:", err);
        alert("Download failed. Please check if data exists for this date.");
    } finally {
        toggleSpinner(false);
    }
}

// Local helper specifically for the main UI daily export
async function handleDownloadForPublished(e, btn) {
    const select = document.getElementById("MapDataSelect");
    if (!select || !select.value) return;

    const dataset = select.value;
    const title = select.options[select.selectedIndex]?.text || dataset;
    await handleDownloadForLayer(dataset, { title });
}


export function initExportButton() {
    if (document.getElementById("ExportBtnDaily")) return;

    const select = document.getElementById("MapDataSelect");
    if (!select) {
        const observer = new MutationObserver(function (mutations, obs) {
            const s = document.getElementById("MapDataSelect");
            if (s) {
                obs.disconnect();
                initExportButton();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        return;
    }

    const btn = createExportButton({
        id: "ExportBtnDaily",
        label: "⬇ .CSV",
        onClick: handleDownloadForPublished
    });

    const parent = select.parentNode;

    if (parent.id === "ExportBtnWrapper") {
        if (!document.getElementById("ExportBtnDaily")) {
            parent.appendChild(btn);
        }
        return;
    }

    const wrapper = document.createElement("div");
    wrapper.id = "ExportBtnWrapper";
    wrapper.style.display = "flex";
    wrapper.style.alignItems = "center";
    wrapper.style.width = "100%";
    wrapper.style.gap = "0.5rem";
    wrapper.style.marginBottom = "0.2rem";

    parent.insertBefore(wrapper, select);

    wrapper.appendChild(select);
    wrapper.appendChild(btn);

    select.style.flex = "1 1 auto";
    select.style.width = "0";
    select.style.minWidth = "0";

    btn.style.flex = "0 0 auto";
    btn.style.whiteSpace = "nowrap";
    btn.style.marginLeft = "0";
}

// Auto-init
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initExportButton);
} else {
    initExportButton();
}

