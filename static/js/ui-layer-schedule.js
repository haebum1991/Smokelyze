
/**
 * ui-layer-schedule.js
 * 
 * Layer Data Collection & Update Timetable Modal
 * Uses Smokelyze standard modal structure (MapPost-modal-overlay / MapPost-modal-content),
 * core CSS variables (var(--text-main), var(--card-shadow), var(--color-bg), var(--map-toolbar-bg)),
 * and self-contained inline styling.
 */

export const LAYER_SCHEDULE_REGISTRY = [
    // 1. NIFC & Realtime Wildfire
    {
        category: "NIFC & Realtime",
        categoryColor: "#ef4444",
        layers: [
            {
                id: "wildfire-news",
                title: "Wildfire News",
                cycleType: "6h",
                utcHours: [0, 6, 12, 18],
                cycleLabel: "Every 6 hours (0, 6, 12, 18 UTC)",
                daysLag: 0
            },
            {
                id: "MapPost",
                title: "MapPost",
                cycleType: "realtime",
                utcHours: Array.from({ length: 24 }, (_, i) => i),
                cycleLabel: "Real-time sync",
                daysLag: 0
            },
            {
                id: "nifc-live",
                title: "NIFC (Live)",
                cycleType: "hourly",
                utcHours: Array.from({ length: 24 }, (_, i) => i),
                cycleLabel: "Every hour",
                daysLag: 0
            },
            {
                id: "nifc-historical",
                title: "NIFC (Historical)",
                cycleType: "6h",
                utcHours: [0, 6, 12, 18],
                cycleLabel: "Every 6 hours (0, 6, 12, 18 UTC)",
                daysLag: 0
            }
        ]
    },

    // 2. EPA AirNow & AirFuse
    {
        category: "AirNow",
        categoryColor: "#3b82f6",
        layers: [
            {
                id: "airnow-daily",
                title: "AirNow (Daily)",
                cycleType: "daily",
                utcHours: [9],
                cycleLabel: "Daily @ 09:00 UTC",
                daysLag: 1
            },
            {
                id: "airnow-hourly",
                title: "AirNow (Hourly)",
                cycleType: "6h",
                utcHours: [3, 9, 15, 21],
                cycleLabel: "Every 6 hours (3, 9, 15, 21 UTC)",
                daysLag: 0
            },
            {
                id: "airfuse",
                title: "AirFuse",
                cycleType: "6h",
                utcHours: [3, 9, 15, 21],
                cycleLabel: "Every 6 hours (3, 9, 15, 21 UTC)",
                daysLag: 1
            }
        ]
    },

    // 3. Satellite Remote Sensing
    {
        category: "Satellite-based",
        categoryColor: "#f59e0b",
        layers: [
            {
                id: "hms",
                title: "HMS",
                cycleType: "twice-daily",
                utcHours: [13, 18],
                cycleLabel: "Twice Daily (13:00, 18:00 UTC)",
                daysLag: 0
            },
            {
                id: "tempo",
                title: "TEMPO",
                cycleType: "daily",
                utcHours: [12],
                cycleLabel: "Daily @ 12:00 UTC",
                daysLag: 1
            },
            {
                id: "tropomi",
                title: "TROPOMI",
                cycleType: "daily",
                utcHours: [16],
                cycleLabel: "Daily @ 16:00 UTC",
                daysLag: 14
            },
            {
                id: "goes",
                title: "GOES",
                cycleType: "daily",
                utcHours: [12],
                cycleLabel: "Daily @ 12:00 UTC",
                daysLag: 1
            },
            {
                id: "viirs",
                title: "VIIRS",
                cycleType: "daily",
                utcHours: [12],
                cycleLabel: "Daily @ 12:00 UTC",
                daysLag: 1
            },
            {
                id: "modis",
                title: "MODIS",
                cycleType: "As-Available",
                utcHours: [],
                cycleLabel: "As-Available",
                daysLag: null
            }
        ]
    },

    // 4. Numerical Chemical & Meteorological Models
    {
        category: "Model-based",
        categoryColor: "#8b5cf6",
        layers: [
            {
                id: "hrrr",
                title: "HRRR",
                cycleType: "daily",
                utcHours: [12],
                cycleLabel: "Daily @ 12:00 UTC",
                daysLag: 1
            },
            {
                id: "geoscf",
                title: "GEOS-CF",
                cycleType: "daily",
                utcHours: [12],
                cycleLabel: "Daily @ 12:00 UTC",
                daysLag: 2
            }
        ]
    },

    // 5. Published Research & Latest Predictions
    {
        category: "Published & Latest",
        categoryColor: "#10b981",
        layers: [
            {
                id: "uw-smoke-pm25-latest",
                title: "UW Smoke PM2.5 (+2025)",
                cycleType: "daily",
                utcHours: [17],
                cycleLabel: "Daily @ 17:00 UTC",
                daysLag: 3
            },
            {
                id: "uw-gam-v2-latest",
                title: "UW GAM-v2 (+2025)",
                cycleType: "daily",
                utcHours: [17],
                cycleLabel: "Daily @ 17:00 UTC",
                daysLag: 62
            }
        ]
    }
];

