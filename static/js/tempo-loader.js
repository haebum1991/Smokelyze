
/**
 * TEMPO NO2 Loader
 * Handles fetching JSON metadata, colorizing grayscale PNG on a canvas, 
 * and updating the MapLibre Canvas Source.
 */
import { map } from "./map-init.js";
import { BREAKS_TEMPO, PALETTE_TEMPO } from "./layers-constants.js";

const TEMPO_CONFIG = {
    "no2": {
        productId: "TEMPO_NO2_L3",
        sourceId: "tempo-no2",
        layerId: "layer-tempo-no2"
    },
    "hcho": {
        productId: "TEMPO_HCHO_L3",
        sourceId: "tempo-hcho",
        layerId: "layer-tempo-hcho"
    }
};

function getTempoUrls(isoDate, hour, productId) {
    const [y, m, d] = isoDate.split("-");
    const formattedHour = String(hour).padStart(2, "0");
    const folder = `/tempo_date_png/${productId}/${y}/${m}/${d}`;
    const baseName = `${productId}_${isoDate}_${formattedHour}T`;

    return {
        jsonUrl: `${folder}/${baseName}.json`,
        pngUrl: `${folder}/${baseName}.png`
    };
}

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
function colorizeTempoImage(imgUrl, min_val, max_val, source) {
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
                const data = imageData.data;
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

                for (let i = 0; i < data.length; i += 4) {
                    const px = data[i];
                    if (px === 0) {
                        data[i + 3] = 0;
                    } else {
                        // Restoration logic: Map 0-255 back to [min_val, max_val]
                        const realValue = min_val + (px / 255) * (max_val - min_val);
                        const displayValue = realValue / 1e14; // Convert to 10^14 molecules/cm2 unit

                        if (realValue < minRec) minRec = realValue;
                        if (realValue > maxRec) maxRec = realValue;

                        const rgb = getTempoColor(displayValue);
                        data[i] = rgb[0];
                        data[i + 1] = rgb[1];
                        data[i + 2] = rgb[2];
                        data[i + 3] = 220;
                    }
                }
                console.log(`TEMPO Colorize: px_range=[0-255], val_range=[${min_val.toFixed(2)}-${max_val.toFixed(2)}], calc_range=[${minRec.toFixed(2)}-${maxRec.toFixed(2)}]`);

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

function clearTempoSource(source) {
    if (!source) return;
    try {
        const canvas = source.getCanvas();
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        source.setCoordinates([[-1, 1], [-0.9, 1], [-0.9, 0.9], [-1, 0.9]]);
        if (source.play) source.play();
        if (source.pause) source.pause();
    } catch (e) {
        console.warn("TEMPO clear failed:", e);
    }
}

/**
 * Resets all TEMPO sources (clears canvases and moves them out of view)
 */
export function clearAllTempo() {
    for (const cfg of Object.values(TEMPO_CONFIG)) {
        const source = map?.getSource(cfg.sourceId);
        if (source) clearTempoSource(source);
    }
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
        clearTempoSource(source);

        if (!cb || !cb.checked) {
            continue;
        }

        const { jsonUrl, pngUrl } = getTempoUrls(utcIsoDate, utcHour, cfg.productId);

        try {
            const res = await fetch(jsonUrl);
            if (!res.ok) {
                clearTempoSource(source);
                continue;
            }

            const metadata = await res.json();
            const targetExtent = metadata.extent_raw || metadata.extent;

            if (metadata && targetExtent) {
                const [xmin, xmax, ymin, ymax] = targetExtent;
                const coordinates = [
                    [xmin, ymax], [xmax, ymax], [xmax, ymin], [xmin, ymin]
                ];

                await colorizeTempoImage(pngUrl, metadata.min_val, metadata.max_val, source);
                source.setCoordinates(coordinates);
            } else {
                console.warn(`TEMPO ${key}: Invalid extent in metadata`, metadata?.extent);
                clearTempoSource(source);
            }
        } catch (e) {
            console.error(`TEMPO ${key} load error:`, e);
            clearTempoSource(source);
        }
    }
}

