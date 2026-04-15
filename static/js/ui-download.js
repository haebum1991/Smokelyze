
import * as utils from "./utils.js";
import { auth, onAuthStateChanged } from "./fb-init.js";
import { updateAuthButton } from "./signin.js";

/**
 * Core Utility: Convert GeoJSON or Array of Objects to CSV
 */
export function convertToCSV(data, columns = null) {
    let features = [];
    if (data.features) {
        features = data.features.map(f => {
            const props = { ...f.properties };
            if (f.geometry && f.geometry.type === "Point" && Array.isArray(f.geometry.coordinates)) {
                props.lon = f.geometry.coordinates[0];
                props.lat = f.geometry.coordinates[1];
            }
            return props;
        });
    } else if (Array.isArray(data)) {
        features = data;
    }

    if (features.length === 0) return null;

    // Collect keys
    const EXCLUDE_KEYS = ["dsKeyForFigure", "_showOnMap"];
    const keySet = new Set();
    features.forEach(item => {
        Object.keys(item).forEach(k => {
            if (!EXCLUDE_KEYS.includes(k)) {
                keySet.add(k);
            }
        });
    });

    // Header ordering logic
    const keys = columns || Array.from(keySet);
    const header = [];
    const added = new Set();

    // Sort logic: site_name -> lon -> lat -> others
    keys.forEach(k => {
        if (!added.has(k)) {
            header.push(k);
            added.add(k);
            if (k === "site_name") {
                if (keySet.has("lon") && !added.has("lon")) { header.push("lon"); added.add("lon"); }
                if (keySet.has("lat") && !added.has("lat")) { header.push("lat"); added.add("lat"); }
            }
        }
    });
    keys.forEach(k => { if (!added.has(k)) { header.push(k); added.add(k); } });

    const QUOTE = '"';
    const COMMA = ",";
    const NEWLINE = "\n";

    const rows = [header.join(COMMA)];
    features.forEach(item => {
        const row = header.map(key => {
            let val = item[key];
            if (val === undefined || val === null) return "";
            const strVal = String(val);
            if (strVal.includes(COMMA) || strVal.includes(QUOTE) || strVal.includes(NEWLINE)) {
                return QUOTE + strVal.replace(/"/g, '""') + QUOTE;
            }
            return strVal;
        });
        rows.push(row.join(COMMA));
    });

    return rows.join(NEWLINE);
}

/**
 * Core Utility: Trigger Browser Download
 */
export function downloadFile(filename, content, mimeType = "text/csv;charset=utf-8;") {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Factory: Create a standardized export button
 */
export function createExportButton(options = {}) {
    const btn = document.createElement("button");
    if (options.id) btn.id = options.id;

    const originalLabel = options.label || "⬇ .CSV";
    btn.textContent = originalLabel;
    btn.setAttribute("data-original-label", originalLabel);
    btn.type = "button";

    // Shared class for global control
    btn.className = "export-btn-csv " + (options.className || "");

    if (options.style) {
        Object.assign(btn.style, options.style);
    }

    if (options.onClick) {
        btn.addEventListener("click", async (e) => {
            if (!auth.currentUser) {
                utils.showAuthOverlay();
                return;
            }

            const oldText = btn.textContent;
            btn.textContent = "...";
            btn.disabled = true;

            try {
                await options.onClick(e, btn);
            } catch (err) {
                console.error("Export failed:", err);
            } finally {
                btn.textContent = oldText;
                btn.disabled = false;
            }
        });
    }

    // Initial auth check
    updateAuthButton(btn, auth.currentUser, originalLabel);

    return btn;
}

// handleDownloadForLayer moved to ui-download-dataset.js to prevent circular dependencies

/**
 * Global Controller: Listen for auth changes and update all export buttons
 */
onAuthStateChanged(auth, (user) => {
    const buttons = document.querySelectorAll(".export-btn-csv");
    buttons.forEach(btn => {
        const originalLabel = btn.getAttribute("data-original-label") || "⬇ .CSV";
        updateAuthButton(btn, user, originalLabel);
    });
});

