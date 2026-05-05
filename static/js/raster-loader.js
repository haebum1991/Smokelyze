
/**
 * TEMPO NO2 Loader
 * Handles fetching JSON metadata, colorizing grayscale PNG on a canvas, 
 * and updating the MapLibre Canvas Source.
 */
import { map } from "./map-init.js";
import { 
  BREAKS_TEMPO, 
  PALETTE_TEMPO, 
  BREAKS_HRRR_ugm2, 
  BREAKS_HRRR_ugm3,
  PALETTE_HRRR_SMOKE
} from "./layers-constants.js";
import * as utils from "./utils.js";
import { showErrorToast } from "./loader-ui.js";
import { logUserAction } from "./fb-logging.js";
import { state } from "./ui-state.js";
import { auth } from "./fb-init.js";

const TEMPO_CONFIG = {
    "no2": {
        productId: "TEMPO_NO2_L3",
        sourceId: "tempo-no2",
        layerId: "layer-tempo-no2",
        mapLayerId: "tempo-no2-raster"
    },
    "hcho": {
        productId: "TEMPO_HCHO_L3",
        sourceId: "tempo-hcho",
        layerId: "layer-tempo-hcho",
        mapLayerId: "tempo-hcho-raster"
    }
};

const TROPOMI_CONFIG = {
    "no2": {
        productId: "TROPOMI_NO2_L3",
        sourceId: "tropomi-no2",
        layerId: "layer-tropomi-no2",
        mapLayerId: "tropomi-no2-raster"
    },
    "hcho": {
        productId: "TROPOMI_HCHO_L3",
        sourceId: "tropomi-hcho",
        layerId: "layer-tropomi-hcho",
        mapLayerId: "tropomi-hcho-raster"
    }
};

const HRRR_CONFIG = {
    "colmd": {
        productId: "COLMD_entire",
        sourceId: "hrrr-colmd",
        layerId: "layer-hrrr-colmd",
        mapLayerId: "hrrr-colmd-raster"
    },
    "massden": {
        productId: "MASSDEN_8m",
        sourceId: "hrrr-massden",
        layerId: "layer-hrrr-massden",
        mapLayerId: "hrrr-massden-raster"
    }
};
    
/**
 * Stores raw pixel data and metadata for hover value sampling
 */
const rasterDataStore = {
    "tempo-no2": { grayscale: null, metadata: null, coordinates: null },
    "tempo-hcho": { grayscale: null, metadata: null, coordinates: null },
    "tropomi-no2": { grayscale: null, metadata: null, coordinates: null },
    "tropomi-hcho": { grayscale: null, metadata: null, coordinates: null },
    "hrrr-colmd": { grayscale: null, metadata: null, coordinates: null },
    "hrrr-massden": { grayscale: null, metadata: null, coordinates: null }
};

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
    ] : [0, 0, 0];
}

// [GPU Memory Fix] Track pending Blob URLs per source to revoke on rapid switches
const pendingBlobUrls = {};

// [Architecture Fix] Global offscreen canvas for processing images.
// This prevents having 6 separate attached DOM canvases and stops WebGL binding crashes.
const processingCanvas = document.createElement("canvas");
const processingCtx = processingCanvas.getContext("2d", { willReadFrequently: true });
const TRANSPARENT_1X1 = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";


/**
 * Colorizes a grayscale PNG based on metadata and a global value scale.
 */