let useLocalTime = true;
let timerInterval = null;

/**
 * Gets user's local timezone metadata (name and UTC offset in hours)
 */
function getUserTimezoneInfo() {
    const now = new Date();
    const tzName = Intl.DateTimeFormat().resolvedOptions().timeZone || "Local";
    let tzAbbr = "";
    try {
        const parts = new Intl.DateTimeFormat("en-US", { timeZoneName: "short" }).formatToParts(now);
        const tzPart = parts.find(p => p.type === "timeZoneName");
        if (tzPart) tzAbbr = tzPart.value;
    } catch (e) {
        tzAbbr = "";
    }
    if (!tzAbbr) tzAbbr = tzName.split("/").pop()?.replace(/_/g, " ") || "Local";

    const offsetMin = -now.getTimezoneOffset();
    const offsetHours = offsetMin / 60;
    const sign = offsetHours >= 0 ? "+" : "-";
    const absH = Math.floor(Math.abs(offsetHours));
    const absM = Math.abs(offsetMin % 60);
    const formattedOffset = `UTC${sign}${absH}${absM > 0 ? `:${String(absM).padStart(2, "0")}` : ""}`;

    return {
        tzName,
        tzAbbr,
        offsetHours,
        formattedOffset
    };
}

/**
 * Converts a UTC hour (0-23) to display hour based on useLocalTime toggle
 */
function convertHour(utcHour, offsetHours) {
    if (!useLocalTime) return utcHour;
    return (utcHour + Math.round(offsetHours) + 24) % 24;
}

/**
 * Calculates next upcoming update countdown string from UTC schedule hours
 */
function getNextUpdateCountdown(layer) {
    if (!layer || layer.cycleType === "realtime") {
        return { text: "Real-time", nextDate: null };
    }

    const { utcHours, cycleType } = layer;
    if (!utcHours || utcHours.length === 0) return { text: "-", nextDate: null };

    const now = new Date();
    const currentUtcHour = now.getUTCHours();
    const currentUtcMin = now.getUTCMinutes();

    if (cycleType === "hourly") {
        const minsLeft = 60 - currentUtcMin;
        return { text: `in ${minsLeft}m`, nextDate: null };
    }

    const sorted = [...utcHours].sort((a, b) => a - b);
    let nextUtcHour = sorted.find(h => h > currentUtcHour || (h === currentUtcHour && currentUtcMin === 0));
    let daysAhead = 0;

    if (nextUtcHour === undefined) {
        nextUtcHour = sorted[0];
        daysAhead = 1;
    }

    const targetDate = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + daysAhead,
        nextUtcHour,
        0, 0
    ));

    const diffMs = targetDate - now;
    if (diffMs <= 0) return { text: "Scheduled", nextDate: targetDate };

    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHrs === 0) {
        return { text: `in ${diffMins}m`, nextDate: targetDate };
    }
    return { text: `in ${diffHrs}h ${diffMins}m`, nextDate: targetDate };
}

/**
 * Calculates dynamic latest data availability string (e.g. "2026-08-23 (D-1)")
 * Accurately branches between Local calendar date and UTC calendar date based on useLocalTime toggle
 */
