
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

export function utcToLocal(utcHour) {
    const now = new Date();
    const utcDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), utcHour, 0, 0));
    return utcDate.getHours();
}

export function shiftTime(hours) {
    const timePicker = document.getElementById("timePicker");
    if (!timePicker) return;

    const currentLocalHour = parseInt(timePicker.value);
    const newLocalHour = (currentLocalHour + hours + 24) % 24;

    timePicker.value = String(newLocalHour).padStart(2, "0");

    const utcHour = localToUTC(newLocalHour);
    airnowSetCurrentTime(utcHour);
    timePicker.dispatchEvent(new Event("change", { bubbles: true }));
}

export function initTimeButtons() {
    const pairs = [
        ["minus1h", -1],
        ["plus1h", 1]
    ];

    pairs.forEach(([cls, h]) => {
        document.querySelectorAll(`.${cls}`).forEach(el => {
            el.addEventListener("click", () => shiftTime(h));
        });
    });
}

export function showTimeControls() {
    const ids = ["timePicker", "timezoneLabel", "onMapMinus1h", "onMapPlus1h", "StatsInputMinus1h", "StatsInputPlus1h"];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = "block";
    });

    // Month buttons toggle for mobile
    if (window.innerWidth <= 1024) {
        ["onMapMinus1m", "onMapPlus1m", "StatsInputMinus1m", "StatsInputPlus1m"].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.setProperty("display", "none", "important");
        });
    }
}

export function hideTimeControls() {
    const ids = ["timePicker", "timezoneLabel", "onMapMinus1h", "onMapPlus1h", "StatsInputMinus1h", "StatsInputPlus1h"];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = "none";
    });

    // Month buttons toggle for mobile
    if (window.innerWidth <= 1024) {
        ["onMapMinus1m", "onMapPlus1m", "StatsInputMinus1m", "StatsInputPlus1m"].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.setProperty("display", "block", "important");
        });
    }
}

export function initTimePicker() {
    const timePicker = document.getElementById("timePicker");
    if (!timePicker) return;

    const now = new Date();
    now.setHours(now.getHours() - 2);

    const localHour = now.getHours();
    timePicker.value = String(localHour).padStart(2, "0");

    const utcHour = localToUTC(localHour);
    airnowSetCurrentTime(utcHour);
    
    const selectedDate = new Date();
    const tzAbbr = new Intl.DateTimeFormat("en-US", { timeZoneName: "short" })
        .formatToParts(selectedDate)
        .find(part => part.type === "timeZoneName").value;

    const tzLabel = document.getElementById("timezoneLabel");
    if (tzLabel) tzLabel.textContent = tzAbbr;

    timePicker.addEventListener("change", () => {
        const selectedLocalHour = parseInt(timePicker.value);
        const utcHour = localToUTC(selectedLocalHour);
        airnowSetCurrentTime(utcHour);
    });
}