function colorizeRasterImage(imgUrl, metadata, source, sourceId) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            try {
            
                // Revoke blob URL to free memory (no-op if not a blob URL)
                if (imgUrl.startsWith("blob:")) URL.revokeObjectURL(imgUrl);
                
                if (pendingBlobUrls[sourceId] === imgUrl) pendingBlobUrls[sourceId] = null;
                
                if (processingCanvas.width !== img.width || processingCanvas.height !== img.height) {
                    processingCanvas.width = img.width;
                    processingCanvas.height = img.height;
                }
                
                processingCtx.clearRect(0, 0, processingCanvas.width, processingCanvas.height);
                processingCtx.drawImage(img, 0, 0);

                const imageData = processingCtx.getImageData(0, 0, processingCanvas.width, processingCanvas.height);
                const rawData = imageData.data;
                const imgW = imageData.width;
                const imgH = imageData.height;

                // MAX EFFICIENCY: Store only the 8-bit Grayscale channel (Red) to save 75% memory
                const grayscale = new Uint8Array(imgW * imgH);
                for (let i = 0; i < rawData.length; i += 4) {
                    grayscale[i / 4] = rawData[i];
                }

                // Pre-calculate Mercator constants to avoid Math.log/Math.tan on every mouse move
                const latToMercY = (l) => Math.log(Math.tan((Math.PI / 4) + (l * Math.PI / 360)));
                const { min_val, max_val } = metadata;
                
                // Retrieve the correct WGS84 bounds that were already calculated by the loader
                const coordinates = rasterDataStore[sourceId].coordinates;
                const xmin = coordinates[0][0]; // top-left lng
                const xmax = coordinates[1][0]; // top-right lng
                const ymax = coordinates[0][1]; // top-left lat
                const ymin = coordinates[3][1]; // bottom-left lat

                const mercYMin = latToMercY(ymin);
                const mercYMax = latToMercY(ymax);

                rasterDataStore[sourceId] = {
                    ...rasterDataStore[sourceId],
                    grayscale,
                    imgW,
                    imgH,
                    metadata,
                    xmin, xmax, ymin, ymax,
                    mercYMin, mercYMax,
                    mercYRange: mercYMax - mercYMin,
                    lngRange: xmax - xmin
                };

                let breaks = BREAKS_TEMPO;
                let colorsHex = PALETTE_TEMPO;

                if (sourceId === "hrrr-colmd") {
                    breaks = BREAKS_HRRR_ugm2;
                    colorsHex = PALETTE_HRRR_SMOKE;
                }
                if (sourceId === "hrrr-massden") {
                    breaks = BREAKS_HRRR_ugm3;
                    colorsHex = PALETTE_HRRR_SMOKE;
                }
                
                const colors = colorsHex.map(hexToRgb);

                const getRasterColor = (v) => {
                    if (v <= breaks[0]) return colors[0];
                    if (v >= breaks[breaks.length - 1]) return colors[colors.length - 1];
                    for (let i = 0; i < breaks.length - 1; i++) {
                        if (v >= breaks[i] && v <= breaks[i + 1]) {
                            const ratio = (v - breaks[i]) / (breaks[i + 1] - breaks[i]);
                            const c1 = colors[i];
                            const c2 = colors[i + 1];
                            return [
                                Math.round(c1[0] + (c2[0] - c1[0]) * ratio),
                                Math.round(c1[1] + (c2[1] - c1[1]) * ratio),
                                Math.round(c1[2] + (c2[2] - c1[2]) * ratio)
                            ];
                        }
                    }
                    return colors[colors.length - 1];
                };

                let minRec = 999;
                let maxRec = -999;

                for (let i = 0; i < rawData.length; i += 4) {
                    const px = rawData[i];
                    if (px === 0) {
                        rawData[i + 3] = 0;
                    } else {
                        const realValue = min_val + (px / 255) * (max_val - min_val);
                        const isHrrr = sourceId.includes("hrrr");
                        const displayValue = isHrrr ? realValue : realValue / 1e14;

                        // For HRRR-smoke, make values below the lowest break transparent 
                        // to prevent painting a solid blue box over the entire map.
                        if (isHrrr && displayValue < breaks[0]) {
                            rawData[i + 3] = 0;
                            continue;
                        }

                        const rgb = getRasterColor(displayValue);
                        rawData[i] = rgb[0];
                        rawData[i + 1] = rgb[1];
                        rawData[i + 2] = rgb[2];
                        rawData[i + 3] = 220;
                    }
                }

                processingCtx.putImageData(imageData, 0, 0);

                // [Architecture Fix] Update MapLibre ImageSource instead of CanvasSource
                const dataUrl = processingCanvas.toDataURL("image/png");
                source.updateImage({
                    url: dataUrl,
                    coordinates: [
                        [xmin, ymax], [xmax, ymax], [xmax, ymin], [xmin, ymin]
                    ]
                });

                resolve();
            } catch (err) {
                reject(err);
            }
        };
        img.onerror = () => {
            if (imgUrl.startsWith("blob:")) URL.revokeObjectURL(imgUrl);
            reject(new Error("Image load failed"));
        };
        img.src = imgUrl;
    });
}


/**
 * Fetches a PNG image with Firebase auth headers and returns a Blob URL.
 * This allows raster images to be served behind authentication.
 */
