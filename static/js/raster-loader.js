
/**
 * TEMPO NO2 Loader
 * Handles fetching JSON metadata, colorizing grayscale PNG on a canvas, 
 * and updating the MapLibre Canvas Source.
 */
import { map } from "./map-init.js";
import * as utils from "./utils.js";
import { showLoaderError } from "./loader-ui.js";
import { logUserAction } from "./fb-logging.js";
import { state } from "./ui-state.js";
import { auth } from "./fb-init.js";
import { LAYER_TEMPLATES, ExcludeLayerGroups } from "./layers-def.js";
import { activeLayerStack, closedLegendIds } from "./layers-state.js";
import { getTopSpatialLayer } from "./layers-handler.js";
import { generatePopupHTML } from "./layers-tooltip.js";
import {
    BREAKS_TEMPO,
    BREAKS_HRRR_ugm2,
    BREAKS_HRRR_ugm3,
    BREAKS_GOES_AOD,
    BREAKS_GEOSCF_O3,
    BREAKS_GEOSCF_CO,
    BREAKS_GEOSCF_NO2,
    BREAKS_GEOSCF_HCHO,
    BREAKS_GEOSCF_PM,
    BREAKS_GEOSCF_PMOC,
    PALETTE_TEMPO,
    PALETTE_HRRR_SMOKE,
    PALETTE_GOES_AOD,
    PALETTE_GEOSCF_O3,
    PALETTE_GEOSCF_CO,
    PALETTE_GEOSCF_NO2,
    PALETTE_GEOSCF_HCHO,
    PALETTE_GEOSCF_PM,
    PALETTE_GEOSCF_PMOC
} from "./layers-constants.js";

