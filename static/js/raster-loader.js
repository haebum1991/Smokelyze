
/**
 * TEMPO NO2 Loader
 * Handles fetching JSON metadata, colorizing grayscale PNG on a canvas, 
 * and updating the MapLibre Canvas Source.
 */
import { map } from "./map-init.js";
import { BREAKS_TEMPO, PALETTE_TEMPO } from "./layers-constants.js";
import * as utils from "./utils.js";
import { showErrorToast } from "./loader-ui.js";
import { logUserAction } from "./fb-logging.js";
import { state } from "./ui-state.js";

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
    
/**
 * Stores raw pixel data and metadata for hover value sampling
 */
const tempoDataStore = {
    "tempo-no2": { grayscale: null, metadata: null, coordinates: null },
    "tempo-hcho": { grayscale: null, metadata: null, coordinates: null },
    "tropomi-no2": { grayscale: null, metadata: null, coordinates: null },
    "tropomi-hcho": { grayscale: null, metadata: null, coordinates: null }
};

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
    ] : [0, 0, 0];
}

/**
 * Colorizes a grayscale PNG based on metadata and a global value scale.
 */
function colorizeTempoImage(imgUrl, metadata, source, sourceId) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            try {
                const canvas = source.getCanvas();
                if (canvas.width !== img.width || canvas.height !== img.height) {
                    canvas.width = img.width;
                    canvas.height = img.height;
                }
                const ctx = canvas.getContext("2d", { willReadFrequently: true });
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
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
                const { extent_raw, extent, min_val, max_val } = metadata;
                const targetExtent = extent_raw || extent;
                const [xmin, xmax, ymin, ymax] = targetExtent;

                const mercYMin = latToMercY(ymin);
                const mercYMax = latToMercY(ymax);

                tempoDataStore[sourceId] = {
                    grayscale,
                    imgW,
                    imgH,
                    metadata,
                    xmin, xmax, ymin, ymax,
                    mercYMin, mercYMax,
                    mercYRange: mercYMax - mercYMin,
                    lngRange: xmax - xmin
                };

                const breaks = BREAKS_TEMPO;
                const colors = PALETTE_TEMPO.map(hexToRgb);

                const getTempoColor = (v) => {
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
                        const displayValue = realValue / 1e14;

                        const rgb = getTempoColor(displayValue);
                        rawData[i] = rgb[0];
                        rawData[i + 1] = rgb[1];
                        rawData[i + 2] = rgb[2];
                        rawData[i + 3] = 220;
                    }
                }

                ctx.putImageData(imageData, 0, 0);

                // Trigger redraw for canvas source
                if (source.play) source.play();
                if (source.pause) source.pause();

                resolve();
            } catch (err) {
                reject(err);
            }
        };
        img.onerror = () => reject(new Error("Image load failed"));
        img.src = imgUrl;
    });
}

function clearTempoSource(source, sourceId) {
    if (!source) return;
    
    // Skip if already cleared to prevent WebGL memory leak
    if (tempoDataStore[sourceId] && tempoDataStore[sourceId].cleared === true) {
        return;
    }

    try {
        const canvas = source.getCanvas();
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        source.setCoordinates([[-1, 1], [-0.9, 1], [-0.9, 0.9], [-1, 0.9]]);
        if (source.play) source.play();
        if (source.pause) source.pause();
        
        if (!tempoDataStore[sourceId]) {
            tempoDataStore[sourceId] = {};
        }
        tempoDataStore[sourceId].cleared = true;
        
    } catch (e) {
        console.warn("TEMPO clear failed:", e);
    }
}

/**
 * Resets all Raster sources (clears canvases and moves them out of view)
 */
export function clearAllRaster() {
    for (const cfg of [...Object.values(TEMPO_CONFIG), ...Object.values(TROPOMI_CONFIG)]) {
        const source = map?.getSource(cfg.sourceId);
        if (source) clearTempoSource(source, cfg.sourceId);
        tempoDataStore[cfg.sourceId] = { grayscale: null, metadata: null, coordinates: null, cleared: true };
    }
}

/**
 * Global mousemove handler for TEMPO layers
 */
