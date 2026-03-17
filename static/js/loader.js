
/**
  * 통합 창구 (Facade): 쪼개진 loader 모듈들을 하나로 묶어 외부에서 기존과 동일한 방식으로 접근
  */

import { map } from "./map-init.js";
import { ensureLayers } from "./layers-handler.js";
import { showErrorToast, updateWildfireNewsList } from "./loader-ui.js";
import {
  resetLoadedSources,
  getSiteStatsForState,
  loadedGeoJSON,
  loadedSources,
  modelStatsCache,
  getLoadedNewsFeatures
} from "./loader-state.js";
import {
  updateAllActiveSources,
  loadSourceData,
  bindEvents
} from "./loader-handler.js";

// Initialize
if (map) {
  map.on("load", function () {
    ensureLayers();
    bindEvents();
    updateAllActiveSources();
  });
}

// Auth listener
window.addEventListener("authStateChanged", (e) => {
  if (e.detail.user) {
    console.log("User logged in - refreshing all active sources.");
    updateAllActiveSources();
  } else {
    console.log("User logged out - clearing all sources.");
    resetLoadedSources(updateWildfireNewsList);
    updateAllActiveSources();
  }
});

// Re-exports for other modules
export {
  resetLoadedSources,
  updateAllActiveSources,
  loadSourceData,
  getSiteStatsForState,
  showErrorToast,
  loadedGeoJSON,
  loadedSources,
  modelStatsCache,
  getLoadedNewsFeatures
};

