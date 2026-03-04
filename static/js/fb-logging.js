
import { analytics, logEvent, auth } from "./fb-init.js";
import { DATA_IMPORT_METHOD, LAYER_TEMPLATES } from "./layers-def.js";

// Brain State: Robust Unique IDs for globally unique analysis in R
let sessionId = Date.now().toString(36) + Math.random().toString(36).substring(2);
let currentViewId = null;

// Emergency Kill Switch: Set to false to stop all logging immediately
window.loggingEnabled = true;
window.toggleLogging = (bool) => {
    window.loggingEnabled = bool;
    console.log(`📡 Logging has been ${bool ? 'ENABLED' : 'DISABLED'}.`);
};

/**
 * [Centralized Brain] Logs all user actions via Firebase Analytics.
 * Optimized for BigQuery / R Analysis.
 */
export async function logUserAction(type, payload = {}) {
    if (window.loggingEnabled === false) return;

    const user = auth.currentUser;
    // Guest support for testing
    const uid = user ? user.uid : "GUEST_" + sessionId;

    // 1. Brain: Robust Page Detection
    const path = window.location.pathname.toLowerCase();
    let page = "other";

    if (path.includes("/map")) page = "map";
    else if (path.includes("data")) page = "data";
    else if (path === "/" || path.includes("index.html")) page = "home";

    // 2. Brain: Interaction Grouping
    if (type === "view") {
        currentViewId = "v_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    }

    const currentDataset = document.getElementById("MapDataSelect")?.value;
    const datePicker = document.getElementById("datePicker");
    const targetDate = payload.date || (datePicker ? datePicker.value : null);

    // [Unified Schema Template] Every row has identical columns for R bind_rows()
    // NOTE: Firebase Analytics automatically includes timestamp, device info, etc.
    let logEntry = {
        id_user: uid,
        id_session: sessionId,
        id_view: currentViewId,
        id_page: page,
        id_action: type,

        // Background Context (View)
        key_dataset: null,
        key_layer: null,
        key_date: null,

        // Specific Details (Action)
        key_aqs: null,
        key_state: null,
        key_filename: null,
        key_report_type: null
    };

    // Helper: Harvest Map Context
    const getMapViewContext = (filterSourceKey = null) => {
        const EXCLUDE = ["wildfire_news", "map_post", "wildfire-news", "map-post"];
        const activeSubLayers = Array.from(document.querySelectorAll("input[type=checkbox][id^='layer-']"))
            .filter(cb => {
                if (!cb.checked) return false;
                const shortId = cb.id.replace("layer-", "");
                if (EXCLUDE.includes(shortId)) return false;
                if (!filterSourceKey) return true;
                const cfg = DATA_IMPORT_METHOD[`${shortId}-${currentDataset}`] || DATA_IMPORT_METHOD[shortId];
                return cfg && cfg.source === filterSourceKey;
            })
            .map(cb => {
                const shortId = cb.id.replace("layer-", "");
                const tmpl = LAYER_TEMPLATES.find(t => t.id === shortId || shortId.startsWith(t.id + "-"));
                return tmpl ? tmpl.id : shortId;
            });

        let detectedDataset = null;
        activeSubLayers.forEach(id => {
            const tmpl = LAYER_TEMPLATES.find(t => t.id === id);
            if (tmpl && Array.isArray(tmpl.datasets) && tmpl.datasets.includes(currentDataset)) {
                detectedDataset = currentDataset;
            }
        });

        return {
            key_dataset: detectedDataset,
            key_layer: activeSubLayers.join(", "),
            key_date: targetDate
        };
    };

    // Logic Tree
    if (page === "map") {
        if (type === "view") {
            const EXCLUDE_TRIGGERS = ["wildfire_news", "map_post", "wildfire-news", "map-post"];
            if (EXCLUDE_TRIGGERS.includes(payload.sourceKey)) return;
            Object.assign(logEntry, getMapViewContext(payload.sourceKey));
        } else if (type === "click_point") {
            const aqsCode = payload.AQS || payload.AQS_O3 || payload.AQS_PM || payload.ID || payload.selected_id;
            if (!aqsCode || aqsCode === "N/A") return;
            const vCtx = getMapViewContext();
            const clickedId = payload.clicked_layer;
            const tmpl = LAYER_TEMPLATES.find(t => clickedId === t.id || clickedId.startsWith(t.id + "-"));
            const cleanLayerId = tmpl ? tmpl.id : clickedId;
            const isModelPoint = tmpl && tmpl.datasets && tmpl.datasets.includes(currentDataset);

            Object.assign(logEntry, vCtx, {
                key_layer: cleanLayerId,
                key_dataset: isModelPoint ? currentDataset : null,
                key_aqs: aqsCode,
                key_state: payload.state || "N/A"
            });
        } else if (type === "download") {
            const vCtx = getMapViewContext();
            Object.assign(logEntry, vCtx, {
                key_layer: null,
                key_dataset: payload.dataset || payload.datasetId || vCtx.key_dataset,
                key_aqs: payload.selected_id || payload.aqsSite || payload.aqs || null,
                key_filename: payload.filename || payload.fileName || null
            });
        }
    }

    else if (page === "data") {
        Object.assign(logEntry, {
            key_dataset: payload.dataset || payload.datasetId || null,
            key_date: payload.date || targetDate || null,
            key_aqs: payload.selected_id || payload.aqsSite || payload.aqs || null,
            key_state: payload.state || payload.stateVal || null,
            key_report_type: payload.report_type || payload.reportType || payload.period || null,
            key_filename: payload.filename || payload.fileName || null
        });
    }

    // Global Fallback for download / other
    if (!logEntry.key_filename && payload.filename) logEntry.key_filename = payload.filename;
    if (!logEntry.key_aqs && (payload.selected_id || payload.aqsSite)) {
        logEntry.key_aqs = payload.selected_id || payload.aqsSite;
    }

    // Final Clean-up (Removing unwanted fields)
    const cleanup = [
        "email", "layer", "url", "userAgent", "date", "itemCount", "item_count",
        "dataset", "selected_id", "view_dataset", "view_active_layers", "view_target_date",
        "view_gcs_path", "aqs_code", "state", "session_id", "view_id", "page", "action",
        "filename", "report_type", "uid", "timestamp"
    ];
    cleanup.forEach(key => delete logEntry[key]);

    try {
        logEvent(analytics, type, logEntry);
    } catch (e) {
        console.error("[Analytics Error]:", e);
    }
}

