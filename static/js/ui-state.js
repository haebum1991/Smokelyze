
import { setStateColorEnabled, stateColorEnabled } from "./layers-state.js";
import { updateStateColors } from "./layers-colors.js";

const KEY = "mapStateV1";
const S = sessionStorage;

try {
  const nav = performance.getEntriesByType("navigation")[0];
  const isReload =
    (nav && nav.type === "reload") ||
    (performance.navigation && performance.navigation.type === 1);
  if (isReload) S.removeItem(KEY);
} catch (e) { }

export function read() {
  try { return JSON.parse(S.getItem(KEY) || "{}"); }
  catch (e) { return {}; }
}

export function write(newState) {
  S.setItem(KEY, JSON.stringify(newState || {}));
}

export function savePatch(patch) {
  const cur = read();
  write(Object.assign({}, cur, patch));
}

export function restoreUI() {
  const s = read();

  // 날짜
  if (s.date) {
    const el = document.getElementById("datePicker");
    if (el) el.value = s.date;
  }

  // 체크박스
  document.querySelectorAll('input[type="checkbox"]').forEach(el => {
    const id = el.id || "";
    const key = id.replace(/^layer-/, ""); // id가 layer- 형태면 key 추출
    if (s.layers && typeof s.layers[key] === "boolean") {
      el.checked = s.layers[key];
    }
  });

  // 아코디언(open 상태) 복원
  if (Array.isArray(s.accordion)) {
    document.querySelectorAll(".accordion details").forEach((el, idx) => {
      const v = s.accordion[idx];
      if (v) {
        el.setAttribute("open", "");
      } else {
        el.removeAttribute("open");
      }
    });
  }
  
  // State Color 활성화 여부 복원
  if (typeof s.stateColorEnabled === "boolean") {
    setStateColorEnabled(s.stateColorEnabled);
  } else {
    setStateColorEnabled(true); // 기본값
  }
}

// 맵 뷰 복원
export function restoreView(map) {
  const s = read();
  if (!map || !s.view) return;
  try {
    map.jumpTo({
      center: Array.isArray(s.view.center) ? s.view.center : map.getCenter(),
      zoom: Number.isFinite(s.view.zoom) ? s.view.zoom : map.getZoom(),
      bearing: Number.isFinite(s.view.bearing) ? s.view.bearing : map.getBearing(),
      pitch: Number.isFinite(s.view.pitch) ? s.view.pitch : map.getPitch()
    });
  } catch (e) { }
}

// 맵 뷰 자동 저장
export function bindViewAutosave(map) {
  if (!map) return;
  const save = () => {
    const c = map.getCenter();
    savePatch({
      view: {
        center: [c.lng, c.lat],
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch()
      }
    });
  };
  ["moveend", "zoomend", "rotateend", "pitchend"].forEach(ev => map.on(ev, save));
}

export function saveDate(isoDate) {
  if (typeof isoDate === "string" && isoDate.length >= 8) {
    savePatch({ date: isoDate });
  }
}

export function saveLayerFlag(key, on) {
  const s = read();
  const layers = Object.assign({}, s.layers || {});
  layers[key] = !!on;
  savePatch({ layers });
}

export function saveGlobalStateColor(enabled) {
  setStateColorEnabled(enabled);
  savePatch({ stateColorEnabled: !!enabled });
}

export function bindAccordionAutosave() {
  const detailsList = document.querySelectorAll(".accordion details");
  if (!detailsList.length) return;

  detailsList.forEach((el, idx) => {
    el.addEventListener("toggle", () => {
      const s = read();
      const acc = Array.isArray(s.accordion) ? s.accordion.slice() : [];
      acc[idx] = !!el.open;
      savePatch({ accordion: acc });
    });
  });
}

export function clearAll() {
  try { S.removeItem(KEY); } catch (e) { }
}

// Shared runtime state
export const state = {};

export function initStateColorToggle() {
  const btn = document.getElementById("MapBtnStateChoropleth");
  if (!btn) return;

  // 초기 상태 반영 (체크박스인 경우)
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

    // 상태 저장 및 즉시 반영
    saveGlobalStateColor(nextEnabled);
    updateStateColors();
  };

  if (btn.type === "checkbox") {
    btn.addEventListener("change", handler);
  } else {
    btn.addEventListener("click", handler);
  }
}

/**
 * 전역 State Color 설정을 초기 상태(활성)로 리셋합니다.
 */
export function resetGlobalStateColor() {
  const btn = document.getElementById("MapBtnStateChoropleth");
  if (btn) {
    if (btn.type === "checkbox") {
      btn.checked = true;
    } else {
      btn.classList.remove("disabled");
    }
  }

  setStateColorEnabled(true);
  updateStateColors();
}

