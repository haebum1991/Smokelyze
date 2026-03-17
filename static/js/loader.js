
/**
  * 통합 창구 (Facade): 쪼개진 loader 모듈들을 하나로 묶어 외부에서 기존과 동일한 방식으로 접근
  * 
  * [Design Rule]
  * 1. 이 파일은 순수 기능 전달(Pure Re-export)만 담당합니다.
  * 2. 내부 로직(이벤트 바인딩, 초기화)은 loader-handler.js 에서 처리합니다.
  * 3. 모든 외부 모듈은 이 대장 파일을 통해 소통하는 것을 권장합니다.
  */

import {
  showErrorToast,
  toggleSpinner,
  showTaskNotification
} from "./loader-ui.js";
import {
  resetLoadedSources,
  getSiteStatsForState,
  clearModelStats,
  loadedGeoJSON,
  loadedSources,
  modelStatsCache,
  getLoadedNewsFeatures,
  activeSources
} from "./loader-state.js";
import {
  updateAllActiveSources,
  loadSourceData,
  initLoaderRuntime
} from "./loader-handler.js";

// Re-exports for other modules
export {
  resetLoadedSources,
  updateAllActiveSources,
  loadSourceData,
  getSiteStatsForState,
  clearModelStats,
  showErrorToast,
  toggleSpinner,
  showTaskNotification,
  loadedGeoJSON,
  loadedSources,
  modelStatsCache,
  getLoadedNewsFeatures,
  activeSources,
  initLoaderRuntime
};