export const TEMPO_CONFIG = {
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

export const TROPOMI_CONFIG = {
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

export const HRRR_CONFIG = {
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

export const GOES_CONFIG = {
    "aod-east": {
        productId: "ABI-L2-AODC-east",
        sourceId: "goes-aod-east",
        layerId: "layer-goes-aod-east",
        mapLayerId: "goes-aod-east-raster"
    },
    "aod-west": {
        productId: "ABI-L2-AODC-west",
        sourceId: "goes-aod-west",
        layerId: "layer-goes-aod-west",
        mapLayerId: "goes-aod-west-raster"
    },
    "geocolor-east": {
        productId: "GOESEastCONUSGeoColor",
        sourceId: "goes-geocolor-east",
        layerId: "layer-goes-geocolor-east",
        mapLayerId: "goes-geocolor-east-raster"
    },
    "geocolor-west": {
        productId: "GOESWestCONUSGeoColor",
        sourceId: "goes-geocolor-west",
        layerId: "layer-goes-geocolor-west",
        mapLayerId: "goes-geocolor-west-raster"
    }
};

export const VIIRS_CONFIG = {
    "viirs-truecolor": {
        productId: "VIIRS_NOAA21_CorrectedReflectance_TrueColor",
        sourceId: "viirs-truecolor",
        layerId: "layer-viirs-truecolor",
        mapLayerId: "viirs-truecolor-raster"
    }
};

export const GEOSCF_CONFIG = {
    "o3": {
        productId: "o3",
        sourceId: "geoscf-o3",
        layerId: "layer-geoscf-o3",
        mapLayerId: "geoscf-o3-raster"
    },
    "co": {
        productId: "co",
        sourceId: "geoscf-co",
        layerId: "layer-geoscf-co",
        mapLayerId: "geoscf-co-raster"
    },
    "no2": {
        productId: "no2",
        sourceId: "geoscf-no2",
        layerId: "layer-geoscf-no2",
        mapLayerId: "geoscf-no2-raster"
    },
    "hcho": {
        productId: "hcho",
        sourceId: "geoscf-hcho",
        layerId: "layer-geoscf-hcho",
        mapLayerId: "geoscf-hcho-raster"
    },
    "pm25": {
        productId: "pm25_rh35",
        sourceId: "geoscf-pm25",
        layerId: "layer-geoscf-pm25",
        mapLayerId: "geoscf-pm25-raster"
    },
    "pm25oc": {
        productId: "pm25oc_rh35",
        sourceId: "geoscf-pm25oc",
        layerId: "layer-geoscf-pm25oc",
        mapLayerId: "geoscf-pm25oc-raster"
    }
};

/**
 * Stores raw pixel data and metadata for hover value sampling
 */
export const rasterDataStore = {
    "tempo-no2": { grayscale: null, metadata: null, coordinates: null },
    "tempo-hcho": { grayscale: null, metadata: null, coordinates: null },
    "tropomi-no2": { grayscale: null, metadata: null, coordinates: null },
    "tropomi-hcho": { grayscale: null, metadata: null, coordinates: null },
    "hrrr-colmd": { grayscale: null, metadata: null, coordinates: null },
    "hrrr-massden": { grayscale: null, metadata: null, coordinates: null },
    "goes-aod-east": { grayscale: null, metadata: null, coordinates: null },
    "goes-aod-west": { grayscale: null, metadata: null, coordinates: null },
    "goes-geocolor-east": { grayscale: null, metadata: null, coordinates: null },
    "goes-geocolor-west": { grayscale: null, metadata: null, coordinates: null },
    "viirs-truecolor": { grayscale: null, metadata: null, coordinates: null },
    "geoscf-o3": { grayscale: null, metadata: null, coordinates: null },
    "geoscf-co": { grayscale: null, metadata: null, coordinates: null },
    "geoscf-no2": { grayscale: null, metadata: null, coordinates: null },
    "geoscf-hcho": { grayscale: null, metadata: null, coordinates: null },
    "geoscf-pm25": { grayscale: null, metadata: null, coordinates: null },
    "geoscf-pm25oc": { grayscale: null, metadata: null, coordinates: null }
};

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
    ] : [0, 0, 0];
}

function getDisplayValue(sourceId, realValue) {
    const isTempo = sourceId.includes("tempo");
    const isTropomi = sourceId.includes("tropomi");
    const isHrrrColmd = sourceId.includes("hrrr-colmd");
    
    if (isTempo || isTropomi) {
        return realValue / 1e14;
    }
    if (isHrrrColmd) {
        return realValue / 1e3;
    }
    return realValue;
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
                const isTrueColor = sourceId.includes("geocolor") || sourceId.includes("truecolor");

                // MAX EFFICIENCY: Store only the 8-bit Grayscale channel (Red) to save 75% memory (skip for true color)
                const grayscale = isTrueColor ? null : new Uint8Array(imgW * imgH);
                
                if (!isTrueColor) {
                    for (let i = 0; i < rawData.length; i += 4) {
                        grayscale[i / 4] = rawData[i];
                    }
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
                } else if (sourceId === "hrrr-massden") {
                    breaks = BREAKS_HRRR_ugm3;
                    colorsHex = PALETTE_HRRR_SMOKE;
                } else if (sourceId.startsWith("goes-")) {
                    breaks = BREAKS_GOES_AOD;
                    colorsHex = PALETTE_GOES_AOD;
                } else if (sourceId === "geoscf-o3") {
                    breaks = BREAKS_GEOSCF_O3;
                    colorsHex = PALETTE_GEOSCF_O3;
                } else if (sourceId === "geoscf-no2") {
                    breaks = BREAKS_GEOSCF_NO2;
                    colorsHex = PALETTE_GEOSCF_NO2;
                } else if (sourceId === "geoscf-co") {
                    breaks = BREAKS_GEOSCF_CO;
                    colorsHex = PALETTE_GEOSCF_CO;
                } else if (sourceId === "geoscf-hcho") {
                    breaks = BREAKS_GEOSCF_HCHO;
                    colorsHex = PALETTE_GEOSCF_HCHO;
                } else if (sourceId === "geoscf-pm25") {
                    breaks = BREAKS_GEOSCF_PM;
                    colorsHex = PALETTE_GEOSCF_PM;
                } else if (sourceId === "geoscf-pm25oc") {
                    breaks = BREAKS_GEOSCF_PMOC;
                    colorsHex = PALETTE_GEOSCF_PMOC;
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

                if (!isTrueColor) {
                    
                    const isHrrr = sourceId.includes("hrrr");
                    const isGoes = sourceId.includes("goes");
                    const isGeoscf = sourceId.includes("geoscf");
                    const isModel = isHrrr || isGeoscf;

                    const tmpl = LAYER_TEMPLATES.find(t => t.id === sourceId);
                    const decimals = tmpl?.decimals !== undefined ? tmpl.decimals : 2;
                    const zeroThreshold = Math.pow(10, -decimals) / 2;
                    
                    for (let i = 0; i < rawData.length; i += 4) {
                        const px = rawData[i];
                        if (px === 0 && !isModel) {
                            rawData[i + 3] = 0;
                        } else {
                            const realValue = min_val + (px / 255) * (max_val - min_val);
                            const displayValue = getDisplayValue(sourceId, realValue);

                            // 1. Satellite Observations (GOES AOD): Filter out natural background optical noise
                            if (isGoes && displayValue < breaks[0]) {
                                rawData[i + 3] = 0;
                                continue;
                            }

                            // 2. Model-based Simulations (HRRR & GEOS-CF): Transparent when rounding to 0 at configured decimals
                            if ((isHrrr || isGeoscf) && displayValue < zeroThreshold) {
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
                }

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
export async function fetchAuthenticatedImage(url, sourceId) {
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
    for (const cfg of [
        ...Object.values(TEMPO_CONFIG),
        ...Object.values(TROPOMI_CONFIG),
        ...Object.values(HRRR_CONFIG),
        ...Object.values(GOES_CONFIG),
        ...Object.values(VIIRS_CONFIG),
        ...Object.values(GEOSCF_CONFIG)
    ]) {
        const source = map?.getSource(cfg.sourceId);
        if (source) clearRasterSource(source, cfg.sourceId);
        rasterDataStore[cfg.sourceId] = { grayscale: null, metadata: null, coordinates: null, cleared: true };
    }
    
    updateRasterHoverBox(null);
}

/**
 * Global mousemove handler for TEMPO layers
 */
let tempoHoverBound = false;
export function getRasterTooltipInfo(sourceId, lng, lat) {
    const store = rasterDataStore[sourceId];
    if (!store || !store.grayscale) return null;

    if (lng < store.xmin || lng > store.xmax || lat < store.ymin || lat > store.ymax) return null;

    const xPct = (lng - store.xmin) / store.lngRange;
    const mercYLat = Math.log(Math.tan((Math.PI / 4) + (lat * Math.PI / 360)));
    const yPct = (store.mercYMax - mercYLat) / store.mercYRange;

    const pxX = (xPct * store.imgW) | 0;
    const pxY = (yPct * store.imgH) | 0;

    if (pxX < 0 || pxX >= store.imgW || pxY < 0 || pxY >= store.imgH) return null;

    const gray = store.grayscale[pxY * store.imgW + pxX];
    if (gray === null || gray === undefined || gray === 0) return null;

    const { metadata } = store;
    const realValue = metadata.min_val + (gray / 255) * (metadata.max_val - metadata.min_val);
    const displayValue = getDisplayValue(sourceId, realValue);

    const isTempo = sourceId.includes("tempo");
    const isTropomi = sourceId.includes("tropomi");
    const isHrrr = sourceId.includes("hrrr");
    const isGoes = sourceId.includes("goes");
    const isGeoscf = sourceId.includes("geoscf");
    const isHrrrColmd = sourceId.includes("hrrr-colmd");

    let layerTitle = "";
    let unitHtml = "";

    const tmpl = LAYER_TEMPLATES.find(t => t.id === sourceId);
    if (tmpl) {
        layerTitle = tmpl.title;
        if (tmpl.hourly && !layerTitle.includes(" (hourly)")) {
            layerTitle += " (hourly)";
        }
        if (tmpl.unit) {
            const unitText = tmpl.unit.startsWith("10") ? `× ${tmpl.unit}` : tmpl.unit;
            unitHtml = `<span style="color: ${sourceId.includes("goes") ? "var(--text-soft)" : "var(--text-main)"}; font-weight: normal;"> ${unitText}</span>`;
        }
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
    } else if (isHrrr || isGoes || isGeoscf) {
        let timestamp = utils.ESML(metadata.datetime) || "NA";
        const pngUrl = store.pngUrl || "";
        const match = pngUrl.match(/[t_](\d{2})[zT]/);
        if (match && !timestamp.includes(":")) {
            timestamp += ` ${match[1]}:00:00`;
        }

        let datasetName = utils.ESML(metadata.id) || "NA";
        if (isGoes && datasetName !== "NA") {
            const parts = datasetName.split("_");
            if (parts[0] === "OR" && parts.length >= 3) {
                datasetName = `${parts[1]} (${parts[2]})`;
            } else if (parts.length >= 2) {
                datasetName = `${parts[0]} (${parts[1]})`;
            }
        }

        metaHtml = `
            <div style="display: flex; flex-direction: column;">
                <span>Timestamp: <b>${timestamp} UTC</b></span>
                <span>Dataset: <b>${datasetName}</b></span>
            </div>
        `;
    }

    // Calculate grid cell center coordinates and bounding box
    const u0 = pxX / store.imgW;
    const u1 = (pxX + 1) / store.imgW;
    const v0 = pxY / store.imgH;
    const v1 = (pxY + 1) / store.imgH;

    const lon0 = store.xmin + u0 * store.lngRange;
    const lon1 = store.xmin + u1 * store.lngRange;
    const gridLon = store.xmin + ((pxX + 0.5) / store.imgW) * store.lngRange;

    const mercY0 = store.mercYMax - v0 * store.mercYRange;
    const mercY1 = store.mercYMax - v1 * store.mercYRange;
    const centerMercY = store.mercYMax - ((pxY + 0.5) / store.imgH) * store.mercYRange;

    const lat0 = (2 * Math.atan(Math.exp(mercY0)) - Math.PI / 2) * (180 / Math.PI);
    const lat1 = (2 * Math.atan(Math.exp(mercY1)) - Math.PI / 2) * (180 / Math.PI);
    const gridLat = (2 * Math.atan(Math.exp(centerMercY)) - Math.PI / 2) * (180 / Math.PI);

    const bboxPolygon = [
        [lon0, lat0],
        [lon1, lat0],
        [lon1, lat1],
        [lon0, lat1],
        [lon0, lat0]
    ];

    const hrStyle = "border: 0.1rem solid black; margin-top: 0.3rem; margin-bottom: 0.3rem;";
    const decimals = tmpl?.decimals !== undefined ? tmpl.decimals : 2;

    const html = `
        <div>
            <strong style="color: var(--card-shadow);">${layerTitle}</strong>
        </div>
        <hr style="${hrStyle}">
        <div>
            <div>Value: <b style="font-size: 1.6rem; color: var(--card-shadow);">${displayValue.toFixed(decimals)}</b> 
            ${unitHtml}</div>
            <div>Latitude: ${gridLat.toFixed(3)}</div>
            <div>Longitude: ${gridLon.toFixed(3)}</div>
            ${metaHtml}
        </div>
    `;

    return { html, gridLon, gridLat, bboxPolygon, pxX, pxY, sourceId };
}

let lastHoverBoxKey = null;
export function updateRasterHoverBox(info, force = false) {
    if (!map) return;
    if (!map.getSource("raster-hover-box")) {
        map.addSource("raster-hover-box", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] }
        });
    }
    if (!map.getLayer("raster-hover-box-line")) {
        map.addLayer({
            id: "raster-hover-box-line",
            type: "line",
            source: "raster-hover-box",
            paint: {
                "line-color": "#ff0000",
                "line-width": 2
            }
        });
    }

    const src = map.getSource("raster-hover-box");
    if (!src) return;

    if (!info) {
        src.setData({ type: "FeatureCollection", features: [] });
        lastHoverBoxKey = null;
        return;
    }

    const key = `${info.sourceId}_${info.pxX}_${info.pxY}`;
    if (!force && key === lastHoverBoxKey) return;
    lastHoverBoxKey = key;

    src.setData({
        type: "FeatureCollection",
        features: [{
            type: "Feature",
            geometry: {
                type: "Polygon",
                coordinates: [info.bboxPolygon]
            },
            properties: {}
        }]
    });
}

function initRasterHover() {
    if (tempoHoverBound || !map) return;

    const tooltip = document.getElementById("MapTooltip");
    if (!tooltip) return;

    map.on("mousemove", (e) => {

        if (window.isDrawActive?.()) {
            tooltip.style.display = "none";
            map.getCanvas().style.cursor = "";
            updateRasterHoverBox(null);
            if (tempoHoverBound) tempoHoverBound.isShowing = false;
            return;
        }

        // [UX Fix]: Dont interfere if the tooltip is locked by a click
        if (state?.tooltipLocked) return;

        // [UX Fix]: Yield tooltip to discrete point/event vector layers (AirNow, Smoke, Fire, etc.)
        const topFeatures = map.queryRenderedFeatures(e.point);
        const isPointVectorOnTop = topFeatures.some(f => {
            const s = f.source || "";
            return s === "smoke" || s === "fire" || s === "burn" ||
                s.includes("wildfire") || s === "MapPost" ||
                s.includes("airnow") || s.includes("gam_") ||
                s.includes("pm_cbsa") || s === "epa_ember";
        });

        if (isPointVectorOnTop) {
            updateRasterHoverBox(null);
            tempoHoverBound.isShowing = false;
            return;
        }

        const wrapped = e.lngLat.wrap();
        
        // [Z-Order Hierarchy]: If AirFuse is above raster in activeLayerStack, ONLY yield if mouse is ACTUALLY over an AirFuse polygon!
        if (getTopSpatialLayer(wrapped.lng, wrapped.lat)?.startsWith("airfuse-")) {
            const hasAirfuseUnderCursor = topFeatures.some(f => f.source?.includes("airfuse") || f.layer?.id.startsWith("airfuse-"));
            if (hasAirfuseUnderCursor) {
                updateRasterHoverBox(null);
                tempoHoverBound.isShowing = false;
                return;
            }
        }

        // Find visible raster layers in top-to-bottom order (filtering out closed/hidden layers)
        const visibleRasterStack = (activeLayerStack || [])
            .slice()
            .reverse()
            .filter(id => {
                if (!ExcludeLayerGroups.pngLayers.includes(id)) return false;
                if (closedLegendIds && closedLegendIds.has(id)) return false;
                const mapLayerId = `${id}-raster`;
                return map?.getLayer(mapLayerId) && map.getLayoutProperty(mapLayerId, "visibility") === "visible";
            });

        let activeInfo = null;
        for (const sourceId of visibleRasterStack) {
            const info = getRasterTooltipInfo(sourceId, wrapped.lng, wrapped.lat);
            if (info) {
                activeInfo = info;
                break;
            }
        }

        if (!activeInfo) {
            hideRasterTooltip();
            return;
        }

        updateRasterHoverBox(activeInfo);

        tooltip.innerHTML = activeInfo.html;
        tooltip.style.display = "block";
        map.getCanvas().style.cursor = "pointer";
        tempoHoverBound.isShowing = true;

        let x = e.originalEvent.clientX + 15;
        let y = e.originalEvent.clientY + 15;
        if (x + 250 > window.innerWidth) x = e.originalEvent.clientX - 260;
        if (y + 100 > window.innerHeight) y = e.originalEvent.clientY - 110;

        tooltip.style.left = `${x / 10}rem`;
        tooltip.style.top = `${y / 10}rem`;
    });

    function hideRasterTooltip() {
        updateRasterHoverBox(null);
        if (!tempoHoverBound.isShowing) return;
        tooltip.style.display = "none";
        map.getCanvas().style.cursor = "";
        tempoHoverBound.isShowing = false;
    }

    tempoHoverBound = { active: true, isShowing: false };
}

async function loadRasterData(isoDate, config, urlFn, labelType) {
    const timePicker = document.getElementById("timePicker");
    let utcIsoDate = isoDate;
    let utcHour = null;

    // Daily datasets (TROPOMI & VIIRS) dont use timePicker/UTC conversion
    const isHourly = labelType !== "TROPOMI" && labelType !== "VIIRS";
    
    if (isHourly) {
        if (!timePicker) return;
        const localHour = parseInt(timePicker.value);
        const [y, m, d] = isoDate.split("-").map(Number);
        const localDate = new Date(y, m - 1, d, localHour);
        utcHour = localDate.getUTCHours();
        utcIsoDate = `${localDate.getUTCFullYear()}-${String(localDate.getUTCMonth() + 1).padStart(2, "0")}-${String(localDate.getUTCDate()).padStart(2, "0")}`;
    }

    for (const [key, cfg] of Object.entries(config)) {
        const source = map?.getSource(cfg.sourceId);
        if (!source) continue;

        const cb = document.getElementById(cfg.layerId);
        
        // Check if the currently loaded date/hour matches the target date/hour
        const store = rasterDataStore[cfg.sourceId];
        const targetDate = isHourly ? utcIsoDate : isoDate;
        const isAlreadyLoaded = store && store.loadedDate === targetDate && store.loadedHour === utcHour && store.cleared === false;

        if (!cb || !cb.checked) {
            if (!isAlreadyLoaded || (store && store.cleared !== true)) {
                const dateChanged = !store || store.loadedDate !== targetDate || store.loadedHour !== utcHour;
                if (dateChanged) {
                    clearRasterSource(source, cfg.sourceId);
                }
            }
            continue;
        }

        // If checked and already loaded for the current date/hour, skip fetching and processing entirely!
        if (isAlreadyLoaded) {
            continue;
        }

        // Clear the previous source state before loading new data
        clearRasterSource(source, cfg.sourceId);

        // Determine dynamic product ID based on target date for geocolor-east and geocolor-west (cutoff 2026-04-08)
        let prodId = cfg.productId;
        if (cfg.sourceId === "goes-geocolor-east") {
            if (targetDate >= "2026-04-08") {
                prodId = "GOES-East_ABI_GeoColor";
            } else {
                prodId = "GOESEastCONUSGeoColor";
            }
        } else if (cfg.sourceId === "goes-geocolor-west") {
            if (targetDate >= "2026-04-08") {
                prodId = "GOES-West_ABI_GeoColor";
            } else {
                prodId = "GOESWestCONUSGeoColor";
            }
        }

        // TROPOMI uses daily URL, others use hourly URL
        const { jsonUrl: baseJson, pngUrl: basePng } = isHourly 
            ? urlFn(utcIsoDate, utcHour, prodId)
            : urlFn(isoDate, prodId);
            
        const buster = utils.getCacheBuster(isHourly ? utcIsoDate : isoDate);
        const jsonUrl = baseJson + buster;
        const pngUrl = basePng + buster;

        try {
            const metadata = await utils.fetchJson(jsonUrl, null);
            if (metadata) {
                let xmin, xmax, ymin, ymax;
                
                // Unified projection conversion: check if metadata has extent_file in Web Mercator
                if (metadata.extent_file) {
                    const [lonMin, latMin] = utils.mercatorToLngLat(metadata.extent_file[0], metadata.extent_file[2]);
                    const [lonMax, latMax] = utils.mercatorToLngLat(metadata.extent_file[1], metadata.extent_file[3]);
                    xmin = lonMin; xmax = lonMax; ymin = latMin; ymax = latMax;
                } else {
                    const ext = metadata.extent_raw || metadata.extent;
                    if (!ext) throw new Error("No extent");
                    xmin = ext[0]; xmax = ext[1]; ymin = ext[2]; ymax = ext[3];
                }

                const coordinates = [
                    [xmin, ymax], [xmax, ymax], [xmax, ymin], [xmin, ymin]
                ];
                
                if (!rasterDataStore[cfg.sourceId]) {
                    rasterDataStore[cfg.sourceId] = { grayscale: null, metadata: null, coordinates: null };
                }

                rasterDataStore[cfg.sourceId].coordinates = coordinates;
                rasterDataStore[cfg.sourceId].cleared = false;
                rasterDataStore[cfg.sourceId].pngUrl = pngUrl;
                rasterDataStore[cfg.sourceId].loadedDate = targetDate;
                rasterDataStore[cfg.sourceId].loadedHour = utcHour;

                const blobUrl = await fetchAuthenticatedImage(pngUrl, cfg.sourceId);
                await colorizeRasterImage(blobUrl, metadata, source, cfg.sourceId);

                logUserAction("view", {
                    dataset: cfg.sourceId,
                    layer: cfg.sourceId,
                    date: isoDate,
                    filename: pngUrl
                });

                initRasterHover();
                
                // Refresh locked highlight tooltip for this raster if active
                const h = state?.currentHighlight;
                if (h && h.dataSource === cfg.sourceId && state.tooltipLocked) {
                    const info = getRasterTooltipInfo(cfg.sourceId, h.coords[0], h.coords[1]);
                    const tooltip = document.getElementById("MapTooltip");
                    if (info && tooltip) {
                        tooltip.innerHTML = generatePopupHTML({ ...h, _rawHtml: info.html }, cfg.sourceId, true);
                        tooltip.style.display = "block";
                    } else {
                        utils.clearHighlight();
                    }
                }
            } else {
                throw new Error("No data");
            }
        } catch (e) {
            console.error(`${labelType} ${key} load error:`, e);
            if (rasterDataStore[cfg.sourceId]) rasterDataStore[cfg.sourceId].cleared = false;
            clearRasterSource(source, cfg.sourceId);
            
            // Clear highlight if this raster has no data for the new date/time
            if (state?.currentHighlight?.dataSource === cfg.sourceId) {
                utils.clearHighlight();
            }

            if (cb && cb.checked) {
                showLoaderError(cfg.sourceId, isoDate, isHourly);
            }
        }
    }
}

export async function tempoLoadData(isoDate) {
    return loadRasterData(isoDate, TEMPO_CONFIG, utils.urlPngTempo, "TEMPO");
}

export async function tropomiLoadData(isoDate) {
    return loadRasterData(isoDate, TROPOMI_CONFIG, utils.urlPngTropomi, "TROPOMI");
}

export async function hrrrLoadData(isoDate) {
    return loadRasterData(isoDate, HRRR_CONFIG, utils.urlPngHRRR, "HRRR");
}

export async function goesLoadData(isoDate) {
    return loadRasterData(isoDate, GOES_CONFIG, utils.urlPngGOES, "GOES");
}

export async function viirsLoadData(isoDate) {
    return loadRasterData(isoDate, VIIRS_CONFIG, utils.urlPngVIIRS, "VIIRS");
}

export async function geoscfLoadData(isoDate) {
    return loadRasterData(isoDate, GEOSCF_CONFIG, utils.urlPngGEOSCF, "GEOSCF");
}