async function fetchAuthenticatedImage(url, sourceId) {
    if (pendingBlobUrls[sourceId]) {
        URL.revokeObjectURL(pendingBlobUrls[sourceId]);
        pendingBlobUrls[sourceId] = null;
    }

    const fetchOptions = {};
    if (auth?.currentUser) {
        try {
            const idToken = await auth.currentUser.getIdToken();
            fetchOptions.headers = { "Authorization": `Bearer ${idToken}` };
        } catch (e) {
            console.warn("Could not get ID token for image:", e);
        }
    }
    const res = await fetch(url, fetchOptions);
    if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    if (sourceId) pendingBlobUrls[sourceId] = blobUrl;
    return blobUrl;
}


function clearRasterSource(source, sourceId) {
    if (!source) return;
    
    // Skip if already cleared to prevent WebGL memory leak
    if (rasterDataStore[sourceId] && rasterDataStore[sourceId].cleared === true) {
        return;
    }

    try {
        // [Architecture Fix] Clear ImageSource using transparent 1x1 pixel
        if (source.updateImage) {
            source.updateImage({
                url: TRANSPARENT_1X1,
                coordinates: [[-1, 1], [-0.9, 1], [-0.9, 0.9], [-1, 0.9]]
            });
        }
        
        if (!rasterDataStore[sourceId]) {
            rasterDataStore[sourceId] = {};
        }
        rasterDataStore[sourceId].cleared = true;
        
        // Free memory explicitly
        rasterDataStore[sourceId].grayscale = null;
        rasterDataStore[sourceId].metadata = null;
        
        if (pendingBlobUrls[sourceId]) {
            URL.revokeObjectURL(pendingBlobUrls[sourceId]);
            pendingBlobUrls[sourceId] = null;
        }
        
    } catch (e) {
        console.warn("TEMPO clear failed:", e);
    }
}

/**
 * Resets all Raster sources (clears canvases and moves them out of view)
 */
export function clearAllRaster() {
    for (const cfg of [...Object.values(TEMPO_CONFIG), ...Object.values(TROPOMI_CONFIG), ...Object.values(HRRR_CONFIG)]) {
        const source = map?.getSource(cfg.sourceId);
        if (source) clearRasterSource(source, cfg.sourceId);
        rasterDataStore[cfg.sourceId] = { grayscale: null, metadata: null, coordinates: null, cleared: true };
    }
}

/**
 * Global mousemove handler for TEMPO layers
 */
