
import { handleTableForLayer } from "./stats-data-export.js";
import { toggleSpinner } from "./loader.js";
import { ESML } from "./utils.js";
import { convertToCSV, downloadFile } from "./ui-download.js";
import { logUserAction } from "./fb-logging.js";
import { airnowGetCurrentTime } from "./airnow.js";

/**
 * Main Entry Point: Opens the Layer Data Table Modal for a given dataset
 */
export async function openLayerTableModal(datasetId, options = {}) {
    const title = options.title || datasetId;
    toggleSpinner(true, `Loading ${title} table...`);

    try {
        const res = await handleTableForLayer(datasetId, options);
        if (!res) return;
        const { data: geoJSONData, date } = res;

        const records = extractTabularRecords(geoJSONData.features);
        if (records.length === 0) {
            alert(`No property records found for ${title}`);
            return;
        }

        renderTableModal({
            datasetId,
            title,
            date,
            geoJSONData,
            records
        });

        logUserAction("view_layer_table", { dataset: datasetId, date, rows: records.length });

    } catch (err) {
        console.error("Failed to open layer table modal:", err);
        alert("Failed to load table data. Please try again.");
    } finally {
        toggleSpinner(false);
    }
}

/**
 * Transforms GeoJSON features into flat tabular objects (including lon/lat)
 */
function extractTabularRecords(features) {
    const records = [];
    const keySet = new Set();

    features.forEach(f => {
        const props = { ...(f.properties || {}) };
        delete props.dsKeyForFigure;

        if (f.geometry && f.geometry.coordinates) {
            const coords = f.geometry.coordinates;
            if (f.geometry.type === "Point" && Array.isArray(coords)) {
                if (props.lon === undefined) props.lon = Number(coords[0].toFixed(4));
                if (props.lat === undefined) props.lat = Number(coords[1].toFixed(4));
            }
        }

        Object.keys(props).forEach(k => {
            if (k !== "dsKeyForFigure") {
                keySet.add(k);
            }
        });
        records.push(props);
    });

    const baseKeys = Array.from(keySet).filter(k => k !== "dsKeyForFigure");
    const priority = ["date", "IncidentName", "site_name", "state", "AQS", "AQS_O3", "AQS_PM", "lon", "lat"];
    const sortedKeys = [];

    priority.forEach(pk => {
        if (baseKeys.includes(pk)) sortedKeys.push(pk);
    });

    baseKeys.forEach(k => {
        if (!sortedKeys.includes(k)) sortedKeys.push(k);
    });

    records._keys = sortedKeys;
    return records;
}

/**
 * Renders standard interactive table view with full vertical scroll
 */
