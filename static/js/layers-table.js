
import { handleTableForLayer } from "./stats-data-export.js";
import { toggleSpinner } from "./loader.js";
import { ESML, highlightLocation, sanitizeDisplayValue } from "./utils.js";
import { convertToCSV, downloadFile } from "./ui-download.js";
import { airnowGetCurrentTime } from "./airnow.js";
import { DATASET_SOURCE_MAP } from "./layers-def.js";
import { loadedGeoJSON, loadedSources } from "./loader-state.js";
import { logUserAction } from "./fb-logging.js";

/**
 * Main Entry Point: Opens the Layer Data Table Modal for a given dataset
 */
export async function openLayerTableModal(datasetId, options = {}) {

    // Auto-enable layer checkbox if off
    const cleanId = datasetId.replace(/^layer-/, "");
    const cb = document.getElementById(`layer-${cleanId}`);
    if (cb && !cb.checked) {
        cb.checked = true;
        cb.dispatchEvent(new Event("change", { bubbles: true }));
    }
    
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
 * Safely calculates the center [lon, lat] of any geometry type (Point, Polygon, MultiPolygon)
 */
function getFeatureCenter(f) {
    if (!f || !f.geometry || !f.geometry.coordinates) return null;
    const { type, coordinates } = f.geometry;

    if (type === "Point" && Array.isArray(coordinates) && coordinates.length >= 2) {
        return [Number(coordinates[0]), Number(coordinates[1])];
    }

    let ring = null;
    if (type === "Polygon" && Array.isArray(coordinates) && coordinates[0]) {
        ring = coordinates[0];
    } else if (type === "MultiPolygon" && Array.isArray(coordinates) && coordinates[0] && coordinates[0][0]) {
        ring = coordinates[0][0];
    }

    if (ring && ring.length > 0) {
        let sumLon = 0;
        let sumLat = 0;
        let count = 0;
        ring.forEach(pt => {
            if (Array.isArray(pt) && pt.length >= 2) {
                sumLon += pt[0];
                sumLat += pt[1];
                count++;
            }
        });
        if (count > 0) {
            return [sumLon / count, sumLat / count];
        }
    }

    const p = f.properties || {};
    const lon = Number(p.lon ?? p.poly_lon ?? p.longitude ?? p.attr_longitude);
    const lat = Number(p.lat ?? p.poly_lat ?? p.latitude ?? p.attr_latitude);
    if (!isNaN(lon) && !isNaN(lat) && (lon !== 0 || lat !== 0)) {
        return [lon, lat];
    }

    return null;
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

        const center = getFeatureCenter(f);
        if (center) {
            if (props.lon === undefined) props.lon = Number(center[0].toFixed(4));
            if (props.lat === undefined) props.lat = Number(center[1].toFixed(4));
        }

        props._rawFeature = f;

        Object.keys(props).forEach(k => {
            if (k !== "dsKeyForFigure" && k !== "_rawFeature") {
                keySet.add(k);
            }
        });
        records.push(props);
    });

    const baseKeys = Array.from(keySet).filter(k => k !== "dsKeyForFigure" && k !== "_rawFeature");
    const priority = ["date", "IncidentName", "poly_IncidentName", "site_name", "state", "AQS", "AQS_O3", "AQS_PM", "lon", "lat"];
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

const formatValue = (v) => sanitizeDisplayValue(v, "-");

/**
 * Renders standard interactive table view with full vertical scroll
 */