let tempoHoverBound = false;
function initTempoHover() {
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
        
        // Find visible TEMPO or TROPOMI layers
        const activeTempoLayer = [...Object.values(TEMPO_CONFIG), ...Object.values(TROPOMI_CONFIG)].find(cfg => {
            if (!map.getLayer(cfg.mapLayerId)) return false;
            return map.getLayoutProperty(cfg.mapLayerId, "visibility") === "visible";
        });

        if (!activeTempoLayer) {
            if (!tempoHoverBound.isShowing) return;
            tooltip.style.display = "none";
            map.getCanvas().style.cursor = "";
            tempoHoverBound.isShowing = false;
            return;
        }

        const sourceId = activeTempoLayer.sourceId;
        const store = tempoDataStore[sourceId];
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
                    hideTempoTooltip();
                    return;
                }

                // Restoration logic: Map 0-255 back to [min_val, max_val]
                const { metadata } = store;
                const realValue = metadata.min_val + (gray / 255) * (metadata.max_val - metadata.min_val);
                const displayValue = realValue / 1e14; // unit: 10^14 molecules/cm2

                const isTempo = activeTempoLayer.productId.includes("TEMPO");
                const layerTitle = activeTempoLayer.productId.includes("NO2") ? 
                    (isTempo ? "TEMPO NO2VCD" : "TROPOMI NO2VCD") : 
                    (isTempo ? "TEMPO HCHOVCD" : "TROPOMI HCHOVCD");

                let metaHtml = "";
                if (isTempo) {
                    metaHtml = `
                        <div style="display: flex; flex-direction: column;">
                            <span>Timestamp: <b>${utils.ESML(metadata.datetime) || "NA"} UTC</b></span>
                            <span>Scan No.: <b>${utils.ESML(metadata.scan_nos) || "NA"}</b></span>
                            <span>Version: <b>${utils.ESML(metadata.version) || "NA"}</b></span>
                        </div>
                    `;
                }

                tooltip.innerHTML = `
                    <div>
                        <strong style="color: var(--card-shadow);">${layerTitle}</strong>
                    </div>
                    <div>
                        <div>Value: <b style="font-size: 1.6rem; color: var(--card-shadow);">${displayValue.toFixed(2)}</b> 
                        <span style="color: var(--text-main);">&times 10<sup>14</sup> molec. cm<sup>-2</sup></span></div>
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
                hideTempoTooltip();
            }
        } else {
            hideTempoTooltip();
        }
    });

    function hideTempoTooltip() {
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
        clearTempoSource(source, cfg.sourceId);

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
                
                if (!tempoDataStore[cfg.sourceId]) {
                    tempoDataStore[cfg.sourceId] = { grayscale: null, metadata: null, coordinates: null };
                }
                
                tempoDataStore[cfg.sourceId].coordinates = coordinates;
                tempoDataStore[cfg.sourceId].cleared = false;
                await colorizeTempoImage(pngUrl, metadata, source, cfg.sourceId);
                source.setCoordinates(coordinates);
                
                logUserAction("view", {
                    dataset: cfg.sourceId,
                    layer: cfg.sourceId,
                    date: isoDate,
                    filename: pngUrl
                });

                initTempoHover();
            } else {
                throw new Error("No data");
            }
        } catch (e) {
            console.error(`TEMPO ${key} load error:`, e);
            
            if (tempoDataStore[cfg.sourceId]) tempoDataStore[cfg.sourceId].cleared = false;
            clearTempoSource(source, cfg.sourceId);
            
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
        clearTempoSource(source, cfg.sourceId);

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
                
                if (!tempoDataStore[cfg.sourceId]) {
                    tempoDataStore[cfg.sourceId] = { grayscale: null, metadata: null, coordinates: null };
                }
                
                tempoDataStore[cfg.sourceId].coordinates = coordinates;
                tempoDataStore[cfg.sourceId].cleared = false;
                await colorizeTempoImage(pngUrl, metadata, source, cfg.sourceId);
                source.setCoordinates(coordinates);
                
                logUserAction("view", {
                    dataset: cfg.sourceId,
                    layer: cfg.sourceId,
                    date: isoDate,
                    filename: pngUrl
                });

                initTempoHover();
            } else {
                throw new Error("No data");
            }
        } catch (e) {
            console.error(`TROPOMI ${key} load error:`, e);
            if (tempoDataStore[cfg.sourceId]) tempoDataStore[cfg.sourceId].cleared = false;
            clearTempoSource(source, cfg.sourceId);
            
            // Alert user if no data
            if (cb && cb.checked) {
                const label = key.toUpperCase();
                showErrorToast(`No ${label} TROPOMI data available for this date.`, "error");
            }
        }
    }
}

