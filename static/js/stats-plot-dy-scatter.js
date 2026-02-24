
import { ExcludeLayerGroups, LAYER_TEMPLATES } from "./layers-def.js";
import { currentDate, ESML } from "./utils.js";
import { loadedGeoJSON } from "./loader.js";
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

export function renderDailyScatter(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const theme = getPlotTheme();
    const fontSize = parseInt(theme.fontSize, 10);
    const isDetailMode = !!currentDailyDetailStateScatter;
    const { value: dsVal, key: dsKey } = getDatasetInfo();

    // 1. 체크된 유효한 데이저 레이어들 수집 (Y, X1, X2...)
    const activeLayers = LAYER_TEMPLATES.filter(tmpl => {
        const cb = document.getElementById(`layer-${tmpl.id}`);
        return cb?.checked && !ExcludeLayerGroups.plotScatter.includes(tmpl.id);
    }).map(tmpl => ({
        id: tmpl.id,
        field: (typeof tmpl.field === "function") ? tmpl.field(dsVal) : tmpl.field,
        title: (typeof tmpl.title === "function") ? tmpl.title(dsVal) : tmpl.title,
        decimals: tmpl.decimals ?? 1
    }));

    if (activeLayers.length < 2) {
        currentDailyDetailStateScatter = null;
        renderPlotMessage(container, theme.messages.scatter);
        renderBackButton(container, "stats-back-btn-scatter", null);
        return;
    }

    const rawData = loadedGeoJSON?.[dsKey];
    if (!rawData?.features) {
        renderPlotMessage(container, theme.messages.scatter);
        return;
    }

    // 2. 동적 키 할당
    const yLayer = activeLayers[0];
    const xLayers = activeLayers.slice(1);
    const yKey = yLayer.field;
    const yTitle = yLayer.title;
    const yDec = yLayer.decimals;

    let f1 = rawData.features;
    if (isDetailMode) f1 = f1.filter(fi => fi.properties.state === currentDailyDetailStateScatter);

    const aqsKey = (dsVal === "pm-cbsa") ? "AQS_PM" : "AQS_O3";
    const smokeKey = (dsVal === "pm-cbsa") ? "smoke_m0p5m" : "smoke";
    const traces = [];

    // 3. 데이터 포인트 생성 및 연기 유무 분리
    xLayers.forEach((xLayer, idx) => {
        const xKey = xLayer.field;
        const xTitle = xLayer.title;
        const xDec = xLayer.decimals;
        const nonSmoke = { x: [], y: [], text: [], customdata: [] };
        const smoke = { x: [], y: [], text: [], customdata: [] };

        f1.forEach(fi => {
            const p = fi.properties;
            const xv = p[xKey];
            const yv = p[yKey];
            if (xv === undefined || xv === null || yv === undefined || yv === null) return;

            const hoverText = `State: ${ESML(p.state)}<br>AQS: ${ESML(p[aqsKey])}<br>Site: ${ESML(p.site_name)}`;
            const dest = (Number(p[smokeKey] || 0) === 1) ? smoke : nonSmoke;

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
                name: xLayers.length > 1 ? `${xTitle} (NSD)` : "Non-smoke (NSD)",
                text: nonSmoke.text, customdata: nonSmoke.customdata,
                marker: { color: color, size: 8, opacity: 0.7, line: { color: theme.axisText, width: 0.5 } },
                hovertemplate: `${yTitle}: %{y:.${yDec}f}<br>${xTitle}: %{x:.${xDec}f}<br>%{text}<extra></extra>`
            });
        }
        if (smoke.x.length > 0) {
            traces.push({
                x: smoke.x, y: smoke.y, mode: "markers", type: "scatter",
                name: xLayers.length > 1 ? `${xTitle} (SMD)` : "Smoke day (SMD)",
                text: smoke.text, customdata: smoke.customdata,
                marker: { color: smokeColor, size: 8, opacity: 0.8, line: { color: theme.axisText, width: 0.5 } },
                hovertemplate: `${yTitle}: %{y:.${yDec}f}<br>${xTitle}: %{x:.${xDec}f}<br>%{text}<extra></extra>`
            });
        }
    });

    // 4. Reference Line Logic (Truly independent scaling)
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    traces.forEach(t => {
        if (!t.x || !t.y) return;
        t.x.forEach(v => { if (v < minX) minX = v; if (v > maxX) maxX = v; });
        t.y.forEach(v => { if (v < minY) minY = v; if (v > maxY) maxY = v; });
    });

    const shapes = [];
    if (minX !== Infinity && minY !== Infinity) {
        // 1:1 라인이 화면(뷰포트)을 지나가는 구간만 계산 (교집합)
        const lineStart = Math.max(minX, minY);
        const lineEnd = Math.min(maxX, maxY);

        // 교집합이 존재할 때만 선을 그림
        if (lineStart < lineEnd) {
            shapes.push({
                type: "line",
                x0: lineStart, y0: lineStart,
                x1: lineEnd, y1: lineEnd,
                line: { color: "red", width: 2, dash: "solid" },
                layer: "above" // 점들 위에 표시
            });

            // 범례 표시를 위한 더미 트레이스 추가
            traces.push({
                x: [null], y: [null],
                mode: "lines",
                name: "1:1 line",
                line: { color: "red", width: 2, dash: "solid" },
                showlegend: true
            });
        }
    }

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
            title: {
                text: yTitle,
                font: { size: fontSize, color: theme.axisText }
            },
            tickfont: { size: fontSize * 0.8, color: theme.axisText },
            gridcolor: theme.grid,
            linecolor: theme.axisText,
            mirror: true,
            autorange: true
        },
        shapes: shapes,
        legend: {
            orientation: "h",
            yanchor: "bottom",
            y: -0.4,
            xanchor: "center",
            x: 0.5,
            font: { color: theme.axisText, size: fontSize * 0.9 }
        },
        margin: { t: 70, r: 50, b: 140, l: 60 }, // 하단 여백 충분히 확보
        hovermode: "closest"
    };

    clearPlotMessage(container);
    Plotly.react(container, traces, layout, getPlotlyConfig(`scatter_${dsKey}`)).then(() => {
        container.on("plotly_click", data => {
            const props = data.points[0].customdata;
            const s = f1.find(f => f.properties[aqsKey] === props[aqsKey]);
            if (s?.geometry) highlightSiteOnMap(s.geometry.coordinates, props, dsKey);
        });
        attachResizeObserver(container, "_scatterObserver");
        renderBackButton(container, "stats-back-btn-scatter", isDetailMode ? () => { currentDailyDetailStateScatter = null; renderDailyScatter(containerId); } : null);
    });
}

export function resetState() { 
  currentDailyDetailStateScatter = null; 
}

