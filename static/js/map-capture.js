
import { auth } from "./fb-init.js";
import { map } from "./map-init.js";
import { currentDate, showAuthOverlay } from "./utils.js";
import { toggleSpinner } from "./loader-ui.js";
import { logUserAction } from "./fb-logging.js";

/**
 * Shared capture process for both manual download and AI analysis
 * Returns the final combined canvas with all original styling
 */
async function captureMapProcess(options = {}) {
    if (!map) return null;

    return new Promise((resolve, reject) => {
        try {
            map.triggerRepaint();
            map.once("render", async function () {
                try {
                    const mapCanvas = map.getCanvas();
                    const combinedCanvas = document.createElement("canvas");
                    combinedCanvas.width = mapCanvas.width;
                    combinedCanvas.height = mapCanvas.height;
                    const ctx = combinedCanvas.getContext("2d");

                    // 1. Draw Map
                    ctx.drawImage(mapCanvas, 0, 0);

                    // 2. Draw Overlays (Date, Legend, Markers, Tooltip)
                    if (typeof html2canvas !== "undefined") {
                        const mapRect = map.getContainer().getBoundingClientRect();
                        const overlays = [
                            document.querySelector(".toolbar-date"),
                            document.getElementById("LegendDrawer"),
                            ...Array.from(document.querySelectorAll(".mapboxgl-marker, .maplibregl-marker")),
                            options.excludeTooltip ? null : document.getElementById("MapTooltip")
                        ].filter(Boolean);

                        for (const el of overlays) {
                            const style = window.getComputedStyle(el);
                            if (style.display === "none" || style.opacity === "0" || style.visibility === "hidden") continue;
                            if (el.id === "LegendDrawer" && !el.classList.contains("open")) continue;

                            try {
                                const scale = 2; 
                                const elCanvas = await html2canvas(el, { 
                                    backgroundColor: null, 
                                    logging: false, 
                                    useCORS: true, 
                                    scale,
                                    onclone: (clonedDoc) => {
                                        clonedDoc.querySelectorAll(".legend-opacity-slider").forEach(slider => {
                                            slider.style.setProperty("display", "none", "important");
                                        });
                                        clonedDoc.querySelectorAll(".legend-opacity-static-bar").forEach(bar => {
                                            bar.style.setProperty("display", "block", "important");
                                        });
                                    }
                                });
                                const rect = el.getBoundingClientRect();
                                ctx.drawImage(elCanvas, rect.left - mapRect.left, rect.top - mapRect.top, elCanvas.width / scale, elCanvas.height / scale);
                            } catch (e) {
                                console.warn("Skipping overlay element capture:", e);
                            }
                        }
                    }

                    // 3. Original Branding & License Styling (1:1 Restoration)
                    drawBrandingAndLicense(ctx, combinedCanvas);

                    resolve(combinedCanvas);
                } catch (err) {
                    reject(err);
                }
            });
            map.triggerRepaint();
        } catch (err) {
            reject(err);
        }
    });
}

function drawBrandingAndLicense(ctx, canvas) {
    const brandTitle = "Smokelyze";
    const brandSub = "Advanced Spatiotemporal Analytics for Wildfire Smoke & Air Quality";
    const licenseText = "Map data © OpenStreetMap contributors";

    // --- BOTTOM-LEFT BRANDING (Original Glass Style) ---
    ctx.save();
    ctx.font = "bold 2rem sans-serif";
    const titleW = ctx.measureText(brandTitle).width;
    ctx.font = "1.2rem sans-serif";
    const subW = ctx.measureText(brandSub).width;
    const maxW = Math.max(titleW, subW);
    const boxH = 50;
    const boxW = maxW + 20;

    ctx.beginPath();
    ctx.rect(0, canvas.height - boxH, boxW, boxH);
    ctx.clip();
    ctx.filter = "blur(1rem)";
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = "none";
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.fillRect(0, canvas.height - boxH, boxW, boxH);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = "white"; 
    ctx.shadowColor = "rgba(0,0,0,1)";
    ctx.shadowBlur = 2;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.font = "1.2rem sans-serif";
    ctx.fillText(brandSub, 10, canvas.height - 8);
    ctx.font = "bold 2.2rem sans-serif";
    ctx.shadowBlur = 3; 
    ctx.fillText(brandTitle, 10, canvas.height - 25);
    ctx.restore();

    // --- BOTTOM-RIGHT LICENSE (Original Glass Style) ---
    ctx.save();
    ctx.font = "1.2rem sans-serif";
    const licW = ctx.measureText(licenseText).width;
    const licBoxW = licW + 16;
    const licBoxH = 24;

    ctx.beginPath();
    ctx.rect(canvas.width - licBoxW, canvas.height - licBoxH, licBoxW, licBoxH);
    ctx.clip();
    ctx.filter = "blur(1rem)";
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = "none";
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.fillRect(canvas.width - licBoxW, canvas.height - licBoxH, licBoxW, licBoxH);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = "white";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 6;
    ctx.font = "1.2rem sans-serif";
    ctx.fillText(licenseText, canvas.width - 8, canvas.height - 12);
    ctx.restore();
}

export async function getMapCaptureDataUrl(options = {}) {
    try {
        const canvas = await captureMapProcess(options);
        return canvas ? canvas.toDataURL("image/png") : null;
    } catch (e) {
        console.error("AI Capture Error:", e);
        return null;
    }
}

export function initMapCapture() {
    const btn = document.getElementById("MapBtnCapture");
    if (!btn) return;

    btn.addEventListener("click", async function () {
        
        if (!auth.currentUser) {
            showAuthOverlay();
            return;
        }
        
        let backdrop = document.getElementById("MapCaptureBackdrop");
        if (!backdrop) {
            backdrop = document.createElement("div");
            backdrop.id = "MapCaptureBackdrop";
            Object.assign(backdrop.style, {
                position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
                background: "rgba(0,0,0,0.65)", display: "none", zIndex: "9998"
            });
            document.body.appendChild(backdrop);
        }
        backdrop.style.display = "block";
        toggleSpinner(true);

        try {
            const canvas = await captureMapProcess();
            if (canvas) {
                const dataUrl = canvas.toDataURL("image/png");
                const link = document.createElement("a");
                link.download = `map_capture_${currentDate()}.png`;
                link.href = dataUrl;
                link.click();
                
                logUserAction("download", { 
                    dataset: "map_capture", 
                    filename: `map_capture_${currentDate()}.png` 
                });
            }
        } catch (err) {
            console.error("Capture Error:", err);
            alert("Failed to capture map.");
        } finally {
            backdrop.style.display = "none";
            toggleSpinner(false);
        }
    });
}

