
import { map } from "./map-init.js";
import { currentDate } from "./utils.js";

export function initMapCapture() {
    const btn = document.getElementById("MapBtnCapture");
    if (!btn) return;

    btn.addEventListener("click", async function () {
        if (!map) return;

        try {
            map.once("render", async function () {
                try {
                    // 1. Get map canvas
                    const mapCanvas = map.getCanvas();
                    const legendDiv = document.getElementById("MapLegend");

                    // Create a temporary canvas to combine everything
                    const combinedCanvas = document.createElement("canvas");
                    combinedCanvas.width = mapCanvas.width;
                    combinedCanvas.height = mapCanvas.height;
                    const ctx = combinedCanvas.getContext("2d");

                    // 2. Draw map
                    ctx.drawImage(mapCanvas, 0, 0);

                    // 3. Draw Legend if visible
                    if (legendDiv && window.getComputedStyle(legendDiv).display !== "none") {
                        if (typeof html2canvas !== "undefined") {
                            const scale = 2; // High resolution scale
                            const legendCanvas = await html2canvas(legendDiv, {
                                backgroundColor: null,
                                logging: false,
                                useCORS: true,
                                scale: scale
                            });

                            const padding = 20;
                            // Draw at logical size (divided by scale) to keep it high quality but correct dimensions
                            const drawWidth = legendCanvas.width / scale;
                            const drawHeight = legendCanvas.height / scale;

                            // Optional: If you want it even smaller in the capture, multiply by another factor (e.g., 0.8)
                            const shrinkFactor = 1;
                            ctx.drawImage(legendCanvas, padding, padding, drawWidth * shrinkFactor, drawHeight * shrinkFactor);
                        }
                    }

                    // 4. Download
                    const dataUrl = combinedCanvas.toDataURL("image/png");
                    const link = document.createElement("a");
                    link.download = `map_capture_${currentDate()}.png`;
                    link.href = dataUrl;
                    link.click();

                } catch (err) {
                    console.error("Map capture failed:", err);
                    alert("Failed to capture map. Please try again.");
                }
            });

            // Trigger a repaint so the render event fires
            map.triggerRepaint();

        } catch (err) {
            console.error("Map capture failed:", err);
        }
    });
}

