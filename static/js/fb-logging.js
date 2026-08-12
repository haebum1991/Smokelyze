
import { analytics, logEvent, auth } from "./fb-init.js";

// Brain State: Robust Unique IDs for globally unique analysis in R
let sessionId = Date.now().toString(36) + Math.random().toString(36).substring(2);
let currentViewId = null;

/**
 * [Centralized Brain] Logs all user actions via Firebase Analytics.
 * Optimized for BigQuery / R Analysis with a unified schema.
 */
export async function logUserAction(type, payload = {}) {
    if (window.loggingEnabled === false) return;

    // 1. Session & Interaction Grouping
    if (type === "view") {
        currentViewId = "v_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    }

    const user = auth.currentUser;
    const uid = user ? user.uid : "GUEST_" + sessionId;

    // 2. Page Detection
    const path = window.location.pathname.toLowerCase();
    let page = "other";
    if (path.includes("/map")) page = "map";
    else if (path.includes("data")) page = "data";
    else if (path === "/" || path.includes("index.html")) page = "home";

    // 3. Unified Schema Template (R bind_rows() friendly)
    // All calls must now provide: dataset, aqs, state, filename, report_type, layer, date
    let dataset = payload.dataset || "";
    const datasetNormMap = {
        "gam-v1": "gam_v1",
        "gam-v2": "gam_v2",
        "pm-cbsa": "pm_cbsa",
        "epa-ember": "epa_ember",
        "gam-v2-pred": "gam_v2_pred",
        "pm-cbsa-pred": "pm_cbsa_pred"
    };
    if (datasetNormMap[dataset]) {
        dataset = datasetNormMap[dataset];
    }
    
    let layer = payload.layer || "";
    if (datasetNormMap[layer]) {
        layer = datasetNormMap[layer];
    }
    
    const rawDate = payload.date || document.getElementById("datePicker")?.value || "";
    const todayStr = new Date().toISOString().split("T")[0];
    const resolvedDate = (rawDate && rawDate.toUpperCase() !== "LIVE") ? rawDate : todayStr;

    let logEntry = {
        id_user: String(uid || ""),
        id_session: String(sessionId || ""),
        id_view: String(currentViewId || ""),
        id_page: String(page || ""),

        // Background Context & Specific Details (Normalized to Strings)
        key_userRole: String(sessionStorage.getItem("userRole") || "unknown"),
        key_dataset: String(dataset),
        key_layer: String(layer),
        key_aqs: payload.aqs ? "aqs_" + String(payload.aqs) : "none",
        key_state: String(payload.state || ""),
        key_filename: String(payload.filename || ""),
        key_report_type: String(payload.report_type || ""),
        key_date: String(resolvedDate)
    };

    console.log(`[FB-LOG] ${type}:`, logEntry);
    try {
        logEvent(analytics, type, logEntry);
    } catch (e) {
        console.error("[Analytics Error]:", e);
    }
}

