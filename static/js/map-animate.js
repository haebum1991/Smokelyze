
import { auth } from "./fb-init.js";
import { map } from "./map-init.js";
import { currentDate, showAuthOverlay } from "./utils.js";
import { toggleSpinner } from "./loader-ui.js";
import { getMapCaptureDataUrl } from "./map-capture.js";
import { logUserAction } from "./fb-logging.js";

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Wait for the map to reach "idle" state (all sources loaded, all tiles rendered).
 * Falls back after maxWaitMs to prevent infinite hangs (e.g. if tab is hidden
 * and rAF is paused, "idle" will never fire until the tab is visible again).
 */
function waitForMapIdle(maxWaitMs = 15000) {
    return new Promise(resolve => {
        let settled = false;
        const done = () => {
            if (settled) return;
            settled = true;
            map.off("idle", done);
            resolve();
        };
        map.on("idle", done);
        setTimeout(done, maxWaitMs);
    });
}

/**
 * Wait for loader-handler.js to signal that ALL data loading is complete.
 * This covers GeoJSON sources, Canvas Sources (TEMPO), and raster layers —
 * unlike waitForMapIdle() which only tracks MapLibre internal tile state.
 * Safety timeout prevents infinite hangs if the event never fires.
 */
function waitForDataLoaded(maxWaitMs = 20000) {
    return new Promise(resolve => {
        let settled = false;
        const done = () => {
            if (settled) return;
            settled = true;
            window.removeEventListener("map-data-loaded", done);
            resolve();
        };
        window.addEventListener("map-data-loaded", done);
        setTimeout(done, maxWaitMs);
    });
}

/**
 * Ensure the tab is visible before proceeding.
 * If the tab is hidden, pause here until the user comes back.
 * This prevents capturing stale/unrendered frames in the background.
 */
function waitForTabVisible() {
    if (document.visibilityState === "visible") return Promise.resolve();
    return new Promise(resolve => {
        const handler = () => {
            if (document.visibilityState === "visible") {
                document.removeEventListener("visibilitychange", handler);
                resolve();
            }
        };
        document.addEventListener("visibilitychange", handler);
    });
}

function getGifWorkerUrl() {
    const workerStr = `importScripts("https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js");`;
    const workerBlob = new Blob([workerStr], { type: "application/javascript" });
    return URL.createObjectURL(workerBlob);
}

