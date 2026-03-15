
/**
 * 레이어 정의 및 템플릿: 각 데이터셋별 필드 정보, 렌더링 스타일, 데이터 시각화 규칙을 정의
 */
export const ExcludeLayerGroups = {
  
  // ========= Common Groups =========
  satelliteLayers: ["burn", "smoke", "fire", "tempo-no2", "tempo-hcho", "tropomi-no2", "tropomi-hcho"],
    
  // [layers-handler.js] > [addSourceIfMissing]
  pngLayers: ["tempo-no2", "tempo-hcho", "tropomi-no2", "tropomi-hcho"],
    
  // ========= Find by [key] =========
  // [layers-handler.js] > [applyLayerToggles] > [EXCLUDED]
  liveUpdateLayers: ["wildfire-news", "wildfire-nifc", "MapPost"],

  // [layers-colors.js] > [updateStateShading] > [EXCLUDED]
  stateShading: ["smoke", "wildfire-news", "wildfire-nifc", "MapPost", "tempo-no2", "tempo-hcho", "tropomi-no2", "tropomi-hcho"],

  // [layers-tooltip.js] > [stateHoverHTML] > [EXCLUDED]
  stateHover: ["wildfire-news", "wildfire-nifc", "MapPost", "tempo-no2", "tempo-hcho", "tropomi-no2", "tropomi-hcho"],

  // [stats-common.js] > [getActiveModelLayers] > [EXCLUDED]
  modelTable: ["burn", "smoke", "fire", "wildfire-news", "wildfire-nifc", "MapPost", "tempo-no2", "tempo-hcho", "tropomi-no2", "tropomi-hcho"],

  // [stats-data-search.js] > [updateVisibility] > [EXCLUDED]
  // [loader.js] > [updateAllActiveSources] > [EXCLUDED]
  searchSite: ["burn", "smoke", "fire", "wildfire-news", "wildfire-nifc", "MapPost", "airnow-hourly-pm25", "airnow-hourly-ozone", "airnow-hourly-no2", "airnow-daily-pm25", "airnow-daily-mda8", "tempo-no2", "tempo-hcho", "tropomi-no2", "tropomi-hcho"],

  // [stats-plot-dy-scatter.js] > [getActiveModelLayers] > [EXCLUDED]
  plotScatter: ["burn", "smoke", "fire", "wildfire-news", "wildfire-nifc", "MapPost"],


  // ========= Find by [source] =========
  // [loader.js] > [loadSourceData] > [GZIP_DATASETS]
  formatGzip: ["gam_v2", "gam_v1", "pm_cbsa", "epa_ember", "wildfire_news", "wildfire_nifc", "smoke", "fire", "airnow_daily", "gam_v2_pred", "pm_cbsa_pred"],

  // [loader.js] > [loadSourceData] > Authentication required (Published data)
  // [loader.js] > [updateAllActiveSources] > Clear on logout
  restrictedSources: ["gam_v2", "gam_v1", "pm_cbsa", "epa_ember", "gam_v2_pred", "pm_cbsa_pred"],

  // [loader.js] > [loadSourceData] > Calculate state-level statistics (Public data)
  publicStatsSources: ["airnow_daily", "gam_v2_pred", "pm_cbsa_pred"]
};

import { generatePopupHTML } from "./layers-tooltip.js";
import {
    EMPTY_FC,
    PALETTE_EPA, PALETTE_JET, PALETTE_TEMPO, PALETTE_BIN_1, PALETTE_BIN_2, PALETTE_BIN_3, PALETTE_TRI, PALETTE_BURN, PALETTE_SMOKE,
    BREAKS_O3, BREAKS_RESI, BREAKS_SMO_EMBER, BREAKS_PM, BREAKS_PM_CRIT,
    BREAKS_TMAX, BREAKS_T2MAX, BREAKS_SRAD, BREAKS_QUANT, BREAKS_R2,
    BREAKS_BIN, BREAKS_TRI, BREAKS_NO2, BREAKS_FIRE, BREAKS_SMOKE, BREAKS_BURN, BREAKS_FRP, BREAKS_TEMPO,
    LABEL_SMOKE, LABEL_BIN, LABEL_SMO, LABEL_SMP
} from "./layers-constants.js";

