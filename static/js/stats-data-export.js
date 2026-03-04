

import * as utils from "./utils.js";
import { auth, onAuthStateChanged } from "./fb-init.js";
import { loadedGeoJSON, loadSourceData } from "./loader.js";
import { DATASET_SOURCE_MAP } from "./layers-def.js";
import { updateAuthButton } from "./signin.js";
import { logUserAction } from "./fb-logging.js";

function convertToCSV(geoJSON) {
    if (!geoJSON || !geoJSON.features || geoJSON.features.length === 0) {
        return null;
    }

    const f = geoJSON.features;
    const p = f.map(function (fi) {
        const props = Object.assign({}, fi.properties);
        // Add longitude and latitude from coordinates if available (for Point features)
        if (fi.geometry && fi.geometry.type === "Point" && Array.isArray(fi.geometry.coordinates)) {
            props.lon = fi.geometry.coordinates[0];
            props.lat = fi.geometry.coordinates[1];
        }
        return props;
    });

    // Collect all unique keys
    const keySet = new Set();
    p.forEach(function (i) {
        Object.keys(i).forEach(function (k) { keySet.add(k); });
    });

    const keys = Array.from(keySet);

    // Reorder keys: Put lon and lat after site_name
    const header = [];
    const added = new Set();

    // Find site_name and insert lon, lat right after it
    keys.forEach(function (k) {
        if (!added.has(k)) {
            header.push(k);
            added.add(k);
            if (k === "site_name") {
                if (keySet.has("lon") && !added.has("lon")) { header.push("lon"); added.add("lon"); }
                if (keySet.has("lat") && !added.has("lat")) { header.push("lat"); added.add("lat"); }
            }
        }
    });

    keys.forEach(function (k) {
        if (!added.has(k)) {
            header.push(k);
            added.add(k);
        }
    });

    // Characters for safety
    const COMMA = String.fromCharCode(44); // ,
    const NEWLINE = String.fromCharCode(10); // 


    const QUOTE = String.fromCharCode(34); // "
    const CR = String.fromCharCode(13); // 


    // Create CSV content
    const csvRows = [];
    csvRows.push(header.join(COMMA)); // Header row

    p.forEach(function (i) {
        const row = header.map(function (key) {
            let val = i[key];
            if (val === undefined || val === null) {
                val = "";
            } else {
                const strVal = String(val);

                // Check for special characters using indexOf
                let needsQuotes = false;
                if (strVal.indexOf(COMMA) !== -1) needsQuotes = true;
                if (strVal.indexOf(QUOTE) !== -1) needsQuotes = true;
                if (strVal.indexOf(NEWLINE) !== -1) needsQuotes = true;
                if (strVal.indexOf(CR) !== -1) needsQuotes = true;

                if (needsQuotes) {
                    // Replace quotes with double quotes: strVal.split('"').join('""')
                    const escaped = strVal.split(QUOTE).join(QUOTE + QUOTE);
                    val = QUOTE + escaped + QUOTE;
                }
            }
            return val;
        });
        csvRows.push(row.join(COMMA));
    });

    return csvRows.join(NEWLINE);
}

function downloadCSV(filename, csvContent) {
    const mimeType = "text/csv;charset=utf-8;";
    const blob = new Blob([csvContent], { type: mimeType });
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

export async function handleDownload() {

    if (!auth.currentUser) {
        utils.showAuthOverlay();
        return;
    }

    const select = document.getElementById("MapDataSelect");
    if (!select) return;

    const dataset = select.value;
    if (!dataset) return;

    const dateInput = document.getElementById("datePicker");
    const date = dateInput ? dateInput.value : "data";
    const sourceKey = DATASET_SOURCE_MAP[dataset] || dataset;
    let loadedData = loadedGeoJSON ? loadedGeoJSON[sourceKey] : null;

    // [Added] Fetch on demand logic
    if (loadSourceData) {
        const btn = document.getElementById("ExportBtnDaily");
        let originalText = "";
        if (btn) {
            originalText = btn.textContent;
            btn.textContent = "...";
            btn.disabled = true;
        }

        try {
            await loadSourceData(sourceKey, date);
            loadedData = loadedGeoJSON ? loadedGeoJSON[sourceKey] : null;

        } catch (e) {
            console.error(e);
        } finally {
            if (btn) {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        }
    }

    if (!loadedData) {
        alert("No data available to download for " + dataset + " (" + sourceKey + ") on " + date);
        return;
    }

    const csv = convertToCSV(loadedData);
    if (csv) {
        const filename = dataset + "_" + date + ".csv";
        downloadCSV(filename, csv);

        // [Report to Brain]
        logUserAction("download", { dataset, date, filename, itemCount: loadedData.features ? loadedData.features.length : 0 });
    } else {
        alert("Failed to convert data to CSV.");
    }
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

    const btn = document.createElement("button");
    btn.id = "ExportBtnDaily";
    btn.textContent = "⬇ .CSV";
    btn.type = "button";
    btn.className = "stats-export-btn";

    Object.assign(btn.style, {
        marginLeft: "0.5rem",
        fontSize: "1.4rem",
        padding: "0.4rem 0.8rem",
        borderRadius: "0.4rem",
        cursor: "pointer",
        fontWeight: "bold",
        display: "inline-block",
        verticalAlign: "middle",
        color: "var(--text-strong)",
        backgroundColor: "var(--color-bg)",
        border: "0.1rem solid var(--card-shadow)",
        transition: "transform 0.3s ease"
    });

    btn.addEventListener("click", handleDownload);

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

    // Initial check
    updateAuthButton(btn, auth.currentUser, "⬇ .CSV");
}

// Auto-init
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initExportButton);
} else {
    initExportButton();
}

onAuthStateChanged(auth, (user) => {
    updateAuthButton("ExportBtnDaily", user, "⬇ .CSV");
});

