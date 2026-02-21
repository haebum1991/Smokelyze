
import { map } from "./layers-state.js";
import { highlightLocation } from "./utils.js";

export const smokelyzeAiTools = [
    {
        function_declarations: [
            {
                name: "change_date",
                description: "Changes the date of the map display when the user wants to see data from a specific past or future date.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        date: {
                            type: "STRING",
                            description: "The date in YYYY-MM-DD format (e.g., 2023-08-10)"
                        }
                    },
                    required: ["date"]
                }
            },
            {
                name: "extract_summary_aqs",
                description: "Extracts raw property data (GeoJSON) from THE CURRENTLY LOADED map source. If a source is NOT loaded, you must first call change_dataset or change_layer to load it. Use this to find highest/lowest values, station information, or to perform correlation analysis.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        sourceId: {
                            type: "STRING",
                            description: "ID of the data source (Use underscores: gam_v2, gam_v1, pm_cbsa, epa_ember, airnow_daily)"
                        },
                        target_field: {
                            type: "STRING",
                            description: "The field name to sort or extract (e.g., MDA8O3, PM2.5, TMAX, SMO)"
                        },
                        sort_desc: {
                            type: "BOOLEAN",
                            description: "Set to true for highest value first, false for lowest value first."
                        },
                        limit: {
                            type: "INTEGER",
                            description: "Maximum number of records to return (default: 10, set to 1 for the single highest/lowest point)"
                        }
                    },
                    required: ["sourceId", "target_field"]
                }
            },
            {
                name: "move_to_location",
                description: "Smoothly pans the map to a specific coordinate and displays a highlight marker. Required after finding a specific site of interest via extract_summary_aqs.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        lat: { type: "NUMBER", description: "Target Latitude" },
                        lon: { type: "NUMBER", description: "Target Longitude" },
                        sourceId: { type: "STRING", description: "Related data source ID (e.g., gam_v2)" },
                        properties: {
                            type: "OBJECT",
                            description: "The complete property object of the location from extract_summary_aqs."
                        }
                    },
                    required: ["lat", "lon"]
                }
            },
            {
                name: "change_dataset",
                description: "Changes the active Published dataset model. If you want to extract data from a model, you must call this first with the hyphenated ID.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        dataset_value: {
                            type: "STRING",
                            description: "The dataset value (Use hyphens: gam-v2, gam-v1, epa-ember, pm-cbsa)"
                        }
                    },
                    required: ["dataset_value"]
                }
            },
            {
                name: "change_layer",
                description: "Turns a specific data layer ON or OFF. Use this to ensure a layer like 'layer-smo' is active before trying to extract data from its source.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        layer_id: {
                            type: "STRING",
                            description: "The HTML ID of the layer checkbox (e.g., layer-mda8-obs, layer-airnow-daily-pm25, layer-smo, layer-smoke, layer-wildfire-news)"
                        },
                        turn_on: {
                            type: "BOOLEAN",
                            description: "True to check/turn ON, false to uncheck/turn OFF"
                        }
                    },
                    required: ["layer_id", "turn_on"]
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
                const sourceId = args?.sourceId || "gam_v2";
                if (!map) {
                    return "[System Error] Map 인스턴스를 불러올 수 없습니다.";
                }

                const source = map.getSource(sourceId);
                if (!source || !source._data || !source._data.features || source._data.features.length === 0) {
                    resultMessage = `[System Event] The requested source (${sourceId}) is not loaded on the map. The user must first select the corresponding layer or dataset from the control panel to download it. Please ask the user to activate "${sourceId}" and try again.`;
                    break;
                }

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
                const srcId = args?.sourceId || "gam_v2";
                let props = args?.properties || {};

                if (targetLat && targetLon) {
                    // [경보] 만약 AI가 properties를 안 보내줬다면, 지도의 해당 위치에서 가장 가까운 Feature를 한 번 찾아봅니다.
                    if (Object.keys(props).length === 0 && map) {
                        const point = map.project([targetLon, targetLat]);
                        const features = map.queryRenderedFeatures(point, {
                            layers: [srcId, srcId + "-layer", srcId + "-circle"] // 레이어 이름 추측
                        });
                        if (features && features.length > 0) {
                            props = features[0].properties;
                        }
                    }

                    highlightLocation([targetLon, targetLat], props, srcId);
                    resultMessage = `[System] Moved map to [lat: ${targetLat}, lon: ${targetLon}] and highlighted. (Tooltip: ${Object.keys(props).length > 0 ? "Success" : "Properties not found"}). Inform the user about the movement.`;
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
                const layerId = args?.layer_id;
                const turnOn = args?.turn_on;
                const checkbox = document.getElementById(layerId);

                if (checkbox) {
                    if (checkbox.checked !== turnOn) {
                        checkbox.checked = turnOn;
                        checkbox.dispatchEvent(new Event("change", { bubbles: true }));
                        resultMessage = `[System] Layer "${layerId}" turned ${turnOn ? "ON" : "OFF"}. Data is loading. Inform the user.`;
                    } else {
                        resultMessage = `[System] Layer "${layerId}" is already ${turnOn ? "ON" : "OFF"}.`;
                    }
                } else {
                    resultMessage = `[System Error] Could not find layer checkbox with ID "${layerId}". Verify the ID.`;
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