let tempoHoverBound = false;
function initRasterHover() {
    if (tempoHoverBound || !map) return;

    const tooltip = document.getElementById("MapTooltip");
    if (!tooltip) return;

    map.on("mousemove", (e) => {
        
        // [UX Fix]: Dont interfere if the tooltip is locked by a click
        if (state?.tooltipLocked) return;

        // [UX Fix]: Yield tooltip to specifically OUR vector layers (AirNow, Smoke, Fire, etc.) on top
        const topFeatures = map.queryRenderedFeatures(e.point);
        const isVectorOnTop = topFeatures.some(f => {
            const s = f.source || "";
            return s === "smoke" || s === "fire" || s === "burn" || 
                   s.includes("wildfire") || s === "MapPost" || 
                   s.includes("airnow") || s.includes("gam_") || 
                   s.includes("pm_cbsa") || s === "epa_ember";
        });

        if (isVectorOnTop) {
            tempoHoverBound.isShowing = false;
            return;
        }
        
        // Find visible TEMPO or TROPOMI or HRRR layers
        const activeRasterLayer = [...Object.values(TEMPO_CONFIG), ...Object.values(TROPOMI_CONFIG), ...Object.values(HRRR_CONFIG)].find(cfg => {
            if (!map.getLayer(cfg.mapLayerId)) return false;
            return map.getLayoutProperty(cfg.mapLayerId, "visibility") === "visible";
        });

        if (!activeRasterLayer) {
            if (!tempoHoverBound.isShowing) return;
            tooltip.style.display = "none";
            map.getCanvas().style.cursor = "";
            tempoHoverBound.isShowing = false;
            return;
        }

        const sourceId = activeRasterLayer.sourceId;
        const store = rasterDataStore[sourceId];
        if (!store || !store.grayscale) return;

        const wrapped = e.lngLat.wrap();
        const { lng, lat } = wrapped;

        // Check if cursor is within extent (Quick check using pre-stored constants)
        if (lng >= store.xmin && lng <= store.xmax && lat >= store.ymin && lat <= store.ymax) {

            // X is linear: (lng - xmin) / lngRange
            const xPct = (lng - store.xmin) / store.lngRange;

            // Y is Mercator: (mercYMax - mercYLat) / mercYRange
            const mercYLat = Math.log(Math.tan((Math.PI / 4) + (lat * Math.PI / 360)));
            const yPct = (store.mercYMax - mercYLat) / store.mercYRange;

            const pxX = (xPct * store.imgW) | 0; // Bitwise OR 0 is faster than Math.floor
            const pxY = (yPct * store.imgH) | 0;

            if (pxX >= 0 && pxX < store.imgW && pxY >= 0 && pxY < store.imgH) {
                const gray = store.grayscale[pxY * store.imgW + pxX];

                if (!gray) {
                    hideRasterTooltip();
                    return;
                }

                // Restoration logic: Map 0-255 back to [min_val, max_val]
                const { metadata } = store;
                const realValue = metadata.min_val + (gray / 255) * (metadata.max_val - metadata.min_val);
                
                const isHrrr = sourceId.includes("hrrr");
                const isHrrrColmd = sourceId === "hrrr-colmd";
                const displayValue = isHrrr ? (isHrrrColmd ? realValue / 1000 : realValue) : realValue / 1e14;
                
                const isTempo = activeRasterLayer.productId.includes("TEMPO");
                
                let layerTitle = "";
                let unitHtml = "";
                
                if (isHrrr) {
                    if (sourceId === "hrrr-colmd") {
                        layerTitle = "HRRR-smokeVCD (hourly)";
                        unitHtml = `<span style="color: var(--text-main);">&times; 10&sup3; &micro;g m<sup>-2</sup></span>`;
                    } else {
                        layerTitle = "HRRR-smoke8m (hourly)";
                        unitHtml = `<span style="color: var(--text-main);">&micro;g m<sup>-3</sup></span>`;
                    }
                } else {
                    layerTitle = activeRasterLayer.productId.includes("NO2") ?
                        (isTempo ? "TEMPO-NO2VCD (hourly)" : "TROPOMI-NO2VCD") :
                        (isTempo ? "TEMPO-HCHOVCD (hourly)" : "TROPOMI-HCHOVCD");
                    unitHtml = `<span style="color: var(--text-main);">&times 10<sup>14</sup> molec. cm<sup>-2</sup></span>`;
                }

                let metaHtml = "";
                if (isTempo) {
                    metaHtml = `
                        <div style="display: flex; flex-direction: column;">
                            <span>Timestamp: <b>${utils.ESML(metadata.datetime) || "NA"} UTC</b></span>
                            <span>Scan No.: <b>${utils.ESML(metadata.scan_nos) || "NA"}</b></span>
                            <span>Version: <b>${utils.ESML(metadata.version) || "NA"}</b></span>
                        </div>
                    `;
                } else if (isHrrr) {
                    let hrrrTimestamp = utils.ESML(metadata.datetime) || "NA";
                    if (metadata.id) {
                        const match = metadata.id.match(/t(\d{2})z/);
                        if (match) hrrrTimestamp += ` ${match[1]}:00:00`;
                    }
                    
                    metaHtml = `
                        <div style="display: flex; flex-direction: column;">
                            <span>Timestamp: <b>${hrrrTimestamp} UTC</b></span>
                            <span>Dataset: <b>${utils.ESML(metadata.id) || "NA"}</b></span>
                        </div>
                    `;
                }

                tooltip.innerHTML = `
                    <div>
                        <strong style="color: var(--card-shadow);">${layerTitle}</strong>
                    </div>
                    <div>
                        <div>Value: <b style="font-size: 1.6rem; color: var(--card-shadow);">${displayValue.toFixed(isHrrrColmd ? 2 : (isHrrr ? 1 : 2))}</b> 
                        ${unitHtml}</div>
                        ${metaHtml}
                    </div>
                `;
                
                tooltip.style.display = "block";
                map.getCanvas().style.cursor = "pointer";
                tempoHoverBound.isShowing = true;

                let x = e.originalEvent.clientX + 15;
                let y = e.originalEvent.clientY + 15;
                if (x + 250 > window.innerWidth) x = e.originalEvent.clientX - 260;
                if (y + 100 > window.innerHeight) y = e.originalEvent.clientY - 110;

                tooltip.style.left = `${x / 10}rem`;
                tooltip.style.top = `${y / 10}rem`;
            } else {
                hideRasterTooltip();
            }
        } else {
            hideRasterTooltip();
        }
    });

    function hideRasterTooltip() {
        if (!tempoHoverBound.isShowing) return;
        tooltip.style.display = "none";
        map.getCanvas().style.cursor = "";
        tempoHoverBound.isShowing = false;
    }

    tempoHoverBound = { active: true, isShowing: false };
}

