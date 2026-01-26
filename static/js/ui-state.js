
import { setStateColorEnabled, stateColorEnabled } from "./layers-state.js";
import { updateStateColors } from "./layers-colors.js";

const KEY = "mapStateV1";
const S = sessionStorage;

try {
  const nav = performance.getEntriesByType("navigation")[0];
  const isReload = (nav?.type === "reload") || (performance.navigation?.type === 1);
  if (isReload) S.removeItem(KEY);
} catch (e) {
  // Ignore
}

export const read = () => {
  try {
    return JSON.parse(S.getItem(KEY) || "{}");
  } catch (e) {
    return {};
  }
};

export const write = (newState) => {
  S.setItem(KEY, JSON.stringify(newState || {}));
};

export const savePatch = (patch) => {
  const cur = read();
  write({ ...cur, ...patch });
};

export const restoreUI = () => {
  const s = read();

  // Date
  if (s.date) {
    const el = document.getElementById("datePicker");
    if (el) el.value = s.date;
  }

  // Layers
  document.querySelectorAll('input[type="checkbox"]').forEach(el => {
    const id = el.id || "";
    const key = id.replace(/^layer-/, "");
    if (s.layers && typeof s.layers[key] === "boolean") {
      el.checked = s.layers[key];
    }
  });

  // Accordion
  if (Array.isArray(s.accordion)) {
    document.querySelectorAll(".accordion details").forEach((el, idx) => {
      if (s.accordion[idx]) el.setAttribute("open", "");
      else el.removeAttribute("open");
    });
  }

  // State Color
  setStateColorEnabled(typeof s.stateColorEnabled === "boolean" ? s.stateColorEnabled : true);
};

export const restoreView = (map) => {
  const s = read();
  if (!map || !s.view) return;
  try {
    map.jumpTo({
      center: Array.isArray(s.view.center) ? s.view.center : map.getCenter(),
      zoom: Number.isFinite(s.view.zoom) ? s.view.zoom : map.getZoom(),
      bearing: Number.isFinite(s.view.bearing) ? s.view.bearing : map.getBearing(),
      pitch: Number.isFinite(s.view.pitch) ? s.view.pitch : map.getPitch()
    });
  } catch (e) {
    // Ignore
  }
};

export const bindViewAutosave = (map) => {
  if (!map) return;
  map.on("moveend", () => {
    const { lng, lat } = map.getCenter();
    savePatch({
      view: {
        center: [lng, lat],
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch()
      }
    });
  });
  ["zoomend", "rotateend", "pitchend"].forEach(ev => {
    map.on(ev, () => {
      const { lng, lat } = map.getCenter();
      savePatch({
        view: {
          center: [lng, lat],
          zoom: map.getZoom(),
          bearing: map.getBearing(),
          pitch: map.getPitch()
        }
      });
    });
  });
};

export const saveDate = (isoDate) => {
  if (typeof isoDate === "string" && isoDate.length >= 8) {
    savePatch({ date: isoDate });
  }
};

export const saveLayerFlag = (key, on) => {
  const s = read();
  const layers = { ...(s.layers || {}) };
  layers[key] = !!on;
  savePatch({ layers });
};

export const saveGlobalStateColor = (enabled) => {
  setStateColorEnabled(enabled);
  savePatch({ stateColorEnabled: !!enabled });
};

export const bindAccordionAutosave = () => {
  const detailsList = document.querySelectorAll(".accordion details");
  if (!detailsList.length) return;

  detailsList.forEach((el, idx) => {
    el.addEventListener("toggle", () => {
      const s = read();
      const acc = Array.isArray(s.accordion) ? [...s.accordion] : [];
      acc[idx] = !!el.open;
      savePatch({ accordion: acc });
    });
  });
};

export const clearAll = () => {
  try {
    S.removeItem(KEY);
  } catch (e) {
    // Ignore
  }
};

// Shared runtime state
export const state = {};

export const initStateColorToggle = () => {
  const btn = document.getElementById("MapBtnStateChoropleth");
  if (!btn) return;

  if (btn.type === "checkbox") {
    btn.checked = !!stateColorEnabled;
  } else if (!stateColorEnabled) {
    btn.classList.add("disabled");
  }

  const handler = () => {
    let nextEnabled;
    if (btn.type === "checkbox") {
      nextEnabled = btn.checked;
    } else {
      const currentlyEnabled = !btn.classList.contains("disabled");
      nextEnabled = !currentlyEnabled;
      if (nextEnabled) btn.classList.remove("disabled");
      else btn.classList.add("disabled");
    }

    saveGlobalStateColor(nextEnabled);
    updateStateColors?.();
  };

  btn.addEventListener(btn.type === "checkbox" ? "change" : "click", handler);
};

export const resetGlobalStateColor = () => {
  const btn = document.getElementById("MapBtnStateChoropleth");
  if (btn) {
    if (btn.type === "checkbox") btn.checked = true;
    else btn.classList.remove("disabled");
  }

  setStateColorEnabled(true);
  updateStateColors?.();
};