function getCalculatedLatestData(layer) {
    if (!layer) return "-";
    if (layer.cycleType === "realtime") return "Live (Today)";
    if (layer.daysLag === undefined || layer.daysLag === null) return "As-Available";

    const now = new Date();
    let yyyy, mm, dd;

    if (useLocalTime) {
        // Local Timezone calculation
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        d.setDate(d.getDate() - layer.daysLag);
        yyyy = d.getFullYear();
        mm = String(d.getMonth() + 1).padStart(2, "0");
        dd = String(d.getDate()).padStart(2, "0");
    } else {
        // UTC Timezone calculation
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        d.setUTCDate(d.getUTCDate() - layer.daysLag);
        yyyy = d.getUTCFullYear();
        mm = String(d.getUTCMonth() + 1).padStart(2, "0");
        dd = String(d.getUTCDate()).padStart(2, "0");
    }

    const dateStr = `${yyyy}-${mm}-${dd}`;

    if (layer.daysLag === 0) return `${dateStr} (Today)`;
    return `${dateStr} (D-${layer.daysLag})`;
}

/**
 * Generates the full HTML markup for the 24-hour visual matrix and schedule table
 */
function renderTimetableContent() {
    const tzInfo = getUserTimezoneInfo();
    const now = new Date();
    const currentHour = useLocalTime ? now.getHours() : now.getUTCHours();

    let matrixHtml = `
        <div class="schedule-matrix-wrapper">
            <div class="schedule-matrix-header">
                <div class="schedule-matrix-title-col">Data Source / Layer</div>
                <div class="schedule-matrix-hours-grid">
                    ${Array.from({ length: 24 }, (_, h) => {
        const label = String(h).padStart(2, "0");
        return `<div class="schedule-hour-cell">${label}</div>`;
    }).join("")}
                </div>
            </div>
            <div class="schedule-matrix-body" style="position: relative;">
                <!-- Vertical reference line centered at current hour column -->
                <div class="schedule-now-line" style="left: calc(190px + (100% - 190px) * ${(currentHour + 0.5) / 24});"></div>
    `;

    LAYER_SCHEDULE_REGISTRY.forEach(group => {
        if (!group.layers || group.layers.length === 0) return;

        matrixHtml += `
            <div class="schedule-category-divider" style="display: flex; align-items: center; gap: 0.6rem;">
                <span class="schedule-cat-dot" style="background-color: ${group.categoryColor};"></span>
                <span>${group.category}</span>
            </div>
        `;

        group.layers.forEach(layer => {
            const displayHours = layer.utcHours.map(h => convertHour(h, tzInfo.offsetHours));

            matrixHtml += `
                <div class="schedule-matrix-row">
                    <div class="schedule-matrix-title-col" style="padding-left: 1.8rem;" title="${layer.title}">
                        <span class="schedule-layer-name">${layer.title}</span>
                    </div>
                    <div class="schedule-matrix-hours-grid">
                        ${Array.from({ length: 24 }, (_, h) => {
                const isScheduled = displayHours.includes(h);
                return `
                    <div class="schedule-matrix-slot ${isScheduled ? 'slot-active' : 'slot-empty'}">
                        ${isScheduled ? `<span class="schedule-slot-dot" style="background-color: ${group.categoryColor};" title="${layer.title} at ${String(h).padStart(2, "0")}:00"></span>` : ""}
                    </div>
                `;
            }).join("")}
                    </div>
                </div>
            `;
        });
    });

    matrixHtml += `
            </div>
        </div>
    `;

    // Detailed Table View
    let tableHtml = `
        <div class="schedule-table-wrapper">
            <table class="schedule-detail-table">
                <thead>
                    <tr>
                        <th style="width: 26%;">Data Source / Layer</th>
                        <th style="width: 23%;">Update Frequency</th>
                        <th style="width: 21%;">Scheduled Times (${useLocalTime ? `Local (${tzInfo.tzAbbr})` : "UTC"})</th>
                        <th style="width: 14%;">Next Run</th>
                        <th style="width: 16%;">Latest Data (${useLocalTime ? `Local` : "UTC"})</th>
                    </tr>
                </thead>
                <tbody>
    `;

    LAYER_SCHEDULE_REGISTRY.forEach(group => {
        if (!group.layers || group.layers.length === 0) return;

        tableHtml += `
            <tr class="schedule-table-cat-row">
                <td colspan="5" style="background: var(--map-toolbar-bg); padding: 0.6rem 1.2rem; border-top: 0.1rem solid var(--border-light); border-bottom: 0.1rem solid var(--border-light);">
                    <div style="display: flex; align-items: center; gap: 0.6rem;">
                        <span class="schedule-cat-dot" style="background-color: ${group.categoryColor};"></span>
                        <span style="font-weight: 700; font-size: 1.2rem; color: var(--card-shadow); text-transform: uppercase; letter-spacing: 0.05em;">${group.category}</span>
                    </div>
                </td>
            </tr>
        `;

        group.layers.forEach(layer => {
            const nextInfo = getNextUpdateCountdown(layer);
            let timeBadges = "";

            if (layer.cycleType === "realtime") {
                timeBadges = `<span class="schedule-pill pill-hourly">Real-time Sync</span>`;
            } else if (layer.cycleType === "hourly") {
                timeBadges = `<span class="schedule-pill pill-hourly">Every Hour (00~23)</span>`;
            } else if (layer.cycleType === "As-Available") {
                timeBadges = `<span class="schedule-pill pill-soft">${layer.cycleLabel}</span>`;
            } else {
                const displayHours = layer.utcHours
                    .map(h => convertHour(h, tzInfo.offsetHours))
                    .sort((a, b) => a - b)
                    .map(h => `${String(h).padStart(2, "0")}:00`);
                timeBadges = displayHours.map(t => `<span class="schedule-pill pill-time">${t}</span>`).join(" ");
            }

            let nextBadgeClass = "pill-soft";
            if (nextInfo.text.startsWith("in")) nextBadgeClass = "pill-next";
            else if (nextInfo.text === "Real-time") nextBadgeClass = "pill-hourly";

            tableHtml += `
                <tr>
                    <td style="padding-left: 2.2rem;">
                        <strong style="color: var(--text-main); font-size: 1.3rem;">${layer.title}</strong>
                    </td>
                    <td>
                        <span style="font-size: 1.25rem; color: var(--text-main); font-weight: 500;">${layer.cycleLabel}</span>
                    </td>
                    <td>
                        <div style="display: flex; flex-wrap: wrap; gap: 0.4rem;">
                            ${timeBadges}
                        </div>
                    </td>
                    <td>
                        <span class="schedule-pill ${nextBadgeClass}">${nextInfo.text}</span>
                    </td>
                    <td>
                        <span style="font-size: 1.2rem; font-weight: 600; color: var(--card-shadow);">${getCalculatedLatestData(layer)}</span>
                    </td>
                </tr>
            `;
        });
    });

    tableHtml += `
                </tbody>
            </table>
        </div>
    `;

    return {
        tzInfo,
        now,
        matrixHtml,
        tableHtml
    };
}

