
/**
 * UI Time Controls for AirNow hourly data
 * All functions prefixed with [airnow] for modularity
 * UI shows local time, but internally converts to UTC for data requests
 */

import { currentDate } from "./utils.js";
import { airnowSetCurrentTime } from "./airnow.js";

/**
 * Convert local hour to UTC hour
 * @param {number} localHour - Local hour (0-23)
 * @returns {number} UTC hour (0-23)
 */
function localToUTC(localHour) {
    const now = new Date();
    const localDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), localHour, 0, 0);
    return localDate.getUTCHours();
}

/**
 * Convert UTC hour to local hour
 * @param {number} utcHour - UTC hour (0-23)
 * @returns {number} Local hour (0-23)
 */
export function utcToLocal(utcHour) {
    const now = new Date();
    const utcDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), utcHour, 0, 0));
    return utcDate.getHours();
}

/**
 * Shift time picker by specified hours
 * @param {number} hours - Hours to shift (positive or negative)
 */
export function shiftTime(hours) {
    const timePicker = document.getElementById("timePicker");
    if (!timePicker) return;

    // For select, value is just the hour number
    let currentLocalHour = parseInt(timePicker.value);
    let newLocalHour = (currentLocalHour + hours + 24) % 24;

    // Set value as padded hour
    timePicker.value = String(newLocalHour).padStart(2, "0");

    // Convert to UTC for data requests
    const utcHour = localToUTC(newLocalHour);
    airnowSetCurrentTime(utcHour);
    timePicker.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * Initialize time navigation buttons
 */
export function initTimeButtons() {
    const pairs = [
        ["minus1h", -1],
        ["plus1h", 1]
    ];

    pairs.forEach(([cls, h]) => {
        document.querySelectorAll("." + cls).forEach(el => {
            el.addEventListener("click", () => shiftTime(h));
        });
    });
}

/**
 * Show time controls (time picker and hour buttons)
 */
export function showTimeControls() {
    const timePicker = document.getElementById("timePicker");
    const minus1h = document.getElementById("onMapMinus1h");
    const plus1h = document.getElementById("onMapPlus1h");
    const minus1h_stats = document.getElementById("StatsInputMinus1h");
    const plus1h_stats = document.getElementById("StatsInputPlus1h");
    
    // Month buttons
    const mapminus1m = document.getElementById("onMapMinus1m");
    const mapplus1m = document.getElementById("onMapPlus1m");
    const statminus1m = document.getElementById("StatsInputMinus1m");
    const statplus1m = document.getElementById("StatsInputPlus1m");
    
    if (timePicker) timePicker.style.display = "block";
    if (minus1h) minus1h.style.display = "block";
    if (plus1h) plus1h.style.display = "block";
    if (minus1h_stats) minus1h_stats.style.display = "block";
    if (plus1h_stats) plus1h_stats.style.display = "block";
    
    // [수정] 모바일(1024px 이하)에서만 월 버튼 숨김 처리
    if (window.innerWidth <= 1024) {
        if (mapminus1m) mapminus1m.style.setProperty("display", "none", "important");
        if (mapplus1m) mapplus1m.style.setProperty("display", "none", "important");
        if (statminus1m) statminus1m.style.setProperty("display", "none", "important");
        if (statplus1m) statplus1m.style.setProperty("display", "none", "important");
    }
}

/**
 * Hide time controls (time picker and hour buttons)
 */
export function hideTimeControls() {
    const timePicker = document.getElementById("timePicker");
    const minus1h = document.getElementById("onMapMinus1h");
    const plus1h = document.getElementById("onMapPlus1h");
    const minus1h_stats = document.getElementById("StatsInputMinus1h");
    const plus1h_stats = document.getElementById("StatsInputPlus1h");
    
    // Month buttons
    const mapminus1m = document.getElementById("onMapMinus1m");
    const mapplus1m = document.getElementById("onMapPlus1m");
    const statminus1m = document.getElementById("StatsInputMinus1m");
    const statplus1m = document.getElementById("StatsInputPlus1m");
    
    if (timePicker) timePicker.style.display = "none";
    if (minus1h) minus1h.style.display = "none";
    if (plus1h) plus1h.style.display = "none";
    if (minus1h_stats) minus1h_stats.style.display = "none";
    if (plus1h_stats) plus1h_stats.style.display = "none";
    
    // [수정] 모바일(1024px 이하)에서만 월 버튼 다시 표시
    if (window.innerWidth <= 1024) {
        if (mapminus1m) mapminus1m.style.setProperty("display", "block", "important");
        if (mapplus1m) mapplus1m.style.setProperty("display", "block", "important");
        if (statminus1m) statminus1m.style.setProperty("display", "block", "important");
        if (statplus1m) statplus1m.style.setProperty("display", "block", "important");
    }
}

/**
 * Initialize time picker with current local hour
 */
export function initTimePicker() {
    const timePicker = document.getElementById("timePicker");
    if (!timePicker) return;

    // Set to 2 hours before current local hour (AirNow data usually has some delay)
    const now = new Date();
    now.setHours(now.getHours() - 2);
    
    const localHour = now.getHours();
    timePicker.value = String(localHour).padStart(2, "0");

    // Convert to UTC for internal use
    const utcHour = localToUTC(localHour);
    airnowSetCurrentTime(utcHour);

    // Add change listener to convert local to UTC
    timePicker.addEventListener("change", function () {
        const selectedLocalHour = parseInt(timePicker.value);
        const utcHour = localToUTC(selectedLocalHour);
        airnowSetCurrentTime(utcHour);
    });
}