export const DATA_IMPORT_METHOD = {

  "wildfire-news": {
      key: "wildfire-news",
      source: "wildfire_news",
      prefix: "wildfire_news_",
      gzfileBaseUrlDate: "/realtime"
  },
  "wildfire-nifc": {
      key: "wildfire-nifc",
      source: "wildfire_nifc",
      prefix: "wildfire_nifc_",
      gzfileBaseUrlDate: "/realtime"
  },
  "MapPost": {
      key: "MapPost",
      source: "MapPost",
      firebase: true // Hint that this is handled via Firebase
  },
  
  // ---- [External data] AirNow ----
  "airnow-hourly-pm25": {
      key: "airnow-hourly-pm25",
      source: "airnow-hourly-pm25",
      coverage: "airnow.pm25",
      hourly: true
  },
  "airnow-hourly-ozone": {
      key: "airnow-hourly-ozone",
      source: "airnow-hourly-ozone",
      coverage: "airnow.ozone",
      hourly: true
  },
  "airnow-hourly-no2": {
      key: "airnow-hourly-no2",
      source: "airnow-hourly-no2",
      coverage: "airnow.no2",
      hourly: true
  },
  "airnow_daily": {
      key: "airnow_daily",
      source: "airnow_daily",
      prefix: "airnow_",
      gzfileBaseUrlDate: "/airnow_date_geojson"
    },
  // ---- [External data] AirNow ----
  
  "airnow-daily-pm25": { key: "airnow-daily-pm25", source: "airnow_daily" },
  "airnow-daily-mda8": { key: "airnow-daily-mda8", source: "airnow_daily" },
    
  "smoke": {
      key: "smoke",
      source: "smoke",
      prefix: "noaa_hms_smoke_",
      excludeIDs: ["uni"],
      gzfileBaseUrlDate: "/noaa_hms_smoke_date_geojson",
      statsBaseUrlDate: "/noaa_hms_smoke_date_json",
      statsBaseUrlYear: "/noaa_hms_smoke_year_json"
  },
  "fire": {
      key: "fire",
      source: "fire",
      prefix: "noaa_hms_fire_",
      gzfileBaseUrlDate: "/noaa_hms_fire_date_geojson",
      statsBaseUrlDate: "/noaa_hms_fire_date_json",
      statsBaseUrlYear: "/noaa_hms_fire_year_json"
  },
  "burn": {
      key: "burn",
      source: "burn",
      prefix: "MODIS_MCD64A1_",
      excludeIDs: ["US", "US_conus"],
      geoBaseUrlDate: "/modis_burn_area_date_geojson",
      statsBaseUrlDate: "/modis_burn_area_date_json",
      statsBaseUrlYear: "/modis_burn_area_year_json"
  },

  "tempo-no2": {
      key: "tempo-no2",
      source: "tempo-no2",
      duration: "hourly",
      hourly: true
  },
  
  "tempo-hcho": {
      key: "tempo-hcho",
      source: "tempo-hcho",
      duration: "hourly",
      hourly: true
  },

  "tropomi-no2": {
      key: "tropomi-no2",
      source: "tropomi-no2",
      duration: "daily",
      hourly: false
  },
  
  "tropomi-hcho": {
      key: "tropomi-hcho",
      source: "tropomi-hcho",
      duration: "daily",
      hourly: false
  },
  
  "gam_v2": {
      key: "gam_v2",
      source: "gam_v2",
      prefix: "data_by_date_",
      gzfileBaseUrlDate: "/data_by_date",
  },
  "gam_v1": {
      key: "gam_v1",
      source: "gam_v1",
      prefix: "data_by_date_",
      gzfileBaseUrlDate: "/data_by_date",
  },
  "pm_cbsa": {
      key: "pm_cbsa",
      source: "pm_cbsa",
      prefix: "data_by_date_",
      gzfileBaseUrlDate: "/data_by_date",
  },
  "epa_ember": {
      key: "epa_ember",
      source: "epa_ember",
      prefix: "data_by_date_",
      gzfileBaseUrlDate: "/data_by_date",
  },
  "gam_v2_pred": {
      key: "gam_v2_pred",
      source: "gam_v2_pred",
      prefix: "data_by_date_",
      gzfileBaseUrlDate: "/data_by_date",
  },
  "pm_cbsa_pred": {
      key: "pm_cbsa_pred",
      source: "pm_cbsa_pred",
      prefix: "data_by_date_",
      gzfileBaseUrlDate: "/data_by_date",
  },

  "mda8-obs-gam-v2": { key: "mda8-obs-gam-v2", source: "gam_v2", field: "MDA8O3" },
  "mda8-obs-gam-v2-pred": { key: "mda8-obs-gam-v2-pred", source: "gam_v2_pred", field: "MDA8O3" },
  "mda8-obs-gam-v1": { key: "mda8-obs-gam-v1", source: "gam_v1", field: "MDA8O3" },
  "mda8-obs-epa-ember": { key: "mda8-obs-epa-ember", source: "epa_ember", field: "MDA8O3" },

  "mda8-pred-gam-v2": { key: "mda8-pred-gam-v2", source: "gam_v2", field: "MDA8O3_pred" },
  "mda8-pred-gam-v2-pred": { key: "mda8-pred-gam-v2-pred", source: "gam_v2_pred", field: "MDA8O3_pred" },
  "mda8-pred-edm-gam-v2": { key: "mda8-pred-edm-gam-v2", source: "gam_v2", field: "edm_MDA8O3_pred" },
  "mda8-pred-edm-gam-v2-pred": { key: "mda8-pred-edm-gam-v2-pred", source: "gam_v2_pred", field: "edm_MDA8O3_pred" },
  "mda8-pred-gam-v1": { key: "mda8-pred-gam-v1", source: "gam_v1", field: "MDA8O3_pred" },
  "mda8-pred-epa-ember": { key: "mda8-pred-epa-ember", source: "epa_ember", field: "MDA8O3_pred" },

  "smo-gam-v2": { key: "smo-gam-v2", source: "gam_v2", field: "SMO" },
  "smo-gam-v2-pred": { key: "smo-gam-v2-pred", source: "gam_v2_pred", field: "SMO" },
  "smo-edm-gam-v2": { key: "smo-edm-gam-v2", source: "gam_v2", field: "edm_SMO" },
  "smo-edm-gam-v2-pred": { key: "smo-edm-gam-v2-pred", source: "gam_v2_pred", field: "edm_SMO" },
  "smo-gam-v1": { key: "smo-gam-v1", source: "gam_v1", field: "SMO" },
  "smo-epa-ember": { key: "smo-epa-ember", source: "epa_ember", field: "SMO" },

  "resids-gam-v2": { key: "resids-gam-v2", source: "gam_v2", field: "MDA8O3_resids" },
  "resids-gam-v2-pred": { key: "resids-gam-v2-pred", source: "gam_v2_pred", field: "MDA8O3_resids" },
  "resids-edm-gam-v2": { key: "resids-edm-gam-v2", source: "gam_v2", field: "edm_MDA8O3_resids" },
  "resids-edm-gam-v2-pred": { key: "resids-edm-gam-v2-pred", source: "gam_v2_pred", field: "edm_MDA8O3_resids" },
  "resids-gam-v1": { key: "resids-gam-v1", source: "gam_v1", field: "MDA8O3_resids" },
  "resids-epa-ember": { key: "resids-epa-ember", source: "epa_ember", field: "MDA8O3_resids" },

  "resids-quant-gam-v2": { key: "resids-quant-gam-v2", source: "gam_v2", field: "Quant_MDA8O3_resids" },
  "resids-quant-gam-v2-pred": { key: "resids-quant-gam-v2-pred", source: "gam_v2_pred", field: "Quant_MDA8O3_resids" },
  "resids-quant-edm-gam-v2": { key: "resids-quant-edm-gam-v2", source: "gam_v2", field: "edm_Quant_MDA8O3_resids" },
  "resids-quant-edm-gam-v2-pred": { key: "resids-quant-edm-gam-v2-pred", source: "gam_v2_pred", field: "edm_Quant_MDA8O3_resids" },
  "resids-quant-gam-v1": { key: "resids-quant-gam-v1", source: "gam_v1", field: "Quant_MDA8O3_resids" },
  "resids-quant-epa-ember": { key: "resids-quant-epa-ember", source: "epa_ember", field: "Quant_MDA8O3_resids" },

  "pm25-obs-gam-v2": { key: "pm25-obs-gam-v2", source: "gam_v2", field: "PM2.5" },
  "pm25-obs-gam-v2-pred": { key: "pm25-obs-gam-v2-pred", source: "gam_v2_pred", field: "PM2.5" },
  "pm25-obs-gam-v1": { key: "pm25-obs-gam-v1", source: "gam_v1", field: "PM2.5" },
  "pm25-obs-pm-cbsa": { key: "pm25-obs-pm-cbsa", source: "pm_cbsa", field: "PM2.5" },
  "pm25-obs-pm-cbsa-pred": { key: "pm25-obs-pm-cbsa-pred", source: "pm_cbsa_pred", field: "PM2.5" },

  "pm25-quant-gam-v2": { key: "pm25-quant-gam-v2", source: "gam_v2", field: "Quant_PM2.5" },
  "pm25-quant-gam-v2-pred": { key: "pm25-quant-gam-v2-pred", source: "gam_v2_pred", field: "Quant_PM2.5" },
  "pm25-quant-gam-v1": { key: "pm25-quant-gam-v1", source: "gam_v1", field: "Quant_PM2.5" },
  "pm25-quant-pm-cbsa": { key: "pm25-quant-pm-cbsa", source: "pm_cbsa", field: "Quant_PM2.5" },
  "pm25-quant-pm-cbsa-pred": { key: "pm25-quant-pm-cbsa-pred", source: "pm_cbsa_pred", field: "Quant_PM2.5" },

  "pm25-crit-gam-v2": { key: "pm25-crit-gam-v2", source: "gam_v2", field: "PM2.5_Crit" },
  "pm25-crit-gam-v2-pred": { key: "pm25-crit-gam-v2-pred", source: "gam_v2_pred", field: "PM2.5_Crit" },
  "pm25-crit-gam-v1": { key: "pm25-crit-gam-v1", source: "gam_v1", field: "PM2.5_Crit" },

  "pm25-crit-m0p5m-pm-cbsa": { key: "pm25-crit-m0p5m-pm-cbsa", source: "pm_cbsa", field: "PM2.5_Crit_m0p5m" },
  "pm25-crit-m0p5m-pm-cbsa-pred": { key: "pm25-crit-m0p5m-pm-cbsa-pred", source: "pm_cbsa_pred", field: "PM2.5_Crit_m0p5m" },
  "pm25-crit-m1p0m-pm-cbsa": { key: "pm25-crit-m1p0m-pm-cbsa", source: "pm_cbsa", field: "PM2.5_Crit_m1p0m" },
  "pm25-crit-m1p0m-pm-cbsa-pred": { key: "pm25-crit-m1p0m-pm-cbsa-pred", source: "pm_cbsa_pred", field: "PM2.5_Crit_m1p0m" },

  "pm25-smoke-m0p5m-pm-cbsa": { key: "pm25-smoke-m0p5m-pm-cbsa", source: "pm_cbsa", field: "smoke_PM2.5_m0p5m" },
  "pm25-smoke-m0p5m-pm-cbsa-pred": { key: "pm25-smoke-m0p5m-pm-cbsa-pred", source: "pm_cbsa_pred", field: "smoke_PM2.5_m0p5m" },
  "pm25-smoke-m1p0m-pm-cbsa": { key: "pm25-smoke-m1p0m-pm-cbsa", source: "pm_cbsa", field: "smoke_PM2.5_m1p0m" },
  "pm25-smoke-m1p0m-pm-cbsa-pred": { key: "pm25-smoke-m1p0m-pm-cbsa-pred", source: "pm_cbsa_pred", field: "smoke_PM2.5_m1p0m" },

  "tmax-gam-v2": { key: "tmax-gam-v2", source: "gam_v2", field: "TMAX" },
  "tmax-gam-v2-pred": { key: "tmax-gam-v2-pred", source: "gam_v2_pred", field: "TMAX" },
  "tmax-gam-v1": { key: "tmax-gam-v1", source: "gam_v1", field: "TMAX" },

  "srad-gam-v2": { key: "srad-gam-v2", source: "gam_v2", field: "SRAD" },
  "srad-gam-v2-pred": { key: "srad-gam-v2-pred", source: "gam_v2_pred", field: "SRAD" },
  "srad-gam-v1": { key: "srad-gam-v1", source: "gam_v1", field: "SRAD" },

  "smokeday-gam-v2": { key: "smokeday-gam-v2", source: "gam_v2", field: "smoke" },
  "smokeday-gam-v2-pred": { key: "smokeday-gam-v2-pred", source: "gam_v2_pred", field: "smoke" },
  "smokeday-gam-v1": { key: "smokeday-gam-v1", source: "gam_v1", field: "smoke" },

  "smokeday-975-gam-v2": { key: "smokeday-975-gam-v2", source: "gam_v2", field: "smoke_p975" },
  "smokeday-975-gam-v2-pred": { key: "smokeday-975-gam-v2-pred", source: "gam_v2_pred", field: "smoke_p975" },
  "smokeday-975-gam-v1": { key: "smokeday-975-gam-v1", source: "gam_v1", field: "smoke_p975" },
  "smokeday-975-edm-gam-v2": { key: "smokeday-975-edm-gam-v2", source: "gam_v2", field: "edm_smoke_p975" },
  "smokeday-975-edm-gam-v2-pred": { key: "smokeday-975-edm-gam-v2-pred", source: "gam_v2_pred", field: "edm_smoke_p975" },

  "smokeday-m0p5m-pm-cbsa": { key: "smokeday-m0p5m-pm-cbsa", source: "pm_cbsa", field: "smoke_m0p5m" },
  "smokeday-m0p5m-pm-cbsa-pred": { key: "smokeday-m0p5m-pm-cbsa-pred", source: "pm_cbsa_pred", field: "smoke_m0p5m" },
  "smokeday-m1p0m-pm-cbsa": { key: "smokeday-m1p0m-pm-cbsa", source: "pm_cbsa", field: "smoke_m1p0m" },
  "smokeday-m1p0m-pm-cbsa-pred": { key: "smokeday-m1p0m-pm-cbsa-pred", source: "pm_cbsa_pred", field: "smoke_m1p0m" },

  "ExcDays-gam-v1": { key: "ExcDays-gam-v1", source: "gam_v1", field: "exceedance" },
  "ExcDays-gam-v2": { key: "ExcDays-gam-v2", source: "gam_v2", field: "exceedance" },
  "ExcDays-gam-v2-pred": { key: "ExcDays-gam-v2-pred", source: "gam_v2_pred", field: "exceedance" },
  "ExcDays-epa-ember": { key: "ExcDays-epa-ember", source: "epa_ember", field: "exceedance" },
  "ExcDays-edm-gam-v2": { key: "ExcDays-edm-gam-v2", source: "gam_v2", field: "edm_exceedance" },
  "ExcDays-edm-gam-v2-pred": { key: "ExcDays-edm-gam-v2-pred", source: "gam_v2_pred", field: "edm_exceedance" },
  "ExcDays-m0p5m-pm-cbsa": { key: "ExcDays-m0p5m-pm-cbsa", source: "pm_cbsa", field: "exceedance_m0p5m" },
  "ExcDays-m0p5m-pm-cbsa-pred": { key: "ExcDays-m0p5m-pm-cbsa-pred", source: "pm_cbsa_pred", field: "exceedance_m0p5m" },
  "ExcDays-m1p0m-pm-cbsa": { key: "ExcDays-m1p0m-pm-cbsa", source: "pm_cbsa", field: "exceedance_m1p0m" },
  "ExcDays-m1p0m-pm-cbsa-pred": { key: "ExcDays-m1p0m-pm-cbsa-pred", source: "pm_cbsa_pred", field: "exceedance_m1p0m" }
};