export async function tempoLoadData(isoDate) {
    const timePicker = document.getElementById("timePicker");
    if (!timePicker) return;

    const localHour = parseInt(timePicker.value);
    const [y, m, d] = isoDate.split("-").map(Number);
    const localDate = new Date(y, m - 1, d, localHour);
    const utcHour = localDate.getUTCHours();
    const utcYear = localDate.getUTCFullYear();
    const utcMonth = String(localDate.getUTCMonth() + 1).padStart(2, "0");
    const utcDay = String(localDate.getUTCDate()).padStart(2, "0");
    const utcIsoDate = `${utcYear}-${utcMonth}-${utcDay}`;

    for (const [key, cfg] of Object.entries(TEMPO_CONFIG)) {
        const source = map?.getSource(cfg.sourceId);
        if (!source) continue;

        const cb = document.getElementById(cfg.layerId);
        // Always clear first to prevent old data from sticking around while loading
        clearRasterSource(source, cfg.sourceId);

        if (!cb || !cb.checked) {
            continue;
        }

        const { jsonUrl: baseJson, pngUrl: basePng } = utils.urlPngTempo(utcIsoDate, utcHour, cfg.productId);
        const buster = utils.getCacheBuster(utcIsoDate);
        const jsonUrl = baseJson + buster;
        const pngUrl = basePng + buster;

        try {
            const metadata = await utils.fetchJson(jsonUrl, null);
            const targetExtent = metadata?.extent_raw || metadata?.extent;

            if (metadata && targetExtent) {
                const xmin = targetExtent[0];
                const xmax = targetExtent[1];
                const ymin = targetExtent[2];
                const ymax = targetExtent[3];
                const coordinates = [
                    [xmin, ymax], [xmax, ymax], [xmax, ymin], [xmin, ymin]
                ];
                
                if (!rasterDataStore[cfg.sourceId]) {
                    rasterDataStore[cfg.sourceId] = { grayscale: null, metadata: null, coordinates: null };
                }
                
                rasterDataStore[cfg.sourceId].coordinates = coordinates;
                rasterDataStore[cfg.sourceId].cleared = false;
                
                const blobUrl = await fetchAuthenticatedImage(pngUrl, cfg.sourceId);
                await colorizeRasterImage(blobUrl, metadata, source, cfg.sourceId);
                // Coordinates updated via ImageSource updateImage
                
                logUserAction("view", {
                    dataset: cfg.sourceId,
                    layer: cfg.sourceId,
                    date: isoDate,
                    filename: pngUrl
                });

                initRasterHover();
            } else {
                throw new Error("No data");
            }
        } catch (e) {
            console.error(`TEMPO ${key} load error:`, e);
            
            if (rasterDataStore[cfg.sourceId]) rasterDataStore[cfg.sourceId].cleared = false;
            clearRasterSource(source, cfg.sourceId);
            
            // 데이터가 없는 경우 (404 등) 사용자에게 알림
            if (cb && cb.checked) {
                const label = key.toUpperCase();
                showErrorToast(`No ${label} TEMPO data available for this date and hour.`, "error");
            }
        }
    }
}

