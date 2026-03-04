
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
    let logEntry = {
        id_user: uid,
        id_session: sessionId,
        id_view: currentViewId,
        id_page: page,

        // Background Context & Specific Details
        key_dataset: payload.dataset || null,
        key_layer: payload.layer || null,
        key_aqs: payload.aqs || null,
        key_state: payload.state || null,
        key_filename: payload.filename || null,
        key_report_type: payload.report_type || null,
        key_date: payload.date || document.getElementById("datePicker")?.value || null
    };

    const EXCLUDE = ["wildfire_news", "map_post", "wildfire-news", "map-post"];
    if (EXCLUDE.includes(logEntry.key_dataset)) return;

    console.log(`[FB-LOG] ${type}:`, logEntry);
    try {
        logEvent(analytics, type, logEntry);
    } catch (e) {
        console.error("[Analytics Error]:", e);
    }
}