export const DATASET_SOURCE_MAP = {
    "gam-v2": "gam_v2",
    "gam-v1": "gam_v1",
    "epa-ember": "epa_ember",
    "pm-cbsa": "pm_cbsa",
    
    "gam-v2-pred": "gam_v2_pred",
    "pm-cbsa-pred": "pm_cbsa_pred",
    
    // ---- [External data] AirNow ----
    "airnow-hourly-pm25": "airnow-hourly-pm25",
    "airnow-hourly-ozone": "airnow-hourly-ozone",
    "airnow-hourly-no2": "airnow-hourly-no2",
    "airnow-daily-pm25": "airnow_daily",
    "airnow-daily-mda8": "airnow_daily",
    // ---- [External data] AirNow ----
    
    "wildfire-news": "wildfire_news",
    "wildfire-nifc": "wildfire_nifc",
    "MapPost": "MapPost",
    
    "tempo-no2": "tempo-no2",
    "tempo-hcho": "tempo-hcho",
    
    "tropomi-no2": "tropomi-no2",
    "tropomi-hcho": "tropomi-hcho"
};

export function makeStepExpr(valueField, breaks, colors, nullVal) {
    if (!breaks || breaks.length === 0) return colors[0];
    const fallback = (nullVal !== undefined) ? nullVal : "#FFFFFF";
    const stepExpr = ["step", ["to-number", ["get", valueField]]];
    stepExpr.push(colors[0]);
    for (let i = 0; i < breaks.length; i++) {
        stepExpr.push(breaks[i]);
        stepExpr.push(colors[i + 1]);
    }

    return [
        "case",
        ["==", ["get", valueField], null], fallback,
        ["==", ["get", valueField], "NA"], fallback,
        ["!", ["has", valueField]], fallback,
        stepExpr
    ];
}