function renderTableModal({ datasetId, title, date, geoJSONData, records }) {
    const existing = document.getElementById("LayerTableOverlay");
    if (existing) existing.remove();
    
    let displayDate = date;
    if (datasetId && datasetId.startsWith("airnow-hourly-")) {
        const utcHour = airnowGetCurrentTime();
        const hourStr = utcHour.toString().padStart(2, "0");
        displayDate = `${date} ${hourStr}:00 UTC`;
    }

    let filteredRecords = [...records];
    let sortKey = null;
    let sortAsc = true;

    const keys = records._keys || Object.keys(records[0] || {});

    const overlay = document.createElement("div");
    overlay.id = "LayerTableOverlay";
    overlay.className = "MapPost-modal-overlay";

    overlay.innerHTML = `
        <div class="MapPost-modal" style="width: 80%;">
            <div class="MapPost-modal-header">
                <div style="
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    flex-wrap: wrap;
                ">
                    <h3>${ESML(title)}</h3>
                    <span style="
                        font-size: 1.4rem;
                        font-weight: bold;
                        color: var(--text-main);
                    ">(${ESML(displayDate)})</span>
                    <span id="LayerTableRecordBadge" style="
                        font-size: 1.4rem;
                        font-weight: bold;
                        padding: 0.2rem 0.8rem;
                        border-radius: 1rem;
                        color: var(--color-bg);
                        background: var(--card-shadow);
                    ">${records.length} records</span>
                </div>
                <div style="
                    display: flex;
                    align-items: center;
                    gap: 2rem;
                ">
                    <input type="text"
                           id="LayerTableSearch"
                           placeholder="Search records..."
                           style="
                               padding: 0.6rem 1.2rem;
                               font-size: 1.4rem;
                               border-radius: var(--border-radius-0p8rem);
                               border: 0.1rem solid var(--card-shadow);
                               background: var(--color-bg);
                               color: var(--text-main);
                               outline: none;
                               width: 20rem;
                           " />
                    <button type="button" id="LayerTableExportCsv" class="export-btn-csv">⬇ .CSV</button>
                    <button type="button" class="ui-btn-close" id="LayerTableClose" title="Close">
                        <svg width="20" height="20"><use xlink:href="#icon-close" /></svg>
                    </button>
                </div>
            </div>
            <div class="MapPost-modal-body" style="padding: 0; overflow: auto;">
                <table style="
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 1.3rem;
                ">
                    <thead>
                        <tr id="LayerTableHeaderRow"></tr>
                    </thead>
                    <tbody id="LayerTableBodyRow"></tbody>
                </table>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const closeModal = () => {
        overlay.style.opacity = "0";
        setTimeout(() => overlay.remove(), 200);
    };

    overlay.querySelector("#LayerTableClose").addEventListener("click", closeModal);

    overlay.querySelector("#LayerTableExportCsv").addEventListener("click", () => {
        const sanitizedGeoJSON = {
            ...geoJSONData,
            features: (geoJSONData.features || []).map(f => {
                const props = { ...(f.properties || {}) };
                delete props.dsKeyForFigure;
                return { ...f, properties: props };
            })
        };
        const csv = convertToCSV(sanitizedGeoJSON);
        if (csv) {
            downloadFile(`${datasetId}_${date}.csv`, csv);
        }
    });

    const searchInput = overlay.querySelector("#LayerTableSearch");
    searchInput.addEventListener("input", (e) => {
        const query = e.target.value.trim().toLowerCase();
        if (!query) {
            filteredRecords = [...records];
        } else {
            filteredRecords = records.filter(rec => {
                return keys.some(k => {
                    const val = rec[k];
                    return val !== undefined && val !== null && String(val).toLowerCase().includes(query);
                });
            });
        }
        updateTable();
    });

    const headerRow = overlay.querySelector("#LayerTableHeaderRow");
    const renderHeaders = () => {
        headerRow.innerHTML = keys.map(k => {
            const isSorted = sortKey === k;
            const sortIcon = isSorted ? (sortAsc ? " ▲" : " ▼") : " <span style='opacity:0.35;'>↕</span>";
            const bg = isSorted ? "var(--sidebar-widget-bg)" : "var(--map-toolbar-bg)";
            const color = isSorted ? "var(--text-strong)" : "var(--text-heading)";
            return `
                <th data-key="${ESML(k)}"
                    title="Click to sort by ${ESML(k)}"
                    style="
                        cursor: pointer;
                        user-select: none;
                        white-space: nowrap;
                        padding: 1rem 1.2rem;
                        background: ${bg};
                        color: ${color};
                        border-bottom: 0.2rem solid var(--border-light);
                        position: sticky;
                        top: 0;
                        z-index: 2;
                        text-align: left;
                        font-weight: bold;
                        font-size: 1.3rem;
                        transition: background 0.2s;
                    ">${ESML(k)}${sortIcon}</th>
            `;
        }).join("");

        headerRow.querySelectorAll("th").forEach(th => {
            th.addEventListener("mouseenter", () => {
                if (th.dataset.key !== sortKey) {
                    th.style.background = "var(--sidebar-widget-bg)";
                }
            });
            th.addEventListener("mouseleave", () => {
                if (th.dataset.key !== sortKey) {
                    th.style.background = "var(--map-toolbar-bg)";
                }
            });
            th.addEventListener("click", () => {
                const key = th.dataset.key;
                if (sortKey === key) {
                    sortAsc = !sortAsc;
                } else {
                    sortKey = key;
                    sortAsc = true;
                }

                filteredRecords.sort((a, b) => {
                    let vA = a[sortKey];
                    let vB = b[sortKey];
                    if (vA === undefined || vA === null) return 1;
                    if (vB === undefined || vB === null) return -1;
                    if (typeof vA === "number" && typeof vB === "number") {
                        return sortAsc ? vA - vB : vB - vA;
                    }
                    return sortAsc ? String(vA).localeCompare(String(vB)) : String(vB).localeCompare(String(vA));
                });

                renderHeaders();
                updateTable();
            });
        });
    };

    const updateTable = () => {
        const totalRows = filteredRecords.length;
        const badge = overlay.querySelector("#LayerTableRecordBadge");
        if (badge) {
            badge.textContent = totalRows === records.length
                ? `${totalRows} records`
                : `${totalRows} / ${records.length} records`;
        }

        const tbody = overlay.querySelector("#LayerTableBodyRow");
        if (filteredRecords.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="${keys.length}"
                        style="
                            text-align: center;
                            padding: 3rem;
                            color: var(--text-muted);
                            font-size: 1.4rem;
                        ">No matching records found.</td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filteredRecords.map((row, idx) => {
            const rowBg = idx % 2 === 1 ? "rgba(255, 255, 255, 0.02)" : "transparent";
            const cells = keys.map(k => {
                const val = row[k];
                const display = (val !== undefined && val !== null) ? ESML(String(val)) : "-";
                return `
                    <td style="
                        padding: 0.8rem 1.2rem;
                        color: var(--text-main);
                        font-size: 1.3rem;
                        border-bottom: 0.1rem solid var(--border-light);
                        white-space: nowrap;
                    ">${display}</td>
                `;
            }).join("");
            return `
                <tr style="background: ${rowBg}; transition: background 0.15s;"
                    onmouseenter="this.style.background='rgba(255,255,255,0.07)'"
                    onmouseleave="this.style.background='${rowBg}'">${cells}</tr>
            `;
        }).join("");
    };

    renderHeaders();
    updateTable();
}