function renderTableModal({ datasetId, title, date, geoJSONData, records }) {
    const existing = document.getElementById("LayerTableOverlay");
    if (existing) existing.remove();
    
    const displayDate = (records && records[0] && records[0].date) ? records[0].date : date;

    let filteredRecords = [...records];
    let sortKey = null;
    let sortAsc = true;
    let currentPage = 1;
    let pageSize = 25;

    const keys = records._keys || Object.keys(records[0] || {});

    const overlay = document.createElement("div");
    overlay.id = "LayerTableOverlay";
    overlay.className = "MapPost-modal-overlay";

    overlay.innerHTML = `
        <div class="MapPost-modal" style="width: 80%; display: flex; flex-direction: column;">
            <div class="MapPost-modal-header" style="flex: 0 0 auto;">
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
            <div class="MapPost-modal-body" style="padding: 0; overflow: auto; flex: 1 1 auto;">
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
            <div class="MapPost-modal-footer" style="
                flex: 0 0 auto;
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 1rem 1.5rem;
                background: var(--map-toolbar-bg);
                border-top: 0.1rem solid var(--border-light);
                font-size: 1.3rem;
                color: var(--text-main);
                flex-wrap: wrap;
                gap: 1rem;
            ">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <span>Rows per page:</span>
                    <select id="LayerTablePageSize" style="
                        padding: 0.3rem 0.8rem;
                        font-size: 1.3rem;
                        border-radius: 0.4rem;
                        border: 0.1rem solid var(--border-light);
                        background: var(--color-bg);
                        color: var(--text-main);
                        outline: none;
                        cursor: pointer;
                    ">
                        <option value="25" selected>25</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                    </select>
                    <span id="LayerTableRangeText" style="color: var(--text-muted); font-weight: bold;"></span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem;" id="LayerTablePaginationNav">
                    <button type="button" id="LayerTableFirst" title="First Page" style="
                        padding: 0.4rem 0.9rem;
                        font-size: 1.2rem;
                        border-radius: 0.4rem;
                        border: 0.1rem solid var(--border-light);
                        background: var(--color-bg);
                        color: var(--text-main);
                        cursor: pointer;
                    ">⏮</button>
                    <button type="button" id="LayerTablePrev" title="Previous Page" style="
                        padding: 0.4rem 0.9rem;
                        font-size: 1.2rem;
                        border-radius: 0.4rem;
                        border: 0.1rem solid var(--border-light);
                        background: var(--color-bg);
                        color: var(--text-main);
                        cursor: pointer;
                    ">◀</button>
                    <span id="LayerTablePageInfo" style="font-weight: bold; padding: 0 0.8rem;">Page 1 of 1</span>
                    <button type="button" id="LayerTableNext" title="Next Page" style="
                        padding: 0.4rem 0.9rem;
                        font-size: 1.2rem;
                        border-radius: 0.4rem;
                        border: 0.1rem solid var(--border-light);
                        background: var(--color-bg);
                        color: var(--text-main);
                        cursor: pointer;
                    ">▶</button>
                    <button type="button" id="LayerTableLast" title="Last Page" style="
                        padding: 0.4rem 0.9rem;
                        font-size: 1.2rem;
                        border-radius: 0.4rem;
                        border: 0.1rem solid var(--border-light);
                        background: var(--color-bg);
                        color: var(--text-main);
                        cursor: pointer;
                    ">⏭</button>
                </div>
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
            let filename = `${datasetId}_${date}.csv`;
            if (datasetId && datasetId.startsWith("airnow-hourly-")) {
                const hourStr = airnowGetCurrentTime().toString().padStart(2, "0");
                filename = `${datasetId}_${date}_${hourStr}T.csv`;
            }
            downloadFile(filename, csv);
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
                    const valStr = formatValue(rec[k]).toLowerCase();
                    return valStr.includes(query);
                });
            });
        }
        currentPage = 1;
        updateTable();
    });

    const pageSizeSelect = overlay.querySelector("#LayerTablePageSize");
    pageSizeSelect.addEventListener("change", (e) => {
        pageSize = Number(e.target.value) || 50;
        currentPage = 1;
        updateTable();
    });

    const btnFirst = overlay.querySelector("#LayerTableFirst");
    const btnPrev = overlay.querySelector("#LayerTablePrev");
    const btnNext = overlay.querySelector("#LayerTableNext");
    const btnLast = overlay.querySelector("#LayerTableLast");

    btnFirst.addEventListener("click", () => {
        if (currentPage > 1) {
            currentPage = 1;
            updateTable();
        }
    });

    btnPrev.addEventListener("click", () => {
        if (currentPage > 1) {
            currentPage--;
            updateTable();
        }
    });

    btnNext.addEventListener("click", () => {
        const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1;
        if (currentPage < totalPages) {
            currentPage++;
            updateTable();
        }
    });

    btnLast.addEventListener("click", () => {
        const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1;
        if (currentPage < totalPages) {
            currentPage = totalPages;
            updateTable();
        }
    });

    const headerRow = overlay.querySelector("#LayerTableHeaderRow");
    const renderHeaders = () => {
        const mapHeaderHtml = `
            <th style="
                user-select: none;
                white-space: nowrap;
                padding: 1rem 1.2rem;
                background: var(--map-toolbar-bg);
                color: var(--text-heading);
                border-bottom: 0.2rem solid var(--border-light);
                position: sticky;
                top: 0;
                z-index: 3;
                text-align: center;
                font-weight: bold;
                font-size: 1.3rem;
                width: 6rem;
            ">Map</th>
        `;

        headerRow.innerHTML = mapHeaderHtml + keys.map(k => {
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

        headerRow.querySelectorAll("th[data-key]").forEach(th => {
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
                    const sA = formatValue(vA);
                    const sB = formatValue(vB);
                    return sortAsc ? sA.localeCompare(sB) : sB.localeCompare(sA);
                });
                
                currentPage = 1;
                renderHeaders();
                updateTable();
            });
        });
    };

    const updateTable = () => {
        const totalRows = filteredRecords.length;
        const totalPages = Math.ceil(totalRows / pageSize) || 1;

        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;
        
        const badge = overlay.querySelector("#LayerTableRecordBadge");
        if (badge) {
            badge.textContent = totalRows === records.length
                ? `${totalRows} records`
                : `${totalRows} / ${records.length} records`;
        }
        
        const startIdx = (currentPage - 1) * pageSize;
        const endIdx = Math.min(startIdx + pageSize, totalRows);
        const pageRecords = filteredRecords.slice(startIdx, endIdx);

        const rangeText = overlay.querySelector("#LayerTableRangeText");
        if (rangeText) {
            rangeText.textContent = totalRows > 0 ? `${startIdx + 1}–${endIdx} of ${totalRows}` : "0 of 0";
        }

        const pageInfo = overlay.querySelector("#LayerTablePageInfo");
        if (pageInfo) {
            pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
        }

        btnFirst.disabled = currentPage === 1;
        btnPrev.disabled = currentPage === 1;
        btnNext.disabled = currentPage === totalPages;
        btnLast.disabled = currentPage === totalPages;

        [btnFirst, btnPrev, btnNext, btnLast].forEach(btn => {
            btn.style.opacity = btn.disabled ? "0.35" : "1";
            btn.style.cursor = btn.disabled ? "not-allowed" : "pointer";
        });

        const tbody = overlay.querySelector("#LayerTableBodyRow");
        if (filteredRecords.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="${keys.length + 1}"
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

        tbody.innerHTML = pageRecords.map((row, relativeIdx) => {
            const realIdx = startIdx + relativeIdx;
            const rowBg = relativeIdx % 2 === 1 ? "rgba(255, 255, 255, 0.02)" : "transparent";
            const mapCell = `
                <td style="
                    padding: 0.5rem 0.8rem;
                    text-align: center;
                    border-bottom: 0.1rem solid var(--border-light);
                    white-space: nowrap;
                ">
                    <button type="button"
                            class="table-map-locate-btn"
                            data-idx="${realIdx}"
                            title="Show location on map"
                            style="
                                padding: 0.3rem 0.8rem;
                                font-size: 1.2rem;
                                border-radius: 0.4rem;
                                border: none;
                                background: var(--btn-action, #3b82f6);
                                color: #ffffff;
                                cursor: pointer;
                                display: inline-flex;
                                align-items: center;
                                justify-content: center;
                                gap: 0.3rem;
                                font-weight: bold;
                                transition: opacity 0.15s, transform 0.15s;
                            ">Map</button>
                </td>
            `;
            const cells = keys.map(k => {
                const val = row[k];
                const display = ESML(formatValue(val));
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
                    onmouseleave="this.style.background='${rowBg}'">${mapCell}${cells}</tr>
            `;
        }).join("");
        
        tbody.querySelectorAll(".table-map-locate-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const realIdx = Number(btn.dataset.idx);
                const row = filteredRecords[realIdx];
                if (!row) return;

                const lon = Number(row.lon);
                const lat = Number(row.lat);

                if (isNaN(lon) || isNaN(lat)) {
                    alert("Location coordinates not available for this record.");
                    return;
                }

                closeModal();

                const cleanId = datasetId.replace(/^layer-/, "");
                const sourceKey = (DATASET_SOURCE_MAP && DATASET_SOURCE_MAP[cleanId]) ? DATASET_SOURCE_MAP[cleanId] : cleanId;
                const targetProps = row._rawFeature?.properties || row;

                highlightLocation([lon, lat], targetProps, sourceKey, 10);
            });
        });
    };

    renderHeaders();
    updateTable();
}