export function makeSizeLegendItems(breaks, radii) {
    const items = [{ label: `< ${breaks[0]}`, radius: radii[0] }];
    for (let i = 0; i < breaks.length; i++) {
        const label = (i === breaks.length - 1) ? `> ${breaks[i]}` : `${breaks[i]} to ${breaks[i + 1]}`;
        items.push({ label, radius: radii[i + 1] });
    }
    return items;
}

export function getLayerDef(key, sourceKey, fieldName, breaks, colors, opts = {}) {
    const type = opts.type || "circle";

    let layerSpec;
    if (type === "symbol") {
        layerSpec = {
            id: `${key}-symbol`,
            type: "symbol",
            source: sourceKey,
            layout: {
                "icon-image": opts.iconImage || "marker",
                "icon-size": opts.iconSize || [
                    "interpolate", ["linear"], ["zoom"],
                    1, 0.4,
                    3, 0.6,
                    6, 0.8,
                    9, 1.0,
                    12, 1.2
                ],
                "icon-allow-overlap": opts.iconAllowOverlap !== undefined ? opts.iconAllowOverlap : true
            }
        };
    } else {
        const defaultRadius = [
            "interpolate", ["linear"], ["zoom"],
            1, 3,
            3, 6,
            6, 10,
            9, 14,
            12, 18
        ];
        const radius = (opts.radius !== undefined) ? opts.radius : defaultRadius;
        const strokeWidth = (opts.strokeWidth !== undefined) ? opts.strokeWidth : 1;
        const strokeColor = opts.strokeColor || "black";

        layerSpec = {
            id: `${key}-circle`,
            type: "circle",
            source: sourceKey,
            paint: {
                "circle-radius": radius,
                "circle-color": makeStepExpr(fieldName, breaks, colors),
                "circle-stroke-width": strokeWidth,
                "circle-stroke-color": strokeColor
            },
            _fieldName: fieldName,
            _breaks: breaks,
            _colors: colors
        };
    }

    return {
        layers: [layerSpec],
        hoverHTML: (p) => generatePopupHTML(p, sourceKey),
        hoverOn: layerSpec.id,
        legend: {
            title: opts.title || fieldName,
            breaks,
            colors,
            labels: opts.labels || null
        },
        dsKey: opts.dsKey
    };
}

