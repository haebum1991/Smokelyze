
/**
 * UI Time Controls for AirNow hourly data
 * All functions prefixed with [airnow] for modularity
 * UI shows local time, but internally converts to UTC for data requests
 */

import { currentDate } from "./utils.js";
import { airnowSetCurrentTime } from "./airnow.js";

/**
 * Convert local hour to UTC hour for a SPECIFIC date
 * @param {number} localHour - Local hour (0-23)
 * @param {string} isoDate - YYYY-MM-DD
 * @returns {number} UTC hour (0-23)
 */
function localToUTC(localHour, isoDate) {
    const [y, m, d] = isoDate.split("-").map(Number);
    const localDate = new Date(y, m - 1, d, localHour, 0, 0);
    return localDate.getUTCHours();
}

export function utcToLocal(utcHour) {
    const now = new Date();
    const utcDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), utcHour, 0, 0));
    return utcDate.getHours();
}

export function shiftTime(hours) {
    const timePicker = document.getElementById("timePicker");
    const datePicker = document.getElementById("datePicker");
    if (!timePicker) return;

    const currentLocalHour = parseInt(timePicker.value);
    const sum = currentLocalHour + hours;
    let dateChanged = false;

    // Check if we crossed a day boundary
    if (datePicker && (sum >= 24 || sum < 0)) {
        const dayShift = sum >= 24 ? 1 : -1;
        const [y, m, d] = datePicker.value.split("-").map(Number);
        const dt = new Date(Date.UTC(y, m - 1, d + dayShift));

        datePicker.value = dt.toISOString().split("T")[0];
        dateChanged = true;
    }

    const newLocalHour = (sum + 24) % 24;
    timePicker.value = String(newLocalHour).padStart(2, "0");

    const utcHour = localToUTC(newLocalHour, currentDate());
    airnowSetCurrentTime(utcHour);

    if (dateChanged) {
        datePicker.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
        timePicker.dispatchEvent(new Event("change", { bubbles: true }));
    }
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
    
    // Automatically show Day/Night shadow when hourly data is active
    import("./layers.js").then(module => {
        module.setDayNightVisibility(true);
        module.updateDayNightData();
    }).catch(err => console.error("Failed to load layers.js for Day/Night layer:", err));
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
    
    // Automatically hide Day/Night terminator shadow when hourly data is inactive
    import("./layers.js").then(module => {
        module.setDayNightVisibility(false);
    }).catch(err => console.error("Failed to load layers.js for Day/Night layer:", err));
}

export function updateTimezoneLabel(isoDate) {
    const [y, m, d] = isoDate.split("-").map(Number);
    const targetDate = new Date(y, m - 1, d, 12, 0, 0); // Use noon to avoid edge cases
    
    const tzAbbr = new Intl.DateTimeFormat("en-US", { timeZoneName: "short" })
        .formatToParts(targetDate)
        .find(part => part.type === "timeZoneName").value;

    const tzLabel = document.getElementById("timezoneLabel");
    if (tzLabel) tzLabel.textContent = tzAbbr;
}

export function initTimePicker() {
    const timePicker = document.getElementById("timePicker");
    if (!timePicker) return;

    const initialDate = currentDate();
    const now = new Date();
    now.setHours(now.getHours() - 2);

    const localHour = now.getHours();
    timePicker.value = String(localHour).padStart(2, "0");

    const utcHour = localToUTC(localHour, initialDate);
    airnowSetCurrentTime(utcHour);
    
    updateTimezoneLabel(initialDate);

    timePicker.addEventListener("change", () => {
        const selectedLocalHour = parseInt(timePicker.value);
        const utcHour = localToUTC(selectedLocalHour, currentDate());
        airnowSetCurrentTime(utcHour);
    });
}

