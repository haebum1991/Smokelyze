
import { ExcludeLayerGroups, LAYER_TEMPLATES, DATASET_SOURCE_MAP } from "./layers-def.js";
import { activeLayerStack } from "./layers-state.js";
import { currentDate, ESML } from "./utils.js";
import { loadedGeoJSON, loadedSources } from "./loader.js";
import {
    getPlotTheme,
    renderPlotMessage,
    renderBackButton,
    getDatasetInfo,
    getSpikeLayout,
    getPlotlyConfig,
    clearPlotMessage,
    highlightSiteOnMap,
    attachResizeObserver
} from "./stats-common.js";

let currentDailyDetailStateScatter = null;

/**
 * AQS ID를 9자리 문자열로 정규화 (앞자리 0 패딩)
 * Published 와 AirNow 간에 동일한 측정소를 매칭하기 위함
 */
function normalizeAqsId(id) {
    if (id === undefined || id === null) return "";
    let s = String(id).trim();
    return /^\d+$/.test(s) ? s.padStart(9, "0") : s;
}

/**
 * 데이터 소스별 AQS 필드명 결정
 * - AirNow (daily/hourly): "AQS"
 * - pm_cbsa: "AQS_PM"
 * - 기타 (gam_v2 등): "AQS_O3" 또는 "AQS_PM"
 */
function getAqsKey(source, field) {
    if (source === "airnow_daily") return "AQS";
    if (source?.startsWith("airnow-hourly")) return "AQS";
    if (source === "pm_cbsa") return "AQS_PM";
    return (field && (field.includes("PM2.5") || field.includes("PM"))) ? "AQS_PM" : "AQS_O3";
}

/**
 * Hourly 데이터는 loadedGeoJSON에 시간별 캐시키로 저장됨
 * 예: loadedSources["airnow-hourly-pm25"] = "airnow-hourly-pm25_2026-02-24T08"
 *     loadedGeoJSON["airnow-hourly-pm25_2026-02-24T08"] = { features: [...] }
 * 이 함수로 올바른 GeoJSON을 가져옴
 */
function getGeoData(sourceKey) {
    // 1) 직접 키로 시도
    if (loadedGeoJSON[sourceKey]) return loadedGeoJSON[sourceKey];
    // 2) loadedSources에 저장된 실제 캐시키로 시도 (hourly 대응)
    const cacheKey = loadedSources[sourceKey];
    if (cacheKey && loadedGeoJSON[cacheKey]) return loadedGeoJSON[cacheKey];
    return null;
}

