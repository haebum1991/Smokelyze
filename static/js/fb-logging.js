
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
        id_user: String(uid || ""),
        id_session: String(sessionId || ""),
        id_view: String(currentViewId || ""),
        id_page: String(page || ""),

        // Background Context & Specific Details (Normalized to Strings)
        key_dataset: String(payload.dataset || ""),
        key_layer: String(payload.layer || ""),
        key_aqs: payload.aqs ? "aqs_" + String(payload.aqs) : "none",
        key_state: String(payload.state || ""),
        key_filename: String(payload.filename || ""),
        key_report_type: String(payload.report_type || ""),
        key_date: String(payload.date || document.getElementById("datePicker")?.value || "")
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