/**
 * Updates the modal UI content
 */
/**
 * Updates only the clock string (ultra-lightweight, zero DOM rebuild)
 */
function updateClockOnly() {
    const modal = document.getElementById("LayerScheduleModal");
    if (!modal || modal.style.display === "none") return;

    const tzInfo = getUserTimezoneInfo();
    const now = new Date();
    const headerTimeEl = modal.querySelector("#LayerScheduleCurrentTime");
    if (headerTimeEl) {
        const localStr = now.toLocaleString("en-US", {
            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
        });
        const utcStr = now.toLocaleString("en-US", {
            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "UTC"
        });
        headerTimeEl.innerHTML = `
            <span style="color: var(--text-main);"><b>Local (${tzInfo.tzAbbr}):</b> ${localStr}</span>
            <span style="color: var(--card-shadow);">|</span>
            <span style="color: var(--text-main);"><b>UTC:</b> ${utcStr}</span>
        `;
    }
}

/**
 * Updates the modal UI content (Matrix and Table)
 */
function updateModalDOM() {
    const modal = document.getElementById("LayerScheduleModal");
    if (!modal || modal.style.display === "none") return;

    const content = renderTimetableContent();
    updateClockOnly();

    const containerEl = modal.querySelector("#LayerScheduleContentContainer");
    if (containerEl) {
        containerEl.innerHTML = `
            <div style="margin-bottom: 2rem;">
                <h4 style="margin: 0 0 0.8rem 0; font-size: 1.4rem; color: var(--text-main);">
                    <span>24-Hour Schedule Table</span>
                </h4>
                ${content.matrixHtml}
            </div>
            <div>
                <h4 style="margin: 0 0 0.8rem 0; font-size: 1.4rem; color: var(--text-main);">Detailed Layer Ingestion Table</h4>
                ${content.tableHtml}
            </div>
        `;
    }
}

/**
 * Opens the Layer Data Update Timetable Modal
 */