export const LAYER_TEMPLATES = [
    // --- Real-time data ---
    { duration: "daily", id: "wildfire-news", field: "title", breaks: [], colors: ["blue"], title: "Wildfire News", datasets: ["wildfire-news"], type: "symbol", iconImage: "pulsing-news" },
    { duration: "daily", id: "wildfire-nifc", field: "IncidentName", breaks: [], colors: ["orange"], title: "Wildfire Incidents", datasets: ["wildfire-nifc"], type: "symbol", iconImage: "pulsing-fire" },
    { duration: "daily", id: "MapPost", field: "title", breaks: [], colors: ["red"], title: "MapPost", datasets: ["MapPost"], type: "symbol", iconImage: "pulsing-alert" },

    // ---- [External data] AirNow ----
    { duration: "hourly", id: "airnow-hourly-pm25", field: "pm25(ug/m3)", breaks: BREAKS_PM, colors: PALETTE_EPA, title: "AirNow Obs PM2.5 (hourly) (µg m⁻³)", decimals: 1, datasets: ["airnow-hourly-pm25"], hourly: true },
    { duration: "hourly", id: "airnow-hourly-ozone", field: "ozone(ppb)", breaks: BREAKS_O3, colors: PALETTE_EPA, title: "AirNow Obs O3 (hourly) (ppb)", decimals: 1, datasets: ["airnow-hourly-ozone"], hourly: true },
    { duration: "hourly", id: "airnow-hourly-no2", field: "no2(ppb)", breaks: BREAKS_NO2, colors: PALETTE_EPA, title: "AirNow Obs NO2 (hourly) (ppb)", decimals: 1, datasets: ["airnow-hourly-no2"], hourly: true },

    { duration: "daily", id: "airnow-daily-pm25", field: "PM2.5", breaks: BREAKS_PM, colors: PALETTE_EPA, title: "AirNow Obs PM2.5 (µg m⁻³)", decimals: 1, datasets: ["airnow-daily-pm25"] },
    { duration: "daily", id: "airnow-daily-mda8", field: "MDA8O3", breaks: BREAKS_O3, colors: PALETTE_EPA, title: "AirNow Obs MDA8 (ppb)", decimals: 1, datasets: ["airnow-daily-mda8"] },

    // --- MDA8 Ozone ---
    { duration: "daily", id: "mda8-obs", field: "MDA8O3", breaks: BREAKS_O3, colors: PALETTE_EPA, title: "Obs MDA8 (ppb)", decimals: 1, datasets: ["gam-v2", "gam-v1", "epa-ember", "gam-v2-pred"] },
    { duration: "daily", id: "mda8-pred", field: "MDA8O3_pred", breaks: BREAKS_O3, colors: PALETTE_EPA, title: "Pred MDA8 (ppb)", decimals: 1, datasets: ["gam-v2", "gam-v1", "epa-ember", "gam-v2-pred"] },
    { duration: "daily", id: "mda8-pred-edm", field: "edm_MDA8O3_pred", breaks: BREAKS_O3, colors: PALETTE_EPA, title: "Pred MDA8 (EDM) (ppb)", decimals: 1, datasets: ["gam-v2", "gam-v2-pred"] },

    // --- SMO ---
    { duration: "daily", id: "smo", field: "SMO", breaks: (ds) => ds === "epa-ember" ? BREAKS_SMO_EMBER : BREAKS_RESI, colors: PALETTE_EPA, title: "SMO (ppb)", decimals: 1, datasets: ["gam-v2", "gam-v1", "epa-ember", "gam-v2-pred"] },
    { duration: "daily", id: "smo-edm", field: "edm_SMO", breaks: BREAKS_RESI, colors: PALETTE_EPA, title: "SMO (EDM) (ppb)", decimals: 1, datasets: ["gam-v2", "gam-v2-pred"] },

    // --- Residuals ---
    { duration: "daily", id: "resids", field: "MDA8O3_resids", breaks: BREAKS_RESI, colors: PALETTE_EPA, title: "Residuals (ppb)", decimals: 1, datasets: ["gam-v2", "gam-v1", "epa-ember", "gam-v2-pred"] },
    { duration: "daily", id: "resids-edm", field: "edm_MDA8O3_resids", breaks: BREAKS_RESI, colors: PALETTE_EPA, title: "Residuals (EDM) (ppb)", decimals: 1, datasets: ["gam-v2", "gam-v2-pred"] },

    // --- Quantile Residuals ---
    { duration: "daily", id: "resids-quant", field: "Quant_MDA8O3_resids", breaks: BREAKS_QUANT, colors: PALETTE_EPA, title: "Residual quantile (%)", decimals: 1, datasets: ["gam-v2", "gam-v1", "epa-ember", "gam-v2-pred"] },
    { duration: "daily", id: "resids-quant-edm", field: "edm_Quant_MDA8O3_resids", breaks: BREAKS_QUANT, colors: PALETTE_EPA, title: "Residual quantile (EDM) (%)", decimals: 1, datasets: ["gam-v2", "gam-v2-pred"] },

    // --- PM2.5 ---
    { duration: "daily", id: "pm25-obs", field: "PM2.5", breaks: BREAKS_PM, colors: PALETTE_EPA, title: "Obs PM2.5 (µg m⁻³)", decimals: 1, datasets: ["gam-v2", "gam-v1", "pm-cbsa", "gam-v2-pred", "pm-cbsa-pred"] },

    { duration: "daily", id: "pm25-smoke-m0p5m", field: "smoke_PM2.5_m0p5m", breaks: BREAKS_PM, colors: PALETTE_EPA, title: "Smoke PM2.5 m0p5m (µg m⁻³)", decimals: 2, datasets: ["pm-cbsa", "pm-cbsa-pred"] },
    { duration: "daily", id: "pm25-smoke-m1p0m", field: "smoke_PM2.5_m1p0m", breaks: BREAKS_PM, colors: PALETTE_EPA, title: "Smoke PM2.5 m1p0m (µg m⁻³)", decimals: 2, datasets: ["pm-cbsa", "pm-cbsa-pred"] },

    // --- PM2.5 Quantiles ---
    { duration: "daily", id: "pm25-quant", field: "Quant_PM2.5", breaks: BREAKS_QUANT, colors: PALETTE_EPA, title: "PM2.5 quantile (%)", decimals: 1, datasets: ["gam-v2", "gam-v1", "pm-cbsa", "gam-v2-pred", "pm-cbsa-pred"] },

    // --- PM2.5 Crit ---
    { duration: "daily", id: "pm25-crit", field: "PM2.5_Crit", breaks: BREAKS_PM_CRIT, colors: PALETTE_EPA, title: "PM2.5-crit (µg m⁻³)", decimals: 2, datasets: ["gam-v2", "gam-v1", "gam-v2-pred"] },
    { duration: "daily", id: "pm25-crit-m0p5m", field: "PM2.5_Crit_m0p5m", breaks: BREAKS_PM_CRIT, colors: PALETTE_EPA, title: "PM2.5-crit m0p5m (µg m⁻³)", decimals: 2, datasets: ["pm-cbsa", "pm-cbsa-pred"] },
    { duration: "daily", id: "pm25-crit-m1p0m", field: "PM2.5_Crit_m1p0m", breaks: BREAKS_PM_CRIT, colors: PALETTE_EPA, title: "PM2.5-crit m1p0m (µg m⁻³)", decimals: 2, datasets: ["pm-cbsa", "pm-cbsa-pred"] },

    // --- Meteo (TMAX, SRAD) ---
    { duration: "daily", id: "tmax", field: function (ds) { return ds.startsWith("gam-v2") ? "T2MAX" : "TMAX"; }, breaks: function (ds) { return ds.startsWith("gam-v2") ? BREAKS_T2MAX : BREAKS_TMAX; }, colors: PALETTE_EPA, title: function (ds) { return ds.startsWith("gam-v2") ? "TMAX (K)" : "TMAX (°C)"; }, decimals: 1, datasets: ["gam-v2", "gam-v1", "gam-v2-pred"] },
    { duration: "daily", id: "srad", field: "SRAD", breaks: BREAKS_SRAD, colors: PALETTE_EPA, title: "SRAD (W m⁻²)", decimals: 1, datasets: ["gam-v2", "gam-v1", "gam-v2-pred"] },

    // --- Smoke day (Binary) ---
    { duration: "daily", id: "smokeday", field: "smoke", breaks: BREAKS_BIN, colors: PALETTE_BIN_1, title: "Smoke Day (SMD)", labelParams: LABEL_BIN, decimals: 0, datasets: ["gam-v2", "gam-v1", "gam-v2-pred"] },
    { duration: "daily", id: "smokeday-975", field: "smoke_p975", breaks: BREAKS_BIN, colors: PALETTE_BIN_2, title: "SMO > 97.5th", labelParams: LABEL_BIN, decimals: 0, datasets: ["gam-v2", "gam-v1", "gam-v2-pred"] },
    { duration: "daily", id: "smokeday-975-edm", field: "edm_smoke_p975", breaks: BREAKS_BIN, colors: PALETTE_BIN_3, title: "SMO > 97.5th (EDM)", labelParams: LABEL_BIN, decimals: 0, datasets: ["gam-v2", "gam-v2-pred"] },
    { duration: "daily", id: "smokeday-m0p5m", field: "smoke_m0p5m", breaks: BREAKS_BIN, colors: PALETTE_BIN_1, title: "Smoke day (SMD) m0p5m", labelParams: LABEL_BIN, decimals: 0, datasets: ["pm-cbsa", "pm-cbsa-pred"] },
    { duration: "daily", id: "smokeday-m1p0m", field: "smoke_m1p0m", breaks: BREAKS_BIN, colors: PALETTE_BIN_2, title: "Smoke day (SMD) m1p0m", labelParams: LABEL_BIN, decimals: 0, datasets: ["pm-cbsa", "pm-cbsa-pred"] },

    // --- Exceedance Cause (Combined: 0=None, 1=Not Smoke, 2=Smoke) ---
    // 0: Transparent, 1: Blue (#3399ff), 2: Red (#ff3333)
    { duration: "daily", id: "ExcDays", field: "exceedance", breaks: BREAKS_TRI, colors: PALETTE_TRI, title: "Exc. day (> 70 ppb)", labelParams: LABEL_SMO, decimals: 0, datasets: ["gam-v2", "gam-v1", "epa-ember", "gam-v2-pred"] },
    { duration: "daily", id: "ExcDays-edm", field: "edm_exceedance", breaks: BREAKS_TRI, colors: PALETTE_TRI, title: "Exc. day (EDM) (> 70 ppb)", labelParams: LABEL_SMO, decimals: 0, datasets: ["gam-v2", "gam-v2-pred"] },

    // --- Exceedance Cause (PM CBSA) ---
    { duration: "daily", id: "ExcDays-m0p5m", field: "exceedance_m0p5m", breaks: BREAKS_TRI, colors: PALETTE_TRI, title: "Exc. day (m0p5m) (> 9 µg m⁻³)", labelParams: LABEL_SMP, decimals: 0, datasets: ["pm-cbsa", "pm-cbsa-pred"] },
    { duration: "daily", id: "ExcDays-m1p0m", field: "exceedance_m1p0m", breaks: BREAKS_TRI, colors: PALETTE_TRI, title: "Exc. day (m1p0m) (> 9 µg m⁻³)", labelParams: LABEL_SMP, decimals: 0, datasets: ["pm-cbsa", "pm-cbsa-pred"] },

    // --- Satellite data ---
    { duration: "daily", id: "burn", field: "burn", title: "Area burned (km²)", breaks: BREAKS_BURN, colors: PALETTE_BURN, decimals: 1, manualLayer: true },
    { duration: "daily", id: "smoke", field: "smokeLight", category: "light", title: "Smoke area (light) (km²)", breaks: BREAKS_SMOKE, colors: PALETTE_SMOKE, labelParams: LABEL_SMOKE, decimals: 0, manualLayer: true },
    { duration: "daily", id: "smoke", field: "smokeMedium", category: "medium", title: "Smoke area (medium) (km²)", breaks: BREAKS_SMOKE, colors: PALETTE_SMOKE, labelParams: LABEL_SMOKE, decimals: 0, manualLayer: true },
    { duration: "daily", id: "smoke", field: "smokeHeavy", category: "heavy", title: "Smoke area (heavy) (km²)", breaks: BREAKS_SMOKE, colors: PALETTE_SMOKE, labelParams: LABEL_SMOKE, decimals: 0, manualLayer: true },
    { duration: "daily", id: "fire", field: "fireCount", title: "Fire points", breaks: BREAKS_FIRE, colors: PALETTE_JET, decimals: 0, manualLayer: true },
    { duration: "daily", id: "fire", field: "fireFrp", title: "FRP (MW)", breaks: BREAKS_FRP, colors: "#fd8d3c", decimals: 1, manualLayer: true },

    { duration: "hourly", id: "tempo-no2", field: "tempo", title: "TEMPO NO2 VCD", breaks: BREAKS_TEMPO, colors: PALETTE_TEMPO, decimals: 1, manualLayer: true, hourly: true },
    { duration: "hourly", id: "tempo-hcho", field: "tempo", title: "TEMPO HCHO VCD", breaks: BREAKS_TEMPO, colors: PALETTE_TEMPO, decimals: 1, manualLayer: true, hourly: true },
    { duration: "daily", id: "tropomi-no2", field: "tropomi", title: "TROPOMI NO2 VCD", breaks: BREAKS_TEMPO, colors: PALETTE_TEMPO, decimals: 1, manualLayer: true },
    { duration: "daily", id: "tropomi-hcho", field: "tropomi", title: "TROPOMI HCHO VCD", breaks: BREAKS_TEMPO, colors: PALETTE_TEMPO, decimals: 1, manualLayer: true }
];

