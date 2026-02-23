
import { map } from "./layers-state.js";
import { highlightLocation } from "./utils.js";
import { loadedGeoJSON, activeSources, loadedSources } from "./loader-state.js";

export const smokelyzeAiTools = [
    {
        function_declarations: [
            {
                name: "query_bigquery",
                description: "Executes a Read-only SQL query on the Smokelyze BigQuery database. Used by the backend only.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        sql: { type: "STRING", description: "The SQL query." }
                    },
                    required: ["sql"]
                }
            },
            {
                name: "change_date",
                description: "Changes the date of the map display.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        date: { type: "STRING", description: "YYYY-MM-DD" }
                    },
                    required: ["date"]
                }
            },
            {
                name: "extract_summary_aqs",
                description: "Extracts map data for correlation.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        sourceId: { type: "STRING" },
                        target_field: { type: "STRING" },
                        sort_desc: { type: "BOOLEAN" },
                        limit: { type: "INTEGER" }
                    },
                    required: ["sourceId", "target_field"]
                }
            },
            {
                name: "move_to_location",
                description: "Pans the map to a site.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        lat: { type: "NUMBER" },
                        lon: { type: "NUMBER" },
                        sourceId: { type: "STRING" },
                        properties: { type: "OBJECT" }
                    },
                    required: ["lat", "lon"]
                }
            },
            {
                name: "change_dataset",
                description: "Changes the active model (gam-v2, pm-cbsa).",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        dataset_value: { type: "STRING" }
                    },
                    required: ["dataset_value"]
                }
            },
            {
                name: "change_layer",
                description: "Toggles a map layer.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        layer_id: { type: "STRING" },
                        turn_on: { type: "BOOLEAN" }
                    },
                    required: ["layer_id", "turn_on"]
                }
            },
            {
                name: "open_description",
                description: "Opens info panel."
            },
            {
                name: "extract_summary_state",
                description: "Extracts state-level summary table.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        target_field: { type: "STRING" }
                    }
                }
            }
        ]
    }
];

/**
 * 지도의 데이터 로딩이나 렌더링이 완료될 때까지 대기하는 헬퍼 함수
 */