export function openLayerScheduleModal() {
    let modal = document.getElementById("LayerScheduleModal");

    if (!modal) {
        modal = document.createElement("div");
        modal.id = "LayerScheduleModal";
        modal.className = "MapPost-modal-overlay";
        modal.style.display = "none";
        modal.style.zIndex = "var(--z-highest)";

        modal.innerHTML = `
            <style>
                .schedule-matrix-wrapper {
                    background: var(--color-bg);
                    border: 0.1rem solid var(--border-light);
                    border-radius: var(--border-radius-0p8rem);
                    overflow-x: auto;
                }
                .schedule-matrix-header {
                    display: flex;
                    align-items: center;
                    background: var(--map-toolbar-bg);
                    border-bottom: 0.1rem solid var(--border-light);
                    font-size: 1.15rem;
                    font-weight: 700;
                    color: var(--text-main);
                    min-width: 780px;
                }
                .schedule-matrix-title-col {
                    width: 190px;
                    min-width: 190px;
                    max-width: 190px;
                    padding: 0.7rem 1rem;
                    display: flex;
                    align-items: center;
                    gap: 0.6rem;
                    border-right: 0.1rem solid var(--border-light);
                    box-sizing: border-box;
                }
                .schedule-layer-name {
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    font-size: 1.25rem;
                    font-weight: 500;
                    color: var(--text-main);
                }
                .schedule-cat-dot {
                    width: 0.8rem;
                    height: 0.8rem;
                    border-radius: 50%;
                    flex-shrink: 0;
                }
                .schedule-matrix-hours-grid {
                    display: flex;
                    flex: 1;
                }
                .schedule-hour-cell {
                    flex: 1;
                    text-align: center;
                    padding: 0.5rem 0;
                    border-right: 0.1rem solid var(--border-light);
                    font-size: 1.1rem;
                    color: var(--text-main);
                }
                .schedule-hour-cell:last-child {
                    border-right: none;
                }
                .schedule-matrix-body {
                    min-width: 780px;
                }
                .schedule-category-divider {
                    padding: 0.35rem 1rem;
                    background: var(--map-toolbar-bg);
                    font-size: 1.15rem;
                    font-weight: 700;
                    color: var(--card-shadow);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    border-top: 0.1rem solid var(--border-light);
                    border-bottom: 0.1rem solid var(--border-light);
                }
                .schedule-matrix-row {
                    display: flex;
                    align-items: center;
                    border-bottom: 0.1rem solid var(--border-light);
                }
                .schedule-matrix-slot {
                    flex: 1;
                    height: 2.8rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-right: 0.1rem solid var(--border-light);
                }
                .schedule-matrix-slot:last-child {
                    border-right: none;
                }
                .schedule-slot-dot {
                    width: 0.9rem;
                    height: 0.9rem;
                    border-radius: 50%;
                    box-shadow: 0 0 0.4rem currentColor;
                }
                .schedule-now-line {
                    position: absolute;
                    top: 0;
                    bottom: 0;
                    width: 2px;
                    background: #ef4444;
                    box-shadow: 0 0 6px rgba(239, 68, 68, 0.6);
                    z-index: 10;
                    pointer-events: none;
                }
                .schedule-table-wrapper {
                    background: var(--color-bg);
                    border: 0.1rem solid var(--border-light);
                    border-radius: var(--border-radius-0p8rem);
                    overflow-x: auto;
                }
                .schedule-detail-table {
                    width: 100%;
                    border-collapse: collapse;
                    text-align: left;
                }
                .schedule-detail-table th {
                    background: var(--map-toolbar-bg);
                    padding: 0.9rem 1.2rem;
                    font-size: 1.25rem;
                    font-weight: 700;
                    color: var(--text-main);
                    border-bottom: 0.1rem solid var(--border-light);
                }
                .schedule-detail-table td {
                    padding: 0.9rem 1.2rem;
                    font-size: 1.25rem;
                    border-bottom: 0.1rem solid var(--border-light);
                    vertical-align: middle;
                }
                .schedule-detail-table tr:last-child td {
                    border-bottom: none;
                }
                .schedule-pill {
                    display: inline-flex;
                    align-items: center;
                    padding: 0.2rem 0.6rem;
                    border-radius: 0.4rem;
                    font-size: 1.15rem;
                    font-weight: 600;
                }
                .pill-time {
                    background: rgba(59, 130, 246, 0.12);
                    color: #3b82f6;
                    border: 0.1rem solid rgba(59, 130, 246, 0.3);
                }
                .pill-hourly {
                    background: rgba(16, 185, 129, 0.12);
                    color: #10b981;
                    border: 0.1rem solid rgba(16, 185, 129, 0.3);
                }
                .pill-next {
                    background: rgba(16, 185, 129, 0.15);
                    color: #10b981;
                    border: 0.1rem solid rgba(16, 185, 129, 0.3);
                }
                .pill-soft {
                    background: var(--map-toolbar-bg);
                    color: var(--card-shadow);
                    border: 0.1rem solid var(--border-light);
                }
            </style>

            <div class="MapPost-modal" style="width: 70%;">
                <div class="MapPost-modal-header">
                    <div>
                        <h3>Layer Ingestion & Update Timetable</h3>
                        <div id="LayerScheduleCurrentTime" style="display: flex; gap: 0.8rem; margin-top: 0.3rem; font-size: 1.25rem;"></div>
                    </div>

                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <div style="display: flex; gap: 1rem;">
                            <button type="button" class="layer-schedule-btn ${useLocalTime ? 'active' : ''}" id="ScheduleTzBtnLocal">Local (${getUserTimezoneInfo().tzAbbr})</button>
                            <button type="button" class="layer-schedule-btn ${!useLocalTime ? 'active' : ''}" id="ScheduleTzBtnUtc">UTC</button>
                        </div>
                        <button type="button" class="ui-btn-close" id="LayerScheduleModalClose" title="Close">
                            <svg width="20" height="20"><use xlink:href="#icon-close" /></svg>
                        </button>
                    </div>
                </div>

                <div class="MapPost-modal-body" id="LayerScheduleContentContainer"></div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector("#LayerScheduleModalClose")?.addEventListener("click", closeLayerScheduleModal);

        modal.querySelector("#ScheduleTzBtnLocal")?.addEventListener("click", () => {
            useLocalTime = true;
            modal.querySelector("#ScheduleTzBtnLocal")?.classList.add("active");
            modal.querySelector("#ScheduleTzBtnUtc")?.classList.remove("active");
            updateModalDOM();
        });

        modal.querySelector("#ScheduleTzBtnUtc")?.addEventListener("click", () => {
            useLocalTime = false;
            modal.querySelector("#ScheduleTzBtnUtc")?.classList.add("active");
            modal.querySelector("#ScheduleTzBtnLocal")?.classList.remove("active");
            updateModalDOM();
        });

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && modal.style.display === "flex") {
                closeLayerScheduleModal();
            }
        });
    }

    modal.style.display = "flex";
    updateModalDOM();

    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (modal.style.display === "flex") {
            updateClockOnly();
            if (new Date().getSeconds() === 0) {
                updateModalDOM();
            }
        }
    }, 1000);
}

/**
 * Closes the Layer Schedule Modal
 */
export function closeLayerScheduleModal() {
    const modal = document.getElementById("LayerScheduleModal");
    if (modal) modal.style.display = "none";
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

/**
 * Injects self-contained module styles for the header button and mobile responsiveness
 */
function injectScheduleStyles() {
    if (document.getElementById("LayerScheduleGlobalStyles")) return;
    const style = document.createElement("style");
    style.id = "LayerScheduleGlobalStyles";
    style.textContent = `
        .layer-schedule-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 0.5rem 0.8rem;
            font-size: 1.4rem;
            font-weight: bold;
            color: var(--text-main);
            background: var(--map-toolbar-bg, rgba(255, 255, 255, 0.15));
            border: 0.1rem solid var(--card-shadow, rgba(255, 255, 255, 0.3));
            border-radius: var(--border-radius-0p8rem);
            cursor: pointer;
            transition: all 0.2s ease;
        }
        #LayerScheduleBtn {
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            padding: 0.5rem 0.5rem;
            display: inline-flex;
            align-items: center;
            justify-content: center;
        }
        @media (hover: hover) {
            .layer-schedule-btn:hover {
                background: var(--card-shadow);
                color: var(--color-bg);
                border-color: var(--card-shadow);
            }
        }
        .layer-schedule-btn.active {
            background: var(--card-shadow);
            color: var(--color-bg);
            border-color: var(--card-shadow);
        }
        /* Hide drawer header button on mobile / tablet */
        @media (max-width: 1024px) {
            #LayerScheduleBtn {
                display: none !important;
            }
        }
    `;
    document.head.appendChild(style);
}

/**
 * Initializes the header button listener and injects self-contained styles
 */
export function initLayerScheduleModal() {
    injectScheduleStyles();

    const btn = document.getElementById("LayerScheduleBtn");
    if (btn) {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            openLayerScheduleModal();
        });
    }
}

