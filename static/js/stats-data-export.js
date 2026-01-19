
import { auth } from "./fb-init.js";
import { loadedGeoJSON, loadSourceData } from "./loader.js";
import { DATASET_SOURCE_MAP } from "./layers-def.js";
import * as utils from "./utils.js";

function convertToCSV(geoJSON) {
    if (!geoJSON || !geoJSON.features || geoJSON.features.length === 0) {
        return null;
    }

    var f = geoJSON.features;
    var p = f.map(function (fi) {
        var props = Object.assign({}, fi.properties);
        // Add longitude and latitude from coordinates if available (for Point features)
        if (fi.geometry && fi.geometry.type === "Point" && Array.isArray(fi.geometry.coordinates)) {
            props.lon = fi.geometry.coordinates[0];
            props.lat = fi.geometry.coordinates[1];
        }
        return props;
    });

    // Collect all unique keys
    var keySet = new Set();
    p.forEach(function (i) {
        Object.keys(i).forEach(function (k) { keySet.add(k); });
    });

    var keys = Array.from(keySet);

    // Reorder keys: Put lon and lat after site_name
    var header = [];
    var added = new Set();

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
    var COMMA = String.fromCharCode(44); // ,
    var NEWLINE = String.fromCharCode(10); // 


    var QUOTE = String.fromCharCode(34); // "
    var CR = String.fromCharCode(13); // 

    // Create CSV content
    var csvRows = [];
    csvRows.push(header.join(COMMA)); // Header row

    p.forEach(function (i) {
        var row = header.map(function (key) {
            var val = i[key];
            if (val === undefined || val === null) {
                val = "";
            } else {
                var strVal = String(val);

                // Check for special characters using indexOf
                var needsQuotes = false;
                if (strVal.indexOf(COMMA) !== -1) needsQuotes = true;
                if (strVal.indexOf(QUOTE) !== -1) needsQuotes = true;
                if (strVal.indexOf(NEWLINE) !== -1) needsQuotes = true;
                if (strVal.indexOf(CR) !== -1) needsQuotes = true;

                if (needsQuotes) {
                    // Replace quotes with double quotes: strVal.split('"').join('""')
                    var escaped = strVal.split(QUOTE).join(QUOTE + QUOTE);
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
    var mimeType = "text/csv;charset=utf-8;";
    var blob = new Blob([csvContent], { type: mimeType });
    var link = document.createElement("a");
    if (link.download !== undefined) {
        var url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

async function handleDownload() {

    if (!auth.currentUser) {
        utils.showAuthOverlay();
        return;
    }

    var select = document.getElementById("MapDataSelect");
    if (!select) return;

    var dataset = select.value;
    if (!dataset) return;

    var dateInput = document.getElementById("datePicker");
    var date = dateInput ? dateInput.value : "data";
    var sourceKey = DATASET_SOURCE_MAP[dataset] || dataset;
    var loadedData = loadedGeoJSON ? loadedGeoJSON[sourceKey] : null;

    // [Added] Fetch on demand logic
    if (loadSourceData) {
        var btn = document.getElementById("ExportBtnDaily");
        var originalText = "";
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

    var csv = convertToCSV(loadedData);
    if (csv) {
        downloadCSV(dataset + "_" + date + ".csv", csv);
    } else {
        alert("Failed to convert data to CSV.");
    }
}

export function initExportButton() {
    if (document.getElementById("ExportBtnDaily")) return;

    var select = document.getElementById("MapDataSelect");
    if (!select) {
        var observer = new MutationObserver(function (mutations, obs) {
            var s = document.getElementById("MapDataSelect");
            if (s) {
                obs.disconnect();
                initExportButton();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        return;
    }

    var btn = document.createElement("button");
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
        transition: "transform 0.2s ease"
    });

    btn.addEventListener("click", handleDownload);

    var parent = select.parentNode;

    if (parent.id === "ExportBtnWrapper") {
        if (!document.getElementById("ExportBtnDaily")) {
            parent.appendChild(btn);
        }
        return;
    }

    var wrapper = document.createElement("div");
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

export { handleDownload };

// Auto-init
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initExportButton);
} else {
    initExportButton();
}