function waitForMapIdle(timeout = 3500) {
    return new Promise((resolve) => {
        if (!map) return resolve();
        // 이미 로드된 상태라도 데이터 fetch는 진행 중일 수 있으므로 idle 이벤트 활용
        const onIdle = () => {
            map.off("idle", onIdle);
            resolve();
        };
        map.on("idle", onIdle);
        // 혹시 모르니 타임아웃 설정
        setTimeout(() => {
            map.off("idle", onIdle);
            resolve();
        }, timeout);
    });
}

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

                    // 데이터가 로딩될 때까지 기다림
                    await waitForMapIdle();

                    resultMessage = `[System] Changed date to ${targetDate} and waited for data loading. You can now analyze new data using "extract_summary_aqs".`;
                } else {
                    resultMessage = "[System Error] Could not find the date picker element on the screen.";
                }
                break;

            case "extract_summary_aqs":
                let rawSourceId = args?.sourceId || "gam_v2";

                if (!map) {
                    return "[System Error] Map 인스턴스를 불러올 수 없습니다.";
                }

                // Agnostic Lookup: Try exact, underscore, and hyphen variations
                let source = map.getSource(rawSourceId) ||
                    map.getSource(rawSourceId.replace(/-/g, "_")) ||
                    map.getSource(rawSourceId.replace(/_/g, "-"));

                // Fallback check: if still not found, check dataset list
                if (!source) {
                    const possibleSources = ["gam_v2", "gam_v1", "pm_cbsa", "epa_ember"];
                    source = possibleSources.map(s => map.getSource(s)).find(s => s);
                }

                if (!source || !source._data || !source._data.features || source._data.features.length === 0) {
                    resultMessage = `[System Event] The requested source (${rawSourceId}) is not loaded on the map. Current Active Dataset might be different. Please ensure the user has selected the layer and wait for data to load.`;
                    break;
                }

                const sourceId = source.id; // Corrected ID found in map
                const features = source._data.features;
                const field = args.target_field;
                const isDesc = args.sort_desc !== false; // default true
                const limit = args.limit || 10;

                const validFeatures = features.filter(f => {
                    let actualField = field;
                    if (!(field in f.properties)) {
                        const keys = Object.keys(f.properties);
                        const match = keys.find(k => k.toLowerCase() === field.toLowerCase());
                        if (match) actualField = match;
                    }

                    const val = f.properties[actualField];
                    return typeof val === "number" && !isNaN(val) && val !== null;
                });

                let finalField = field;
                if (validFeatures.length > 0) {
                    const firstFeat = validFeatures[0].properties;
                    if (!(field in firstFeat)) {
                        const match = Object.keys(firstFeat).find(k => k.toLowerCase() === field.toLowerCase());
                        if (match) finalField = match;
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

                const topFeatures = validFeatures.slice(0, Math.min(limit, 20)); // Max 20 to protect tokens
                let resultText = `[Data Extraction Success: ${sourceId} / Showing Top ${topFeatures.length} out of ${validFeatures.length} found]`;
                
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
                const rawSrcId = args?.sourceId || "gam_v2";
                let props = args?.properties || {};

                if (targetLat && targetLon) {
                    // [Sync] Wait for map to be idle
                    await waitForMapIdle(1500);

                    // Agnostic source ID lookup
                    const actualSrcId = (map && map.getSource(rawSrcId)) ? rawSrcId :
                        (map.getSource(rawSrcId.replace(/-/g, "_")) ? rawSrcId.replace(/-/g, "_") :
                            (map.getSource(rawSrcId.replace(/_/g, "-")) ? rawSrcId.replace(/_/g, "-") : rawSrcId));

                    let foundMetadata = null;

                    // [BRAIN] Robust Search in loadedGeoJSON for full properties
                    // This ensures we have the actual data from geojson.gz even if AI passed partial info
                    if (loadedGeoJSON) {
                        const EPSILON = 0.0001; // ~11m
                        // Try active sources first, then others
                        const searchSources = [...(activeSources || []), ...Object.keys(loadedGeoJSON)];

                        for (const src of searchSources) {
                            const data = loadedGeoJSON[src] || loadedGeoJSON[loadedSources[src]];
                            if (!data || !data.features) continue;

                            const match = data.features.find(f => {
                                const c = f.geometry?.coordinates;
                                return c && Math.abs(c[0] - targetLon) < EPSILON && Math.abs(c[1] - targetLat) < EPSILON;
                            });

                            if (match) {
                                foundMetadata = match.properties;
                                break;
                            }
                        }
                    }

                    // Merge: Map-found data (base) + AI-provided data (overrides)
                    const finalProps = { ...foundMetadata, ...props };

                    highlightLocation([targetLon, targetLat], finalProps, actualSrcId);
                    resultMessage = `[System] Moved map to [lat: ${targetLat}, lon: ${targetLon}] and highlighted using ${foundMetadata ? "full GeoJSON metadata" : "AI-provided metadata"}.`;
                } else {
                    resultMessage = `[System Error] Missing lat or lon coordinates.`;
                }
                break;

            case "change_dataset":
                const targetDataset = args?.dataset_value;
                const dataSelect = document.getElementById("MapDataSelect");
                if (dataSelect && targetDataset) {
                    const optionExists = Array.from(dataSelect.options).some(opt => opt.value === targetDataset);
                    if (optionExists) {
                        dataSelect.value = targetDataset;
                        dataSelect.dispatchEvent(new Event("change", { bubbles: true }));

                        // Published 체크박스들(예: Obs MDA8 등)을 자동으로 체크해줌으로써 바로 화면에 보이게 유도
                        const mda8Cb = document.getElementById("layer-mda8-obs");
                        if (mda8Cb && !mda8Cb.checked) {
                            mda8Cb.checked = true;
                            mda8Cb.dispatchEvent(new Event("change", { bubbles: true }));
                        }

                        // 데이터가 로딩될 때까지 기다림
                        await waitForMapIdle();

                        resultMessage = `[System] Changed dataset to "${targetDataset}" and waited for loading. New data is now available for analysis.`;
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
                    if (checkbox.checked !== turnOn) {
                        checkbox.checked = turnOn;
                        checkbox.dispatchEvent(new Event("change", { bubbles: true }));
                        resultMessage = `[System] Layer "${checkbox.id}" turned ${turnOn ? "ON" : "OFF"}. Data is loading. Inform the user.`;
                    } else {
                        resultMessage = `[System] Layer "${checkbox.id}" is already ${turnOn ? "ON" : "OFF"}.`;
                    }
                } else {
                    resultMessage = `[System Error] Could not find layer checkbox with ID "${rawLayerId}". Verify the ID naming (hyphens/underscores).`;
                }
                break;
                
            case "reset_map":
                const resetBtn = document.getElementById("MapBtnReset");
                if (resetBtn) {
                    resetBtn.click();
                    await waitForMapIdle();
                    resultMessage = "[System] Map has been reset to its initial state.";
                } else {
                    resultMessage = "[System Error] Could not find the Reset button on the screen.";
                }
                break;
                
            case "open_description":
                const descBtn = document.getElementById("DescToggle");
                if (descBtn) {
                    descBtn.click();
                    resultMessage = "[System] Opened the Description Drawer. The user can now see detailed scientific parameters and research background.";
                } else {
                    resultMessage = "[System Error] Could not find the Description button on the screen.";
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

            default:
                resultMessage = `[System Error] The requested function (${functionName}) is not yet supported.`;
        }
    } catch (e) {
        resultMessage = `[System Error] Error during function execution: ` + e.message;
    }

    return resultMessage;
}

