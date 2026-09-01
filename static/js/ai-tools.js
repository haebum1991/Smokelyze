
import { map } from "./layers-state.js";
import { highlightLocation } from "./utils.js";
import { loadedGeoJSON, activeSources, loadedSources } from "./loader.js";
import {
    setStatsDrawer, setDescDrawer, setNewsDrawer, setMapPostDrawer,
    setLegendDrawer, setHysplitDrawer, setAccordionCollapsed
} from "./ui-toggles.js";
import { getMapCaptureDataUrl } from "./map-capture.js";

export async function handleAiToolCall(functionName, args) {
    let resultMessage = "";

    try {
        switch (functionName) {
            case "query_bigquery":
                // This tool is executed on the Cloud Run backend. 
                // We simply return a success indicator to let the frontend loop continue.
                return "[System] Data fetched successfully from BigQuery backend.";

            case "change_date":
                const targetDate = args?.date;
                const datePicker = document.getElementById("datePicker");
                if (datePicker && targetDate) {
                    datePicker.value = targetDate;
                    datePicker.dispatchEvent(new Event("change", { bubbles: true }));
                    resultMessage = `[System] Changed date to ${targetDate}.`;
                } else {
                    resultMessage = "[System Error] Could not find the date picker element on the screen.";
                }
                break;

            case "change_hour":
                const targetHour = args?.hour; // Expecting UTC hour ("00" to "23")
                const timePicker = document.getElementById("timePicker");
                if (timePicker && targetHour !== undefined && targetHour !== null && targetHour !== "") {
                    const rawUtcHour = parseInt(targetHour, 10);
                    if (!isNaN(rawUtcHour)) {
                        // Calculate Local Hour matching the target UTC hour for the currently selected date
                        const dateStr = document.getElementById("datePicker")?.value || new Date().toISOString().split("T")[0];
                        const [y, m, d] = dateStr.split("-").map(Number);
                        const utcDate = new Date(Date.UTC(y, m - 1, d, rawUtcHour, 0, 0));
                        const localHour = utcDate.getHours();
                        const hourVal = String(localHour).padStart(2, "0");

                        timePicker.value = hourVal;
                        timePicker.dispatchEvent(new Event("change", { bubbles: true }));
                        resultMessage = `[System] Changed UI hour to local ${hourVal}:00 (matches ${String(rawUtcHour).padStart(2, "0")}:00 UTC).`;
                    }
                } else {
                    resultMessage = "[System Error] Could not find the time picker element on the screen.";
                }
                break;

            case "extract_summary_aqs":
                let rawSourceId = args?.sourceId || "gam_v2";

                // 1. First priority: Search in loadedGeoJSON (in-memory GeoJSON objects)
                let features = null;
                let resolvedSourceId = rawSourceId;

                const findInGeoJSON = (keys) => {
                    for (const key of keys) {
                        const data = loadedGeoJSON[key] || (loadedSources && loadedSources[key] ? loadedGeoJSON[loadedSources[key]] : null);
                        if (data && data.features && data.features.length > 0) {
                            return { features: data.features, id: key };
                        }
                    }
                    return null;
                };

                // Candidate source IDs to try
                const candidates = [
                    rawSourceId,
                    rawSourceId.replace(/-/g, "_"),
                    rawSourceId.replace(/_/g, "-"),
                    rawSourceId + "_pred",
                    rawSourceId.replace("_pred", ""),
                    ...(activeSources || []),
                    ...Object.keys(loadedGeoJSON || {})
                ];

                const geoMatch = findInGeoJSON(candidates);
                if (geoMatch) {
                    features = geoMatch.features;
                    resolvedSourceId = geoMatch.id;
                }

                // 2. Fallback: MapLibre Source check (e.g. HYSPLIT or direct source)
                if (!features && map) {
                    let source = map.getSource(rawSourceId) ||
                        map.getSource(rawSourceId.replace(/-/g, "_")) ||
                        map.getSource(rawSourceId.replace(/_/g, "-"));

                    if (source && source._data && source._data.features && source._data.features.length > 0) {
                        features = source._data.features;
                        resolvedSourceId = source.id;
                    } else if (map.getStyle()?.sources) {
                        const hysplitKeys = Object.keys(map.getStyle().sources).filter(id => id.startsWith("hysplit-src-traj-"));
                        if (hysplitKeys.length > 0) {
                            const hSrc = map.getSource(hysplitKeys[hysplitKeys.length - 1]);
                            if (hSrc && hSrc._data && hSrc._data.features) {
                                features = hSrc._data.features;
                                resolvedSourceId = "hysplit";
                            }
                        }
                    }
                }

                if (!features || features.length === 0) {
                    resultMessage = `[System Event] The requested source (${rawSourceId}) is not loaded on the map. Current Active Sources: [${(activeSources || []).join(", ")}]. Please ensure the layer is turned on.`;
                    break;
                }

                const sourceId = resolvedSourceId;
                const field = args.target_field || "SMO";
                const isDesc = args.sort_desc !== false; // default true
                const limit = args.limit || 10;

                const validFeatures = features.filter(f => {
                    let actualField = field;
                    if (!(field in f.properties)) {
                        const keys = Object.keys(f.properties);
                        const match = keys.find(k => k.toLowerCase() === field.toLowerCase());
                        if (match) actualField = match;
                        else if (field.toLowerCase() === "altitude") actualField = "height"; // Map altitude to height for HYSPLIT
                    }

                    const val = f.properties[actualField];
                    return typeof val === "number" && !isNaN(val) && val !== null;
                });

                let finalField = field;
                if (validFeatures.length > 0) {
                    const firstFeat = validFeatures[0].properties;
                    if (!(field in firstFeat)) {
                        const match = Object.keys(firstFeat).find(k => k.toLowerCase() === field.toLowerCase());
                        if (match) {
                            finalField = match;
                        } else if (field.toLowerCase() === "altitude" && "height" in firstFeat) {
                            finalField = "height";
                        }
                    }
                }

                if (validFeatures.length === 0) {
                    resultMessage = `[System Event] No valid data found for field "${field}" in source "${sourceId}". (Available fields: ${features.length > 0 ? Object.keys(features[0].properties).slice(0, 10).join(", ") : "None"})`;
                    break;
                }

                validFeatures.sort((a, b) => {
                    const diff = a.properties[finalField] - b.properties[finalField];
                    return isDesc ? -diff : diff;
                });

                // Calculate generic aggregates (count > 0, sum, min, max)
                const positiveCount = validFeatures.filter(f => f.properties[finalField] > 0 || f.properties[finalField] === true).length;
                const topFeatures = validFeatures.slice(0, Math.min(limit, 20)); // Max 20 to protect tokens

                let resultText = `[Data Extraction Success: ${sourceId} / Field: "${finalField}"] Total: ${validFeatures.length} sites, Positive Count (>0): ${positiveCount}, Max: ${validFeatures[0]?.properties[finalField]}, Min: ${validFeatures[validFeatures.length - 1]?.properties[finalField]} | Showing Top ${topFeatures.length}:
`;

                topFeatures.forEach((f, idx) => {
                    const lat = f.geometry?.coordinates?.[1] || "unknown";
                    const lon = f.geometry?.coordinates?.[0] || "unknown";
                    const locationLabel = f.properties["Site_ID"] || f.properties["name"] || `(${lat.toFixed(2)}, ${lon.toFixed(2)})`;

                    // [Smart & Robust Filtering] Keep identifiers (case-insensitive) and all scientific values
                    const cleanProps = {};
                    const commonIdKeys = ["state", "site_name", "AQS", "AQS_O3", "AQS_PM"];
                    const actualKeys = Object.keys(f.properties);

                    // 1. Identify and keep all ID/Name/State fields regardless of case
                    commonIdKeys.forEach(targetKey => {
                        const match = actualKeys.find(k => k.toLowerCase() === targetKey);
                        if (match) {
                            cleanProps[match] = f.properties[match];
                        }
                    });

                    // 2. Keep all numeric scientific values to prevent Metadata Panel from showing NA
                    for (const [key, val] of Object.entries(f.properties)) {
                        if (typeof val === "number") {
                            cleanProps[key] = Number(val.toFixed(4));
                        } else if (!cleanProps[key] && val !== null) {
                            // Keep other non-numeric info if not already captured
                            cleanProps[key] = (typeof val === "string" && val.length > 50) ? val.substring(0, 50) + "..." : val;
                        }
                    }

                    resultText += `${idx + 1}. Site: ${locationLabel} | Coords: [${lat}, ${lon}] | Data: ${JSON.stringify(cleanProps)}
`;
                });

                resultMessage = `Extracted ${sourceId} data follows. Analyze this data like a professional and provide insights to the user. You can also use "move_to_location" to fly to these sites:` + resultText;
                break;

            case "move_to_location":
                const targetLat = args?.lat;
                const targetLon = args?.lon;
                let rawSrcId = args?.sourceId || "";
                let props = args?.properties || {};

                // Helper to normalize data source names for layers-tooltip.js
                const normalizeSrcId = (s) => {
                    if (!s) return "";
                    const lower = String(s).toLowerCase().replace(/-/g, "_");
                    if (lower.includes("fire") || lower.includes("hms_fire")) return "fire";
                    if (lower.includes("smoke") || lower.includes("hms_smoke")) return "smoke";
                    if (lower.includes("burn")) return "burn";
                    if (lower.includes("hourly") || lower.includes("airnow_hourly")) return "airnow_hourly";
                    if (lower.includes("airnow") || lower.includes("airnow_daily") || lower.includes("airnow_date")) return "airnow_daily";
                    if (lower.includes("gam_v2_pred")) return "gam_v2_pred";
                    if (lower.includes("gam_v2")) return "gam_v2";
                    if (lower.includes("gam_v1")) return "gam_v1";
                    if (lower.includes("pm_cbsa_pred")) return "pm_cbsa_pred";
                    if (lower.includes("pm_cbsa")) return "pm_cbsa";
                    if (lower.includes("ember")) return "epa_ember";
                    if (lower.includes("hysplit")) return "hysplit";
                    if (lower.includes("news")) return "wildfire_news";
                    if (lower.includes("peri")) return "wildfire_peri";
                    if (lower.includes("inci")) return "wildfire_inci";
                    return lower;
                };

                let actualSrcId = normalizeSrcId(rawSrcId);

                // [Heuristic] If properties look like HYSPLIT, News, Incident, or Fire, prioritize them
                if (props.height !== undefined || props.pressure !== undefined || props.date2 !== undefined) {
                    actualSrcId = "hysplit";
                } else if (props.link || props.published) {
                    actualSrcId = "wildfire_news";
                } else if (props.IncidentName || props.UniqueFireIdentifier || props.poly_IncidentName) {
                    actualSrcId = props.poly_IncidentName ? "wildfire_peri" : "wildfire_inci";
                } else if (props.fireCount || props.FRP) {
                    actualSrcId = "fire";
                }

                if (targetLat && targetLon) {
                    let foundMetadata = null;

                    // Search loadedGeoJSON for full properties — prioritize ACTIVE sources
                    if (loadedGeoJSON) {
                        const EPSILON = 0.0001; // ~11m
                        const targetUtcDate = props.date || document.getElementById("datePicker")?.value;

                        const findMatch = (sourceList) => {
                            for (const srcId of sourceList) {
                                const data = loadedGeoJSON[srcId] || (loadedSources && loadedSources[srcId] ? loadedGeoJSON[loadedSources[srcId]] : null);
                                if (!data || !data.features) continue;

                                // 1. ID/Name match (Best & most accurate)
                                const idKeys = [
                                    "AQS",
                                    "AQS_O3",
                                    "AQS_PM",
                                    "site_name",
                                    "poly_IncidentName",
                                    "IncidentName",
                                    "attr_UniqueFireIdentifier",
                                    "UniqueFireIdentifier",
                                    "poly_IRWINID",
                                    "IrwinID"
                                ];
                                for (const key of idKeys) {
                                    if (props[key]) {
                                        const match = data.features.find(f => {
                                            if (f.properties[key] !== props[key]) return false;
                                            if (targetUtcDate && f.properties.date && String(f.properties.date) !== String(targetUtcDate)) return false;
                                            return true;
                                        });
                                        if (match) return { props: match.properties, srcId: srcId };
                                    }
                                }

                                // 2. Coordinate fallback
                                const match = data.features.find(f => {
                                    const c = f.geometry?.coordinates;
                                    return c && Math.abs(c[0] - targetLon) < EPSILON && Math.abs(c[1] - targetLat) < EPSILON;
                                });

                                if (match) {
                                    const matchDate = match.properties?.date;
                                    if (targetUtcDate && matchDate && String(matchDate) !== String(targetUtcDate)) continue;
                                    return { props: match.properties, srcId: srcId };
                                }
                            }
                            return null;
                        };

                        const matchResult = findMatch(activeSources || []) || findMatch(Object.keys(loadedGeoJSON));
                        if (matchResult) {
                            foundMetadata = matchResult.props;
                            console.log("[AI-API Sync] Found Map Highlight Metadata:", foundMetadata);

                            if (!actualSrcId || actualSrcId === "") {
                                actualSrcId = normalizeSrcId(matchResult.srcId);
                            }
                        }
                    }

                    // Fallback to currently selected UI dataset if source ID is still undetermined
                    if (!actualSrcId || actualSrcId === "") {
                        const activeUiDataset = document.getElementById("MapDataSelect")?.value;
                        actualSrcId = normalizeSrcId(activeUiDataset) || "gam_v2";
                    }

                    // Merge: Map-found data (base) + AI-provided data (overrides)
                    const finalProps = { ...foundMetadata, ...props };

                    // Hourly AirNow Normalization: Map DB columns (MDA8O3_Txx, PM25_Txx, NO2_Txx) to tooltip keys
                    if (actualSrcId === "airnow_hourly" || actualSrcId.includes("hourly")) {
                        // 1. Determine target hour string (from AI props or current UI timePicker)
                        let hourStr = null;
                        const matchedPropKey = Object.keys(props).find(k => k.includes("_T"));
                        if (matchedPropKey) {
                            const m = matchedPropKey.match(/_T(\d+)/);
                            if (m) hourStr = m[1];
                        }

                        if (!hourStr) {
                            const timePicker = document.getElementById("timePicker");
                            const localHour = timePicker ? parseInt(timePicker.value, 10) : new Date().getHours();
                            const dateStr = document.getElementById("datePicker")?.value || new Date().toISOString().split("T")[0];
                            const [y, m, d] = dateStr.split("-").map(Number);
                            const localDate = new Date(y, m - 1, d, localHour);
                            hourStr = String(localDate.getUTCHours()).padStart(2, "0");
                        }

                        // 2. Uniform mapping for all 3 pollutants (Prioritize direct BigQuery props)
                        const mappings = [
                            { dbKey: `MDA8O3_T${hourStr}`, tooltipKey: "ozone(ppb)" },
                            { dbKey: `PM25_T${hourStr}`,   tooltipKey: "pm25(ug/m3)" },
                            { dbKey: `NO2_T${hourStr}`,    tooltipKey: "no2(ppb)" }
                        ];

                        mappings.forEach(({ dbKey, tooltipKey }) => {
                            const val = (props[dbKey] !== undefined && props[dbKey] !== null) ? props[dbKey] : finalProps[dbKey];
                            if (val !== undefined && val !== null) {
                                finalProps[tooltipKey] = val;
                            }
                        });

                        // 3. Format timestamp string (UTC)
                        const utcDateStr = props.date || finalProps.date || document.getElementById("datePicker")?.value || "";
                        finalProps["current_hour_str"] = `${utcDateStr} ${hourStr}:00 UTC`;

                        // 4. Auto-sync UI DatePicker and TimePicker (Convert UTC DateTime -> Local DateTime)
                        let localDateStr = utcDateStr;
                        let localHourStr = null;

                        if (utcDateStr && hourStr) {
                            const rawUtcHour = parseInt(hourStr, 10);
                            if (!isNaN(rawUtcHour)) {
                                const [y, m, d] = utcDateStr.split("-").map(Number);
                                const utcObj = new Date(Date.UTC(y, m - 1, d, rawUtcHour, 0, 0));
                                localDateStr = `${utcObj.getFullYear()}-${String(utcObj.getMonth() + 1).padStart(2, "0")}-${String(utcObj.getDate()).padStart(2, "0")}`;
                                localHourStr = String(utcObj.getHours()).padStart(2, "0");
                            }
                        }

                        const datePicker = document.getElementById("datePicker");
                        if (datePicker && localDateStr && datePicker.value !== localDateStr) {
                            datePicker.value = localDateStr;
                            datePicker.dispatchEvent(new Event("change", { bubbles: true }));
                        }

                        const timePicker = document.getElementById("timePicker");
                        if (timePicker && localHourStr && timePicker.value !== localHourStr) {
                            timePicker.value = localHourStr;
                            timePicker.dispatchEvent(new Event("change", { bubbles: true }));
                        }
                    } else if (props.date) {
                        const datePicker = document.getElementById("datePicker");
                        if (datePicker && datePicker.value !== props.date) {
                            datePicker.value = props.date;
                            datePicker.dispatchEvent(new Event("change", { bubbles: true }));
                        }
                    }

                    console.log("[AI-API Sync] Final Properties for Tooltip:", { finalProps, actualSrcId });

                    highlightLocation([targetLon, targetLat], finalProps, actualSrcId);
                    resultMessage = `[System] Moved map to [lat: ${targetLat}, lon: ${targetLon}] and highlighted (${actualSrcId}) using ${foundMetadata ? "full GeoJSON metadata" : "AI-provided metadata"}.`;
                } else {
                    resultMessage = `[System Error] Missing lat or lon coordinates.`;
                }
                break;

            case "change_dataset":
                let targetDataset = args?.dataset_value;
                const dataSelect = document.getElementById("MapDataSelect");

                // [Date-Based Auto-Correction] AI가 2025+ 날짜에 구버전 모델을 선택하면 자동으로 pred 버전으로 교체,
                // 또는 2019-2024 날짜에 pred 버전을 선택하면 구버전(Published)으로 교체
                if (targetDataset && dataSelect) {
                    const dateInput = document.getElementById("datePicker");
                    const currentYear = dateInput ? parseInt(dateInput.value?.substring(0, 4)) : null;
                    if (currentYear) {
                        if (currentYear >= 2025) {
                            const predMap = { "gam-v2": "gam-v2-pred", "pm-cbsa": "pm-cbsa-pred" };
                            if (predMap[targetDataset]) {
                                console.log(`[AI Logic] Auto-corrected dataset from "${targetDataset}" to "${predMap[targetDataset]}" for ${currentYear}`);
                                targetDataset = predMap[targetDataset];
                            }
                        } else if (currentYear >= 2019 && currentYear <= 2024) {
                            const pubMap = { "gam-v2-pred": "gam-v2", "pm-cbsa-pred": "pm-cbsa" };
                            if (pubMap[targetDataset]) {
                                console.log(`[AI Logic] Auto-corrected dataset from "${targetDataset}" to "${pubMap[targetDataset]}" for ${currentYear}`);
                                targetDataset = pubMap[targetDataset];
                            }
                        }
                    }
                }

                if (dataSelect && targetDataset) {
                    const optionExists = Array.from(dataSelect.options).some(opt => opt.value === targetDataset);
                    if (optionExists) {
                        dataSelect.value = targetDataset;
                        dataSelect.dispatchEvent(new Event("change", { bubbles: true }));
                        resultMessage = `[System] Changed dataset to "${targetDataset}".`;
                    } else {
                        resultMessage = `[System Error] Unsupported dataset value: ${targetDataset}`;
                    }
                } else {
                    resultMessage = "[System Error] Could not find the dataset selector on the screen.";
                }
                break;

            case "change_layer":
                const rawLayerId = args?.layer_id;
                const turnOn = args?.turn_on;

                // Agnostic Lookup for checkbox ID
                const checkbox = document.getElementById(rawLayerId) ||
                    document.getElementById(rawLayerId.replace(/-/g, "_")) ||
                    document.getElementById(rawLayerId.replace(/_/g, "-"));

                if (checkbox) {
                    if (turnOn) {
                        // Mutually exclusive sibling sublayers for AirNow Hourly and Daily
                        const hourlySiblings = ["layer-airnow-hourly-pm25", "layer-airnow-hourly-ozone", "layer-airnow-hourly-no2"];
                        const dailySiblings = ["layer-airnow-daily-mda8", "layer-airnow-daily-pm25"];

                        let siblings = [];
                        if (hourlySiblings.includes(checkbox.id)) siblings = hourlySiblings;
                        else if (dailySiblings.includes(checkbox.id)) siblings = dailySiblings;

                        siblings.forEach(sId => {
                            if (sId !== checkbox.id) {
                                const sCb = document.getElementById(sId);
                                if (sCb && sCb.checked) {
                                    sCb.checked = false;
                                    sCb.dispatchEvent(new Event("change", { bubbles: true }));
                                }
                            }
                        });
                    }

                    if (checkbox.checked !== turnOn) {
                        checkbox.checked = turnOn;
                        checkbox.dispatchEvent(new Event("change", { bubbles: true }));
                        resultMessage = `[System] Layer "${checkbox.id}" turned ${turnOn ? "ON" : "OFF"}. Inform the user.`;
                    } else {
                        resultMessage = `[System] Layer "${checkbox.id}" is already ${turnOn ? "ON" : "OFF"}.`;
                    }
                } else {
                    resultMessage = `[System Error] Could not find layer checkbox with ID "${rawLayerId}". Verify the ID naming (hyphens/underscores).`;
                }
                break;

            case "clear_all_layers":
                document.querySelectorAll(".accordion-page input[type='checkbox']").forEach(cb => {

                    // Do not turn off Map Settings toggles
                    if (cb.id === "MapBtnStateShading" || cb.id === "MapBtnPointLayers" || cb.id === "MapBtnNaShading") return;
                    if (cb.checked && cb.parentElement.style.display !== "none") {
                        cb.checked = false;
                        cb.dispatchEvent(new Event("change", { bubbles: true }));
                    }
                });
                resultMessage = "[System] Successfully cleared all active layers. The map is now fresh.";
                break;

            case "reset_map":
                const resetBtn = document.getElementById("MapBtnReset");
                if (resetBtn) {
                    resetBtn.click();
                    resultMessage = "[System] Map has been reset to its initial state.";
                } else {
                    resultMessage = "[System Error] Could not find the Reset button on the screen.";
                }
                break;

            case "set_drawer_visibility": {
                const drawerId = args?.drawer_id;
                const visible = args?.visible !== false;

                if (drawerId === "layers") {
                    setAccordionCollapsed(!visible);
                    resultMessage = `[System] Layer Control Panel (Accordion) is now ${visible ? "OPEN" : "CLOSED"}.`;
                    break;
                }

                const drawerFns = {
                    "stats": setStatsDrawer,
                    "news": setNewsDrawer,
                    "desc": setDescDrawer,
                    "mappost": setMapPostDrawer,
                    "hysplit": setHysplitDrawer,
                    "legend": setLegendDrawer
                };

                const fn = drawerFns[drawerId];
                if (typeof fn === "function") {
                    fn(visible);
                    resultMessage = `[System] Drawer "${drawerId}" is now ${visible ? "OPEN" : "CLOSED"}. Inform the user.`;
                } else {
                    resultMessage = `[System Error] Could not find controller for drawer "${drawerId}".`;
                }
                break;
            }

            case "set_hysplit_visibility":
                const runId = args?.run_id || "all";
                const visible = args?.visible !== false; // default true
                if (typeof window.setHysplitVisibility === "function") {
                    window.setHysplitVisibility(runId, visible);
                    resultMessage = `[System] Successfully set HYSPLIT visibility (${runId}) to ${visible ? "ON" : "OFF"}.`;
                } else {
                    resultMessage = "[System Error] HYSPLIT visibility controller is not loaded.";
                }
                break;

            case "extract_summary_state":
                const targetField = args?.target_field || "SMO";
                const stats = typeof getRegionStats === "function" ? getRegionStats() : (window.regionStats || {});

                if (Object.keys(stats).length === 0) {
                    resultMessage = "[System Error] No summary data currently available. Please ensure a dataset is loaded first.";
                    break;
                }

                const sortedRegions = Object.entries(stats)
                    .map(([id, data]) => ({ id, ...data }))
                    .filter(r => typeof r[targetField] === "number")
                    .sort((a, b) => b[targetField] - a[targetField]);

                if (sortedRegions.length === 0) {
                    resultMessage = `[System Error] No valid data found for field "${targetField}" in the summary table.`;
                    break;
                }

                let summaryText = `[Summary Table Data: Top 10 States for ${targetField}]
`;
                sortedRegions.slice(0, 15).forEach((r, i) => {
                    summaryText += `${i + 1}. ${r.id}: ${r[targetField].toFixed(2)}
`;
                });

                resultMessage = summaryText + " [System Info] This data represents state-level aggregates. Use this for broad geographic analysis.";
                break;

            case "get_enhanced_region_context": {
                // [Global Multi-Source Data Extraction - MiroFish Framework]
                // 지도에 로드된 모든 과학적 데이터 소스(GAM, HYSPLIT, AirNow, Smoke 등)를 종합 수집하여 AI 전문가 그룹에 넘깁니다.
                const sourceIds = ["gam_v2", "gam_v1", "pm_cbsa", "airnow_daily", "airnow_hourly_ozone", "airnow_hourly_pm25", "hysplit", "smoke", "fire"];
                let summaryParts = [];

                sourceIds.forEach(id => {
                    const s = map.getSource(id);
                    if (s && s._data && s._data.features && s._data.features.length > 0) {
                        const features = s._data.features;

                        // HYSPLIT Trajectory context: Provides height/time/receptor information
                        if (id === "hysplit") {
                            summaryParts.push(`HYSPLIT: ${features.length} trajectory points active.`);
                        }
                        // HMS Smoke/Fire context: Provides spatial plume visualization
                        else if (id === "smoke" || id === "fire") {
                            summaryParts.push(`${id.toUpperCase()}: Active spatial layers detected.`);
                        }
                        // Numeric point data (GAM, PM2.5, AirNow) for field analysis
                        else {
                            const vals = features.map(f => {
                                const p = f.properties;
                                // Multiple field mapping to handle different source schemas (GAM PM, AirNow, MDA8O3)
                                return p.GAM_PM || p.PM2_5 || p.O3 || p.MDA8O3 || p.PM25 || p.SMO || 0;
                            }).filter(v => typeof v === "number" && v > 0);

                            if (vals.length > 0) {
                                const avg = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
                                const max = Math.max(...vals).toFixed(1);
                                summaryParts.push(`${id}(avg:${avg}, max:${max}, n:${vals.length})`);
                            }
                        }
                    }
                });

                let dataSummary = summaryParts.length > 0 ? summaryParts.join(" | ") : "No active scientific data sources in current viewport.";

                // AI에게는 수치적 맥락만 전달하며, 해석은 백엔드에 감춰진 비밀 전략 그룹이 수행합니다.
                resultMessage = `[Unified Region Context Data: ${dataSummary}] 
Please apply the specialized Strategic Inter-Sectoral Committee protocols to interpret this multi-source data for the user. Cross-validate between models (GAM) and real-time sensors (AirNow/HYSPLIT) if both are provided.`;
                break;
            }

            case "capture_map_screen": {
                try {
                    const imgUrl = await getMapCaptureDataUrl();
                    if (imgUrl) {
                        const base64 = imgUrl.split(",")[1];
                        resultMessage = {
                            result: "Map viewport captured successfully.",
                            inlineData: {
                                mimeType: "image/png",
                                data: base64
                            }
                        };
                    } else {
                        resultMessage = { error: "Map canvas capture returned empty data." };
                    }
                } catch (err) {
                    resultMessage = { error: `Failed to capture map: ${err.message}` };
                }
                break;
            }

            default:
                resultMessage = `[System Error] The requested function (${functionName}) is not yet supported.`;
        }
    } catch (e) {
        resultMessage = `[System Error] Error during function execution: ` + e.message;
    }

    return resultMessage;
}

