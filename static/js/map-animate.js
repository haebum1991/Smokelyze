
import { auth } from "./fb-init.js";
import { map } from "./map-init.js";
import { currentDate, showAuthOverlay } from "./utils.js";
import { toggleSpinner } from "./loader-ui.js";
import { getMapCaptureDataUrl } from "./map-capture.js";
import { logUserAction } from "./fb-logging.js";

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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
            // Navigate to Start Date
            if (mapDatePicker && mapDatePicker.value !== startDateInput.value) {
                mapDatePicker.value = startDateInput.value;
                mapDatePicker.dispatchEvent(new Event("change", { bubbles: true }));
            }
            if (stepType === "h") {
                if (mapTimePicker && mapTimePicker.value !== startTimeInput.value) {
                    mapTimePicker.value = startTimeInput.value;
                    mapTimePicker.dispatchEvent(new Event("change", { bubbles: true }));
                }
            }

            // Wait heavily for the initial jump
            if (mapLoadingText) mapLoadingText.innerText = "Loading starting frame...";
            await sleep(3500);

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
                if (mapLoadingText) mapLoadingText.innerText = `Capturing Frame ${i + 1} of ${numSteps}...`;

                await sleep(1500);

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
                    await sleep(1000);
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