export function renderDailyScatter(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const theme = getPlotTheme();
    const fontSize = parseInt(theme.fontSize, 10);
    const isDetailMode = !!currentDailyDetailStateScatter;
    const { value: dsVal, key: dsKey } = getDatasetInfo();

    // 1. 선택한 순서대로(activeLayerStack 기반) 유효한 데이터 레이어들 수집
    const activeLayers = activeLayerStack
        .filter(id => !ExcludeLayerGroups.plotScatter.includes(id))
        .map(id => {
            const cb = document.getElementById(`layer-${id}`);
            if (!cb || !cb.checked) return null;

            const tmpl = LAYER_TEMPLATES.find(t => t.id === id);
            if (!tmpl) return null;

            // 데이터셋/소스 결정: AirNow처럼 고정 소스인 경우 tmpl.datasets[0] 사용
            let layerDsKey = (tmpl.datasets && !tmpl.datasets.includes(dsVal))
                ? tmpl.datasets[0]
                : dsVal;
            const sourceKey = DATASET_SOURCE_MAP[layerDsKey] || layerDsKey;

            return {
                id: tmpl.id,
                source: sourceKey,
                field: (typeof tmpl.field === "function") ? tmpl.field(layerDsKey) : tmpl.field,
                title: (typeof tmpl.title === "function") ? tmpl.title(layerDsKey) : tmpl.title,
                decimals: tmpl.decimals ?? 1
            };
        })
        .filter(l => l !== null);

    if (activeLayers.length < 2) {
        currentDailyDetailStateScatter = null;
        renderPlotMessage(container, theme.messages.scatter);
        renderBackButton(container, "stats-back-btn-scatter", null);
        return;
    }

    // 2. Y축 (첫 번째 선택 레이어) 데이터 확보
    const yLayer = activeLayers[0];
    const xLayers = activeLayers.slice(1);
    const primarySource = yLayer.source;

    const rawData = getGeoData(primarySource);
    if (!rawData?.features) {
        renderPlotMessage(container, theme.messages.scatter);
        return;
    }

    const yKey = yLayer.field;
    const yTitle = yLayer.title;
    const yDec = yLayer.decimals;
    const yAqsKey = getAqsKey(primarySource, yKey);

    let f1 = rawData.features;
    if (isDetailMode) f1 = f1.filter(fi => fi.properties.state === currentDailyDetailStateScatter);

    // 3. X축 레이어가 다른 소스인 경우 AQS ID로 매핑 테이블 생성
    const secondaryMaps = xLayers.map(xl => {
        if (xl.source === primarySource) return null; // 같은 소스면 직접 접근

        const otherData = getGeoData(xl.source);
        if (!otherData?.features) return null;

        const otherAqsKey = getAqsKey(xl.source, xl.field);
        const map = new Map();
        otherData.features.forEach(f => {
            const aqsId = normalizeAqsId(f.properties[otherAqsKey]);
            if (aqsId) map.set(aqsId, f.properties);
        });
        return map;
    });

    // 4. 연기 유무(SMD/NSD) 참조: 현재 선택된 레이어 중 모델 데이터가 있을 때만 적용
    //    AirNow끼리만 비교할 때는 smoke 정보 자체가 없으므로 분류하지 않음
    const hasModelLayer = activeLayers.some(l =>
        ExcludeLayerGroups.restrictedSources.includes(l.source)
    );

    const smokeMap = new Map();
    if (hasModelLayer) {
        const smokeRefSource = activeLayers.find(l =>
            ExcludeLayerGroups.restrictedSources.includes(l.source)
        )?.source;

        if (smokeRefSource && loadedGeoJSON[smokeRefSource]) {
            const refAqsKey = getAqsKey(smokeRefSource);
            const refSmokeKey = (smokeRefSource === "pm_cbsa") ? "smoke_m0p5m" : "smoke";
            loadedGeoJSON[smokeRefSource].features.forEach(f => {
                const aqsId = normalizeAqsId(f.properties[refAqsKey]);
                if (aqsId) smokeMap.set(aqsId, Number(f.properties[refSmokeKey] || 0));
            });
        }
    }

    const primarySmokeKey = (primarySource === "pm_cbsa") ? "smoke_m0p5m" : "smoke";
    const traces = [];

    // 5. 데이터 포인트 생성 및 연기 유무 분리
    xLayers.forEach((xLayer, idx) => {
        const xKey = xLayer.field;
        const xTitle = xLayer.title;
        const xDec = xLayer.decimals;
        const secondaryMap = secondaryMaps[idx];
        const nonSmoke = { x: [], y: [], text: [], customdata: [] };
        const smoke = { x: [], y: [], text: [], customdata: [] };

        f1.forEach(fi => {
            const p = fi.properties;
            const rawAqs = p[yAqsKey];
            const aqsId = normalizeAqsId(rawAqs);
            const yv = p[yKey];

            // X값: 같은 소스면 직접, 다른 소스면 AQS 매핑으로 조회
            let xv = secondaryMap
                ? (secondaryMap.get(aqsId)?.[xKey])
                : p[xKey];
            if (xv === undefined || xv === null || yv === undefined || yv === null) return;

            const hoverText = `State: ${ESML(p.state)}<br>AQS: ${ESML(rawAqs)}<br>Site: ${ESML(p.site_name || "NA")}`;

            // 연기 판정: primary의 smoke 필드 → 없으면 smokeMap에서 참조
            let isSmoke = p[primarySmokeKey] ?? smokeMap.get(aqsId) ?? 0;
            const dest = (Number(isSmoke) === 1) ? smoke : nonSmoke;

            dest.x.push(xv);
            dest.y.push(yv);
            dest.text.push(hoverText);
            dest.customdata.push(p);
        });

        const color = (idx === 0) ? "black" : (idx === 1 ? "cyan" : null);
        const smokeColor = (idx === 0) ? "red" : (idx === 1 ? "magenta" : null);

        if (nonSmoke.x.length > 0) {
            traces.push({
                x: nonSmoke.x, y: nonSmoke.y, mode: "markers", type: "scatter",
                name: hasModelLayer ? (xLayers.length > 1 ? `${xTitle} (NSD)` : "Non-smoke day (NSD)") : xTitle,
                text: nonSmoke.text, customdata: nonSmoke.customdata,
                marker: { color: color, size: 8, opacity: 0.7, line: { color: theme.axisText, width: 0.5 } },
                hovertemplate: `${yTitle}: %{y:.${yDec}f}<br>${xTitle}: %{x:.${xDec}f}<br>%{text}<extra></extra>`
            });
        }
        if (smoke.x.length > 0) {
            traces.push({
                x: smoke.x, y: smoke.y, mode: "markers", type: "scatter",
                name: xLayers.length > 1 ? `${xTitle} (SMD)` : "Smoke day (SMD)",  // hasModelLayer가 false면 smoke 데이터 자체가 없어 이 분기에 진입하지 않음
                text: smoke.text, customdata: smoke.customdata,
                marker: { color: smokeColor, size: 8, opacity: 0.8, line: { color: theme.axisText, width: 0.5 } },
                hovertemplate: `${yTitle}: %{y:.${yDec}f}<br>${xTitle}: %{x:.${xDec}f}<br>%{text}<extra></extra>`
            });
        }
    });

    // 6. Reference Line Logic (Truly independent scaling)
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    traces.forEach(t => {
        if (!t.x || !t.y) return;
        t.x.forEach(v => { if (v < minX) minX = v; if (v > maxX) maxX = v; });
        t.y.forEach(v => { if (v < minY) minY = v; if (v > maxY) maxY = v; });
    });

    const shapes = [];
    if (minX !== Infinity && minY !== Infinity) {
        const lineStart = Math.max(minX, minY);
        const lineEnd = Math.min(maxX, maxY);

        if (lineStart < lineEnd) {
            shapes.push({
                type: "line",
                x0: lineStart, y0: lineStart,
                x1: lineEnd, y1: lineEnd,
                line: { color: "red", width: 2, dash: "solid" },
                layer: "above"
            });

            traces.push({
                x: [null], y: [null],
                mode: "lines",
                name: "1:1 line",
                line: { color: "red", width: 2, dash: "solid" },
                showlegend: true
            });
        }
    }

    // 7. Dynamic Legend & Margin Logic
    const numTraces = traces.length;
    const estimatedRows = Math.ceil(numTraces / 2);
    const dynamicMarginB = 100 + (estimatedRows * 20);

    const layout = {
        paper_bgcolor: theme.paper_bgcolor, plot_bgcolor: theme.plot_bgcolor,
        title: {
            text: `Comparison: ${ESML(yTitle)} vs Others<br>(date: ${currentDate()})`,
            font: { size: fontSize, color: theme.axisText },
            x: 0.5
        },
        xaxis: {
            ...getSpikeLayout(theme),
            title: {
                text: xLayers.length === 1 ? xLayers[0].title : "Comparison Variables",
                font: { size: fontSize, color: theme.axisText },
                standoff: 20
            },
            tickfont: { size: fontSize * 0.8, color: theme.axisText },
            gridcolor: theme.grid,
            linecolor: theme.axisText,
            mirror: true,
            autorange: true
        },
        yaxis: {
            ...getSpikeLayout(theme),
            title: { text: yTitle, font: { size: fontSize, color: theme.axisText } },
            tickfont: { size: fontSize * 0.8, color: theme.axisText },
            gridcolor: theme.grid,
            linecolor: theme.axisText,
            mirror: true,
            autorange: true
        },
        shapes: shapes,
        legend: {
            orientation: "h",
            yanchor: "top",
            y: -0.25,
            xanchor: "center",
            x: 0.5,
            font: { color: theme.axisText, size: fontSize * 0.85 }
        },
        margin: { t: 70, r: 50, b: dynamicMarginB, l: 60 },
        hovermode: "closest"
    };

    clearPlotMessage(container);
    Plotly.react(container, traces, layout, getPlotlyConfig(`scatter_${primarySource}`)).then(() => {
        container.on("plotly_click", data => {
            const props = data.points[0].customdata;
            const s = f1.find(f => normalizeAqsId(f.properties[yAqsKey]) === normalizeAqsId(props[yAqsKey]));
            if (s?.geometry) highlightSiteOnMap(s.geometry.coordinates, props, primarySource);
        });
        attachResizeObserver(container, "_scatterObserver");
        renderBackButton(container, "stats-back-btn-scatter", isDetailMode ? () => { currentDailyDetailStateScatter = null; renderDailyScatter(containerId); } : null);
    });
}

export function resetState() {
    currentDailyDetailStateScatter = null;
}

