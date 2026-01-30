
/**
 * 레이어 상태 관리: 현재 활성화된 레이어 스택과 지도 객체 등 레이어 관련 전역 상태를 유지
 */
 
import { map } from "./map-init.js";

export { map };
export let activeLayerStack = [];
export let regionStats = {};
export let _cachedActiveLayerIds = [];
export let StateShadingEnabled = true;

export function setStateShadingEnabled(enabled) {
    StateShadingEnabled = !!enabled;
}

export function setActiveLayerStack(stack) {
    activeLayerStack.length = 0;
    stack.forEach(item => activeLayerStack.push(item));
}

export function setRegionStats(stats) {
    // Clear object and copy properties
    for (let key in regionStats) delete regionStats[key];
    Object.assign(regionStats, stats);
}

export function setCachedActiveLayerIds(ids) {
    _cachedActiveLayerIds.length = 0;
    ids.forEach(id => _cachedActiveLayerIds.push(id));
}

