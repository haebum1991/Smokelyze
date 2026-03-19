
import { map } from "./map-init.js";
import { currentDate } from "./utils.js";
import { toggleSpinner } from "./loader-ui.js";

export function initMapCapture() {
    const btn = document.getElementById("MapBtnCapture");
    if (!btn) return;

    btn.addEventListener("click", async function () {
        if (!map) return;

        // 0. Darken the background and show the spinner IMMEDIATELY
        let captureBackdrop = document.getElementById("MapCaptureBackdrop");
        if (!captureBackdrop) {
            captureBackdrop = document.createElement("div");
            captureBackdrop.id = "MapCaptureBackdrop";
            Object.assign(captureBackdrop.style, {
                position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
                background: "rgba(0,0,0,0.65)", display: "none", zIndex: "9998", pointerEvents: "all"
            });
            document.body.appendChild(captureBackdrop);
        }
        captureBackdrop.style.display = "block";
        toggleSpinner(true); // Locks interaction and shows spinner

        // FORCE A TINY DELAY to let the DOM update (show spinner) before heavy MapLibre/Canvas logic starts
        await new Promise(resolve => setTimeout(resolve, 50));

        try {
            // Trigger a repaint so the render event fires
            map.triggerRepaint();

            map.once("render", async function () {
                try {
                    // 1. Get map canvas
                    const mapCanvas = map.getCanvas();
                    const legendDiv = document.getElementById("LegendDrawer");

                    // Create a temporary canvas to combine everything
                    const combinedCanvas = document.createElement("canvas");
                    combinedCanvas.width = mapCanvas.width;
                    combinedCanvas.height = mapCanvas.height;
                    const ctx = combinedCanvas.getContext("2d");

                    // 2. Draw map
                    ctx.drawImage(mapCanvas, 0, 0);

                    // 3. Capture all UI Overlays exactly at their screen coordinates
                    if (typeof html2canvas !== "undefined") {
                        const captureDOM = async (elements) => {
                            const mapRect = map.getContainer().getBoundingClientRect();
                            for (const el of elements) {
                                if (!el) continue;
                                const style = window.getComputedStyle(el);
                                if (style.display === "none" || style.opacity === "0" || style.visibility === "hidden") continue;

                                if (el.id === "LegendDrawer" && !el.classList.contains("open")) continue;

                                try {
                                    const scale = 2; // High resolution scale for crisp text
                                    const elCanvas = await html2canvas(el, { backgroundColor: null, logging: false, useCORS: true, scale });
                                    const rect = el.getBoundingClientRect();

                                    // Calculate exact position mapped onto the image canvas
                                    const x = rect.left - mapRect.left;
                                    const y = rect.top - mapRect.top;

                                    ctx.drawImage(elCanvas, x, y, elCanvas.width / scale, elCanvas.height / scale);
                                } catch (e) {
                                    console.warn("Failed to capture overlay element:", e);
                                }
                            }
                        };

                        // The EXACT elements requested to be captured with their true screen positions
                        const overlays = [
                            document.querySelector(".toolbar-date"),       // Date picker toolbar
                            document.getElementById("LegendDrawer"),       // Legend
                            ...Array.from(document.querySelectorAll(".mapboxgl-marker, .maplibregl-marker")), // highlightLocation point
                            document.getElementById("MapTooltip")          // Tooltip
                        ].filter(Boolean);

                        await captureDOM(overlays);
                    }
                    // 5. BOTTOM-LEFT BRANDING (Blur-glass Effect)
                    // Flush with the edges as requested (no margin)
                    const brandTitle = "Smokelyze";
                    const brandSub = "Advanced Spatiotemporal Analytics for Wildfire Smoke & Air Quality";

                    ctx.textAlign = "left";
                    ctx.textBaseline = "bottom";

                    // Box dimensions calculation
                    ctx.font = "bold 20px sans-serif";
                    const titleW = ctx.measureText(brandTitle).width;
                    ctx.font = "12px sans-serif";
                    const subW = ctx.measureText(brandSub).width;
                    const maxW = Math.max(titleW, subW);
                    const boxH = 50;
                    const boxW = maxW + 20;

                    // --- Frosted Glass Blur Effect Implementation ---
                    // 1. Save the state
                    ctx.save();
                    // 2. Define the clipping region for the blur
                    ctx.beginPath();
                    ctx.rect(0, combinedCanvas.height - boxH, boxW, boxH);
                    ctx.clip();
                    // 3. Draw the map again but blurred inside the clip
                    ctx.filter = "blur(10px)";
                    ctx.drawImage(combinedCanvas, 0, 0);
                    // 4. Add a very subtle light tint (glass look)
                    ctx.filter = "none";
                    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
                    ctx.fillRect(0, combinedCanvas.height - boxH, boxW, boxH);
                    // 5. Restore
                    ctx.restore();

                    // --- Draw White Text for Contrast (Sharp & Tight Shadow) ---
                    // Draw Subtitle
                    ctx.font = "12px sans-serif";
                    ctx.fillStyle = "white"; 
                    ctx.shadowColor = "rgba(0,0,0,1)";
                    ctx.shadowBlur = 2; // Sharp and defined
                    ctx.fillText(brandSub, 10, combinedCanvas.height - 8);
                    
                    // Draw Title (Smokelyze)
                    ctx.font = "bold 22px sans-serif";
                    ctx.shadowBlur = 3; 
                    ctx.fillText(brandTitle, 10, combinedCanvas.height - 25);
                    ctx.shadowBlur = 0; // Reset shadow

                    // 6. BOTTOM-RIGHT LICENSE (Blur-glass Effect)
                    ctx.font = "12px sans-serif";
                    const licenseText = "Map data © OpenStreetMap contributors";
                    const licW = ctx.measureText(licenseText).width;
                    const licBoxW = licW + 16;
                    const licBoxH = 24;

                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(combinedCanvas.width - licBoxW, combinedCanvas.height - licBoxH, licBoxW, licBoxH);
                    ctx.clip();
                    ctx.filter = "blur(10px)";
                    ctx.drawImage(combinedCanvas, 0, 0);
                    ctx.filter = "none";
                    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
                    ctx.fillRect(combinedCanvas.width - licBoxW, combinedCanvas.height - licBoxH, licBoxW, licBoxH);
                    ctx.restore();

                    ctx.fillStyle = "white";
                    ctx.textAlign = "right";
                    ctx.textBaseline = "middle";
                    ctx.shadowColor = "rgba(0,0,0,0.8)";
                    ctx.shadowBlur = 6;
                    ctx.fillText(licenseText, combinedCanvas.width - 8, combinedCanvas.height - 12);
                    ctx.shadowBlur = 0;

                    // 4. Download
                    const dataUrl = combinedCanvas.toDataURL("image/png");
                    const link = document.createElement("a");
                    link.download = `map_capture_${currentDate()}.png`;
                    link.href = dataUrl;
                    link.click();

                    if (captureBackdrop) captureBackdrop.style.display = "none";
                    toggleSpinner(false);

                } catch (err) {
                    console.error("Map capture failed:", err);
                    alert("Failed to capture map. Please try again.");
                    if (captureBackdrop) captureBackdrop.style.display = "none";
                    toggleSpinner(false);
                }
            });

            // Trigger a repaint so the render event fires
            map.triggerRepaint();

        } catch (err) {
            console.error("Map capture failed:", err);
            const captureBackdrop = document.getElementById("MapCaptureBackdrop");
            if (captureBackdrop) captureBackdrop.style.display = "none";
            toggleSpinner(false);
        }
    });
}