export async function tropomiLoadData(isoDate) {
    for (const [key, cfg] of Object.entries(TROPOMI_CONFIG)) {
        const source = map?.getSource(cfg.sourceId);
        if (!source) continue;

        const cb = document.getElementById(cfg.layerId);
        // Always clear first to prevent old data from sticking around while loading
        clearRasterSource(source, cfg.sourceId);

        if (!cb || !cb.checked) {
            continue;
        }

        const { jsonUrl: baseJson, pngUrl: basePng } = utils.urlPngTropomi(isoDate, cfg.productId);
        const buster = utils.getCacheBuster(isoDate);
        const jsonUrl = baseJson + buster;
        const pngUrl = basePng + buster;

        try {
            const metadata = await utils.fetchJson(jsonUrl, null);
            const targetExtent = metadata?.extent_raw || metadata?.extent;

            if (metadata && targetExtent) {
                const xmin = targetExtent[0];
                const xmax = targetExtent[1];
                const ymin = targetExtent[2];
                const ymax = targetExtent[3];
                const coordinates = [
                    [xmin, ymax], [xmax, ymax], [xmax, ymin], [xmin, ymin]
                ];
                
                if (!rasterDataStore[cfg.sourceId]) {
                    rasterDataStore[cfg.sourceId] = { grayscale: null, metadata: null, coordinates: null };
                }
                
                rasterDataStore[cfg.sourceId].coordinates = coordinates;
                rasterDataStore[cfg.sourceId].cleared = false;
                
                const blobUrl = await fetchAuthenticatedImage(pngUrl, cfg.sourceId);
                await colorizeRasterImage(blobUrl, metadata, source, cfg.sourceId);
                // Coordinates updated via ImageSource updateImage
                
                logUserAction("view", {
                    dataset: cfg.sourceId,
                    layer: cfg.sourceId,
                    date: isoDate,
                    filename: pngUrl
                });

                initRasterHover();
            } else {
                throw new Error("No data");
            }
        } catch (e) {
            console.error(`TROPOMI ${key} load error:`, e);
            if (rasterDataStore[cfg.sourceId]) rasterDataStore[cfg.sourceId].cleared = false;
            clearRasterSource(source, cfg.sourceId);
            
            // Alert user if no data
            if (cb && cb.checked) {
                const label = key.toUpperCase();
                showErrorToast(`No ${label} TROPOMI data available for this date.`, "error");
            }
        }
    }
}

export async function hrrrLoadData(isoDate) {
    const timePicker = document.getElementById("timePicker");
    if (!timePicker) return;

    const localHour = parseInt(timePicker.value);
    const [y, m, d] = isoDate.split("-").map(Number);
    const localDate = new Date(y, m - 1, d, localHour);
    const utcHour = localDate.getUTCHours();
    const utcIsoDate = `${localDate.getUTCFullYear()}-${String(localDate.getUTCMonth() + 1).padStart(2, "0")}-${String(localDate.getUTCDate()).padStart(2, "0")}`;

    for (const [key, cfg] of Object.entries(HRRR_CONFIG)) {
        const source = map?.getSource(cfg.sourceId);
        if (!source) continue;

        const cb = document.getElementById(cfg.layerId);
        clearRasterSource(source, cfg.sourceId);

        if (!cb || !cb.checked) {
            continue;
        }

        const { jsonUrl: baseJson, pngUrl: basePng } = utils.urlPngHRRR(utcIsoDate, utcHour, cfg.productId);
        const buster = utils.getCacheBuster(utcIsoDate);
        const jsonUrl = baseJson + buster;
        const pngUrl = basePng + buster;

        try {
            const metadata = await utils.fetchJson(jsonUrl, null);
            if (metadata) {
                // HRRR data is always EPSG:3857 — convert to WGS84 degrees
                const [lonMin, latMin] = utils.mercatorToLngLat(metadata.extent_file[0], metadata.extent_file[2]);
                const [lonMax, latMax] = utils.mercatorToLngLat(metadata.extent_file[1], metadata.extent_file[3]);
                const xmin = lonMin, xmax = lonMax, ymin = latMin, ymax = latMax;

                const coordinates = [
                    [xmin, ymax], [xmax, ymax], [xmax, ymin], [xmin, ymin]
                ];
                
                if (!rasterDataStore[cfg.sourceId]) {
                    rasterDataStore[cfg.sourceId] = { grayscale: null, metadata: null, coordinates: null };
                }

                rasterDataStore[cfg.sourceId].coordinates = coordinates;
                rasterDataStore[cfg.sourceId].cleared = false;
                
                const blobUrl = await fetchAuthenticatedImage(pngUrl, cfg.sourceId);
                await colorizeRasterImage(blobUrl, metadata, source, cfg.sourceId);

                logUserAction("view", {
                    dataset: cfg.sourceId,
                    layer: cfg.sourceId,
                    date: isoDate,
                    filename: pngUrl
                });

                initRasterHover();
            } else {
                throw new Error("No data");
            }
        } catch (e) {
            console.error(`HRRR ${key} load error:`, e);
            if (rasterDataStore[cfg.sourceId]) rasterDataStore[cfg.sourceId].cleared = false;
            clearRasterSource(source, cfg.sourceId);

            if (cb && cb.checked) {
                const label = key.toUpperCase();
                showErrorToast(`No ${label} HRRR data available for this date and hour.`, "error");
            }
        }
    }
}

