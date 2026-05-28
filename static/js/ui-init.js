
import "./ui-telemetry.js";
import { restoreUI, bindAccordionAutosave, bindDatasetAutosave, initStateShadingToggle, initNaShadingToggle } from "./ui-state.js";
import { initDateButtons } from "./ui-date.js";
import { initUIPulsingIcons } from "./layers-icon.js";
import { map } from "./map-init.js";
import { geolocate } from "./layers.js";
import { resetViewControl } from "./ui-reset.js";
import { initMapCapture } from "./map-capture.js";
import { initTimeButtons, initTimePicker } from "./ui-time.js";
import { initBtnTooltips } from "./ui-btn-tooltip.js";
import { initHysplit } from "./aws-hysplit.js";
import { initLoaderRuntime } from "./loader.js";
import { initMapAnimate } from "./map-animate.js";

const datePicker = document.getElementById("datePicker");

if (datePicker && !datePicker.value) {
  const d = new Date();
  d.setHours(d.getHours() - 2);
  
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const todayStr = `${yyyy}-${mm}-${dd}`;
  
  datePicker.value = todayStr;
  datePicker.dispatchEvent(new Event("change", { bubbles: true }));
}

// Initialize Map Controls
if (map) {
  if (geolocate) map.addControl(geolocate, "bottom-left");
  if (resetViewControl) map.addControl(new resetViewControl(), "bottom-left");
  map.addControl(new maplibregl.AttributionControl({ compact: false }), "bottom-right");
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 90, unit: "metric" }), "bottom-right");
}

restoreUI?.();
bindAccordionAutosave?.();
bindDatasetAutosave?.();
initDateButtons?.();
initUIPulsingIcons?.();
initTimeButtons?.();
initTimePicker?.();
initMapCapture?.();
initStateShadingToggle?.();
initNaShadingToggle?.();
initBtnTooltips?.();
initHysplit?.();
initLoaderRuntime?.();
initMapAnimate?.();