export const LAYER_DEFS = (() => {
    const defs = {};

    LAYER_TEMPLATES.forEach(tmpl => {
        if (tmpl.manualLayer) {
            if (tmpl.duration && DATA_IMPORT_METHOD[tmpl.id]) {
                DATA_IMPORT_METHOD[tmpl.id].duration = tmpl.duration;
            }
            return;
        }
        const supported = tmpl.datasets || Object.keys(DATASET_SOURCE_MAP);

        supported.forEach(dsKey => {
            if (!DATASET_SOURCE_MAP[dsKey]) return;
            const sourceKey = DATASET_SOURCE_MAP[dsKey];
            const key = (tmpl.id === dsKey) ? tmpl.id : `${tmpl.id}-${dsKey}`;
            const fieldName = typeof tmpl.field === "function" ? tmpl.field(dsKey) : tmpl.field;
            const breaks = typeof tmpl.breaks === "function" ? tmpl.breaks(dsKey) : tmpl.breaks;
            const title = typeof tmpl.title === "function" ? tmpl.title(dsKey) : tmpl.title;

            // Propagate duration to the raw source within DATA_IMPORT_METHOD
            if (tmpl.duration && DATA_IMPORT_METHOD[sourceKey]) {
                DATA_IMPORT_METHOD[sourceKey].duration = tmpl.duration;
            }

            const opts = {
                ...tmpl,
                title,
                labels: tmpl.labelParams,
                dsKey
            };

            defs[key] = getLayerDef(key, sourceKey, fieldName, breaks, tmpl.colors, opts);
        });
    });

    // Satellite data
    const smokeTmpl = LAYER_TEMPLATES.find(t => t.id === "smoke");
    if (smokeTmpl) {
        defs.smoke = {
            layers: [
                {
                    id: "smoke-fill",
                    type: "fill",
                    paint: {
                        "fill-color": [
                            "match", ["get", "category"],
                            smokeTmpl.labelParams[2], smokeTmpl.colors[2],
                            smokeTmpl.labelParams[1], smokeTmpl.colors[1],
                            smokeTmpl.labelParams[0], smokeTmpl.colors[0],
                            "uni", "#d9d9d9",
                            "#f0f0f0"
                        ],
                        "fill-opacity": 0.35
                    }
                },
                {
                    id: "smoke-line",
                    type: "line",
                    paint: { "line-color": "#000000", "line-width": 0.5 }
                }
            ],
            hoverHTML: (p) => generatePopupHTML(p, "smoke"),
            hoverOn: "smoke-fill",
            legend: {
                title: "Smoke Density",
                colors: smokeTmpl.colors,
                labels: smokeTmpl.labelParams
            }
        };
    }

    const fireTmpl = LAYER_TEMPLATES.find(t => t.id === "fire" && t.field === "fireCount");
    const frpTmpl = LAYER_TEMPLATES.find(t => t.id === "fire" && t.field === "fireFrp");

    if (fireTmpl && frpTmpl) {
        const frpRadii = [2, 4, 6, 8, 10];

        defs.fire = {
            layers: [
                {
                    id: "fire-circle",
                    type: "circle",
                    paint: {
                        "circle-radius": makeStepExpr("FRP", frpTmpl.breaks, frpRadii, 0),
                        "circle-color": frpTmpl.colors,
                        "circle-opacity": 1,
                        "circle-stroke-color": "#FFD700",
                        "circle-stroke-width": 2,
                        "circle-stroke-opacity": 1
                    }
                }
            ],
            hoverHTML: (p) => generatePopupHTML(p, "fire"),
            hoverOn: "fire-circle",
            legend: {
                title: fireTmpl.title,
                breaks: fireTmpl.breaks,
                colors: fireTmpl.colors,
                sizeLegend: {
                    title: frpTmpl.title,
                    color: frpTmpl.colors,
                    strokeColor: "#FFD700",
                    items: makeSizeLegendItems(frpTmpl.breaks, frpRadii)
                }
            },
            dsKey: "fire"
        };
    }

    const burnTmpl = LAYER_TEMPLATES.find(t => t.id === "burn");
    if (burnTmpl) {
        defs.burn = {
            layers: [
                { id: "burn-fill", type: "fill", paint: { "fill-color": "#e31a1c", "fill-opacity": 0.8 } },
                { id: "burn-line", type: "line", paint: { "line-color": "#b10026", "line-width": 0.5 } }
            ],
            hoverHTML: (p) => generatePopupHTML(p, "burn"),
            hoverOn: "burn-fill",
            legend: {
                title: burnTmpl.title,
                breaks: burnTmpl.breaks,
                colors: burnTmpl.colors
            }
        };
    }
    
    const tempoTmpl = LAYER_TEMPLATES.find(t => t.id === "tempo-no2");
    if (tempoTmpl) {
        defs["tempo-no2"] = {
            layers: [
                { 
                    id: "tempo-no2-raster", 
                    type: "raster", 
                    source: "tempo-no2", 
                    paint: { 
                        "raster-opacity": 0.9,
                        "raster-resampling": "nearest" // Clean pixels on zoom
                    } 
                }
            ],
            legend: {
                title: tempoTmpl.title,
                breaks: tempoTmpl.breaks,
                colors: tempoTmpl.colors,
                continuous: true,
                unit: "10¹⁴ molecules cm⁻²"
            }
        };
    }
    
    const tempoHchoTmpl = LAYER_TEMPLATES.find(t => t.id === "tempo-hcho");
    if (tempoHchoTmpl) {
        defs["tempo-hcho"] = {
            layers: [
                { 
                    id: "tempo-hcho-raster", 
                    type: "raster", 
                    source: "tempo-hcho", 
                    paint: { 
                        "raster-opacity": 0.9,
                        "raster-resampling": "nearest"
                    } 
                }
            ],
            legend: {
                title: tempoHchoTmpl.title,
                breaks: tempoHchoTmpl.breaks,
                colors: tempoHchoTmpl.colors,
                continuous: true,
                unit: "10¹⁴ molecules cm⁻²"
            }
        };
    }
    
        const tropomiTmpl = LAYER_TEMPLATES.find(t => t.id === "tropomi-no2");
    if (tropomiTmpl) {
        defs["tropomi-no2"] = {
            layers: [
                { 
                    id: "tropomi-no2-raster", 
                    type: "raster", 
                    source: "tropomi-no2", 
                    paint: { 
                        "raster-opacity": 0.9,
                        "raster-resampling": "nearest" 
                    } 
                }
            ],
            legend: {
                title: tropomiTmpl.title,
                breaks: tropomiTmpl.breaks,
                colors: tropomiTmpl.colors,
                continuous: true,
                unit: "10¹⁴ molecules cm⁻²"
            }
        };
    }
    
    const tropomiHchoTmpl = LAYER_TEMPLATES.find(t => t.id === "tropomi-hcho");
    if (tropomiHchoTmpl) {
        defs["tropomi-hcho"] = {
            layers: [
                { 
                    id: "tropomi-hcho-raster", 
                    type: "raster", 
                    source: "tropomi-hcho", 
                    paint: { 
                        "raster-opacity": 0.9,
                        "raster-resampling": "nearest"
                    } 
                }
            ],
            legend: {
                title: tropomiHchoTmpl.title,
                breaks: tropomiHchoTmpl.breaks,
                colors: tropomiHchoTmpl.colors,
                continuous: true,
                unit: "10¹⁴ molecules cm⁻²"
            }
        };
    }
    
    return defs;
})();