export function initMapAnimate() {
    const btnOpener = document.getElementById("MapBtnAnimate");
    const modal = document.getElementById("TimelapseModalOverlay");
    const btnSubmit = document.getElementById("TimelapseBtnSubmit");
    const btnCancel = document.getElementById("TimelapseBtnCancel");
    const btnClose = document.getElementById("TimelapseModalClose");

    const startDateInput = document.getElementById("TimelapseStartDate");
    const startTimeInput = document.getElementById("TimelapseStartTime");
    const endDateInput = document.getElementById("TimelapseEndDate");
    const endTimeInput = document.getElementById("TimelapseEndTime");

    // UI elements driving the map
    const mapDatePicker = document.getElementById("datePicker");
    const mapTimePicker = document.getElementById("timePicker");

    if (!btnOpener || !modal || !btnSubmit) return;

    // Toggle time pickers visibility based on Daily vs Hourly
    const timeScaleRadios = document.querySelectorAll('input[name="TimelapseScale"]');
    const updateTimePickerVisibility = () => {
        const selected = document.querySelector('input[name="TimelapseScale"]:checked');
        const isDaily = selected && selected.value === "d";
        if (startTimeInput) startTimeInput.style.display = isDaily ? "none" : "block";
        if (endTimeInput) endTimeInput.style.display = isDaily ? "none" : "block";
    };

    const updateDefaultEndDate = () => {
        const selected = document.querySelector('input[name="TimelapseScale"]:checked');
        const isDaily = selected && selected.value === "d";
        
        let startYMD = startDateInput.value;
        if (!startYMD) startYMD = currentDate() || new Date().toISOString().split("T")[0];
        
        let startHH = startTimeInput.value;
        if (!startHH) startHH = "00";
        
        const dt = new Date(`${startYMD}T${startHH}:00:00`);
        
        if (isDaily) {
            dt.setDate(dt.getDate() + 7);
        } else {
            dt.setHours(dt.getHours() + 6);
        }
        
        // Format back to local representations safely
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, "0");
        const d = String(dt.getDate()).padStart(2, "0");
        const h = String(dt.getHours()).padStart(2, "0");
        
        if (endDateInput) endDateInput.value = `${y}-${m}-${d}`;
        if (endTimeInput) endTimeInput.value = h;
    };

    timeScaleRadios.forEach(radio => {
        radio.addEventListener("change", () => {
            updateTimePickerVisibility();
            updateDefaultEndDate();
        });
    });

    btnOpener.addEventListener("click", () => {

        if (!auth.currentUser) {
            showAuthOverlay();
            return;
        }
        
        if (!window.GIF) {
            alert("GIF library not loaded.");
            return;
        }

        // Initialize modal start date with current map state
        if (mapDatePicker && mapDatePicker.value) {
            startDateInput.value = mapDatePicker.value;
        } else {
            startDateInput.value = currentDate() || new Date().toISOString().split("T")[0];
        }

        if (mapTimePicker && mapTimePicker.value) {
            startTimeInput.value = mapTimePicker.value;
        } else {
            startTimeInput.value = "00";
        }

        updateTimePickerVisibility();
        updateDefaultEndDate();
        modal.style.display = "flex";
    });

    const closeModal = () => {
        modal.style.display = "none";
    };

    btnCancel.addEventListener("click", closeModal);
    btnClose.addEventListener("click", closeModal);

    btnSubmit.addEventListener("click", async function () {
        // Check if at least one data layer is active
        const checkedLayers = document.querySelectorAll("input[type=checkbox][id^='layer-']:checked");
        if (!checkedLayers || checkedLayers.length === 0) {
            alert("At least one data layer must be selected on the map to use this feature.");
            return;
        }

        const stepTypeRadio = document.querySelector('input[name="TimelapseScale"]:checked');
        const speedInput = document.getElementById("TimelapseFormSpeed");

        const stepType = stepTypeRadio ? stepTypeRadio.value : "h";
        const frameDelayMs = speedInput ? parseInt(speedInput.value) || 500 : 500;

        let startDt, endDt;

        if (stepType === "h") {
            startDt = new Date(`${startDateInput.value}T${startTimeInput.value}:00:00`);
            endDt = new Date(`${endDateInput.value}T${endTimeInput.value}:00:00`);
        } else {
            startDt = new Date(`${startDateInput.value}T12:00:00`);
            endDt = new Date(`${endDateInput.value}T12:00:00`);
        }

        if (isNaN(startDt) || isNaN(endDt)) {
            alert("Please provide valid Start and End dates.");
            return;
        }

        if (startDt > endDt) {
            alert("Start Date/Time cannot be after End Date/Time.");
            return;
        }

        // Calculate num steps and validate max limits
        const diffMs = endDt - startDt;
        let numSteps;

        if (stepType === "h") {
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            numSteps = diffHours + 1;
            if (numSteps > 24) {
                alert("Please limit Hourly time-lapse to a maximum of 24 frames (e.g. 00:00 to 23:00).");
                return;
            }
        } else {
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            numSteps = diffDays + 1;
            if (numSteps > 31) {
                alert("Please limit Daily time-lapse to a maximum of 31 frames.");
                return;
            }
        }

        const btnNextId = stepType === "h" ? "onMapPlus1h" : "onMapPlus1d";
        const btnNext = document.getElementById(btnNextId);

        if (!btnNext) {
            alert(`Cannot find the next button for "${stepType}". Ensure controls are visible.`);
            return;
        }

        closeModal();

        // Unified UI Feedback
        const mapLoadingText = document.getElementById("MapLoadingText");
        const mapLoadingOverlay = document.getElementById("MapLoadingOverlay");

        let isCancelled = false;
        const cancelBtn = document.createElement("button");
        cancelBtn.innerText = "Cancel Animation";
        cancelBtn.style.marginTop = "2rem";
        cancelBtn.style.padding = "0.8rem 1.6rem";
        cancelBtn.style.background = "var(--btn-minus)";
        cancelBtn.style.color = "white";
        cancelBtn.style.border = "none";
        cancelBtn.style.borderRadius = "0.8rem";
        cancelBtn.style.fontWeight = "bold";
        cancelBtn.style.cursor = "pointer";
        cancelBtn.style.fontSize = "1.4rem";
        cancelBtn.onclick = () => {
            isCancelled = true;
            cancelBtn.innerText = "Canceling...";
            cancelBtn.disabled = true;
            cancelBtn.style.opacity = "0.5";
            cancelBtn.style.cursor = "not-allowed";
        };

        if (mapLoadingOverlay) {
            mapLoadingOverlay.classList.add("is-dimmed");
            mapLoadingOverlay.style.display = "flex";
            mapLoadingOverlay.style.flexDirection = "column";
            mapLoadingOverlay.style.alignItems = "center";
            mapLoadingOverlay.appendChild(cancelBtn);
        }

        toggleSpinner(true);

        const cleanup = () => {
            cancelBtn.remove();
            if (mapLoadingOverlay) mapLoadingOverlay.classList.remove("is-dimmed");
            if (mapLoadingText) mapLoadingText.innerText = "";
            toggleSpinner(false);
        };

        try {
            
            // Navigate to Start Date (only triggers data reload if date/time differs)
            let dateChanged = false;
            if (mapDatePicker && mapDatePicker.value !== startDateInput.value) {
                mapDatePicker.value = startDateInput.value;
                mapDatePicker.dispatchEvent(new Event("change", { bubbles: true }));
                dateChanged = true;
            }
            if (stepType === "h") {
                if (mapTimePicker && mapTimePicker.value !== startTimeInput.value) {
                    mapTimePicker.value = startTimeInput.value;
                    mapTimePicker.dispatchEvent(new Event("change", { bubbles: true }));
                    dateChanged = true;
                }
            }

            // Only wait for debounce + idle if we actually changed the date/time.
            // If already on the correct date, the map is already loaded — skip.
            if (dateChanged) {
                if (mapLoadingText) mapLoadingText.innerText = "Loading starting frame...";
                await waitForDataLoaded();
                await waitForMapIdle();
            }

            if (isCancelled) throw new Error("Cancelled_by_user");

            const gif = new GIF({
                workers: 2,
                quality: 10,
                width: map.getCanvas().width,
                height: map.getCanvas().height,
                workerScript: getGifWorkerUrl()
            });

            // Capture loop
            for (let i = 0; i < numSteps; i++) {
                if (isCancelled) throw new Error("Cancelled_by_user");

                // If the user switched away, pause until they come back.
                // Capturing in a hidden tab produces stale/blank frames because
                // the browser pauses requestAnimationFrame (MapLibre rendering).
                await waitForTabVisible();

                // After returning from a hidden tab, MapLibre render loop (rAF)
                // needs to catch up. Trigger a repaint and wait for idle to ensure
                // all pending data is actually rendered to the canvas.
                map.triggerRepaint();
                await waitForMapIdle();

                if (mapLoadingText) mapLoadingText.innerHTML = `Capturing Frame ${i + 1} of ${numSteps}...<br><span>Please keep this page open and visible.</span>`;

                if (isCancelled) throw new Error("Cancelled_by_user");

                const dataUrl = await getMapCaptureDataUrl({ excludeTooltip: true });
                if (dataUrl) {
                    const img = new Image();
                    img.src = dataUrl;
                    await new Promise(r => { img.onload = r; });
                    gif.addFrame(img, { delay: frameDelayMs });
                }

                // Click next step (except last frame)
                if (i < numSteps - 1) {
                    btnNext.click();
                    // Wait for loader-handler.js to finish ALL data loading
                    // (debounce + fetch + render for GeoJSON, Canvas, raster)
                    await waitForDataLoaded();
                    await waitForMapIdle();
                }
            }

            if (isCancelled) throw new Error("Cancelled_by_user");

            if (mapLoadingText) mapLoadingText.innerText = "Encoding GIF... Please wait.";

            gif.on("finished", function (blob) {
                if (isCancelled) return;
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.download = `smokelyze_timelapse_${startDateInput.value}_to_${endDateInput.value}.gif`;
                link.href = url;
                link.click();
                
                logUserAction("download", { 
                    dataset: "map_animate", 
                    date: startDateInput.value,
                    key_date_end: endDateInput.value,
                    filename: `smokelyze_timelapse_${startDateInput.value}_to_${endDateInput.value}.gif`
                });
                
                cleanup();
            });

            if (isCancelled) throw new Error("Cancelled_by_user");
            gif.render();

        } catch (err) {
            if (err.message === "Cancelled_by_user") {
                console.log("Timelapse generation cancelled by user.");
            } else {
                console.error("Animation Error:", err);
                alert("Failed to create time-lapse animation.");
            }
            cleanup();
        }
    });
}

