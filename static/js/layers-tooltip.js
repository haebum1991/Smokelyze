
/**
 * 인터랙션 및 정보창: 지도 위 지점을 클릭하거나 호버(Hover)했을 때 보여줄 팝업 및 툴팁 내용을 생성
 */
 
import { ESML, formatDate } from "./utils.js";
import { auth } from "./fb-init.js";
import { ExcludeLayerGroups, LAYER_TEMPLATES } from "./layers-def.js";
import { regionStats } from "./layers-state.js";


/**
 * Initialize the global tooltip element and its styles.
 */
export function initGlobalTooltip() {
    if (document.getElementById("MapTooltip")) return;

    var style = document.createElement("style");
    style.innerHTML = `
      #MapTooltip {
        z-index: var(--z-MapTooltip);  
        font-size: 1.6rem;
        
        position: fixed;
        top: var(--header-height-total) !important; 
        left: 31.7rem !important; 
        
        pointer-events: none;
        display: none;  
        max-width: max-content;
        padding: 1rem;
        
        color: var(--text-main);
        background: var(--color-bg);
        border: 0.1rem solid var(--card-shadow);
        border-radius: var(--border-radius-0p8rem);
      }
      
      .MapTooltip-close-btn {
        z-index: var(--z-MapTooltip);
        
        position: absolute;
        bottom: var(--border-radius-0p8rem);
        right: -2.8rem;
        
        cursor: pointer;
        line-height: 1;
        font-size: 1.6rem;
        font-weight: bold;
        width: 2.8rem;
        height: max-content;
        
        color: var(--color-bg);
        background: var(--card-shadow);
        border-top: 0.1rem solid var(--color-bg);
        border-bottom: 0.1rem solid var(--color-bg);
        border-right: 0.1rem solid var(--color-bg);
        border-left: 0;
        border-radius: 0 var(--border-radius-0p8rem) var(--border-radius-0p8rem) 0;
        padding: 0.8rem 0.4rem;
        
        writing-mode: vertical-rl;
        transition: all 0.2s ease;
      }
      
      .MapTooltip-close-btn:hover {
        filter: brightness(1.2);
      }
      
      @media (max-width: 1024px) {
        #MapTooltip { 
          font-size: 1.4rem;
          max-width: 50vw;
          top: calc(var(--header-height-total) + var(--toolbar-date-height)) !important; 
          left: 0.3rem !important;
        }
      }
    `;

    document.head.appendChild(style);
    var tooltipDiv = document.createElement("div");
    tooltipDiv.id = "MapTooltip";
    document.body.appendChild(tooltipDiv);
}

/**
 * Formats a value safely, returning "NA" for missing data.
 */
export function safeFmt(val, digits) {
    if (val === undefined || val === null || val === "NA") return "NA";
    if (typeof val === "number") return val.toFixed(digits);
    return val;
}

/**
 * Smart format that looks up decimals from LAYER_TEMPLATES
 * @param {*} val - Value to format
 * @param {string} field - Field name to lookup in LAYER_TEMPLATES
 * @param {string} dataSource - Data source name
 * @param {number} defaultDecimals - Default decimals if not found (default: 1)
 * @returns {string} Formatted value
 */
export function smartFmt(val, field, dataSource, defaultDecimals = 1) {
  if (val === undefined || val === null || val === "NA") return "NA";

  // Try to find decimals from LAYER_TEMPLATES
  let decimals = defaultDecimals;

  for (const tmpl of LAYER_TEMPLATES) {
    if (tmpl.field === field || (typeof tmpl.field === "function" && tmpl.field(dataSource) === field)) {
      decimals = tmpl.decimals !== undefined ? tmpl.decimals : defaultDecimals;
      break;
    }
  }

  const num = typeof val === "number" ? val : parseFloat(val);
  if (isNaN(num)) return val;

  return num.toFixed(decimals);
}

/**
 * Generates HTML content for map popups/tooltips based on data source.
 */
export function generatePopupHTML(p, dataSource, isLocked) {
    const rowStyleHead = "margin: 0; font-weight: bold; color: var(--card-shadow);";
    const rowStyle = "margin: 0;";
    const hrStyle = "border: 0.1rem solid black; margin-top: 0.3rem; margin-bottom: 0.3rem;";
    const closeBtn = isLocked ? `<button class="MapTooltip-close-btn action-close-popup">Close</button>` : "";

    const createMetaHeader = () => `
      ${closeBtn}
      <div style="${rowStyle}">[Meta data]</div>
      <div style="${rowStyleHead}">${ESML(p.date || "NA")}</div>
    `;

    if (dataSource === "wildfire_news") {
        const linkButton = isLocked ? `
        <div style="text-align: right;">
          <button class="WFnews-item-link action-read-news" data-link="${ESML(p.link)}">Read</button>
        </div>` : "";
        return `
        <div style="max-width: 30rem; padding: 0.5rem;">
          ${closeBtn}
          <div class="WFnews-item-title" style="font-size: 1.5rem;">${ESML(p.title)}</div>
          <div class="WFnews-item-meta" style="font-size: 1.4rem;">State: ${ESML(p.location)}<br>${ESML(p.published)} UTC</div>
          <hr class="WFnews-item-hr">
          ${linkButton}
        </div>`;
    }

    if (dataSource === "wildfire_nifc") {
        return `
        ${closeBtn}
        <div style="${rowStyleHead}"><b>Incident name:</b> ${ESML(p.IncidentName)}</div>
        <hr style="${hrStyle}">
        <div style="${rowStyle}"><b>ID:</b> ${ESML(p.UniqueFireIdentifier)}</div>
        <div style="${rowStyle}"><b>Discovery time:</b> ${ESML(p.FireDiscoveryDateTime)} UTC</div>
        <div style="${rowStyle}"><b>State:</b> ${ESML(p.state)}</div>
        <div style="${rowStyle}"><b>County:</b> ${ESML(p.POOCounty)}</div>
        <div style="${rowStyle}"><b>Type:</b> ${ESML(p.IncidentTypeCategory)}</div>
        <div style="${rowStyle}"><b>Cause:</b> ${ESML(p.FireCause)}</div>
        <div style="${rowStyle}"><b>Acres:</b> ${ESML(p.DiscoveryAcres)}</div>`;
    }
    
    if (dataSource === "MapPost") {
        const isAuthor = auth.currentUser && auth.currentUser.uid === p.uid;
        const displayText = p.text.length > 300 ? p.text.substring(0, 300) + "..." : p.text;
        const createdVal = p.createdAt;
        const updatedVal = p.timestamp;
        const firstPosted = createdVal ? formatDate(typeof createdVal.toDate === "function" ? createdVal.toDate() : new Date(createdVal)) : "Just now";
        const updatedAt = updatedVal ? formatDate(typeof updatedVal.toDate === "function" ? updatedVal.toDate() : new Date(updatedVal)) : "Just now";
        const linkButton = isLocked ? `
        <div style="text-align: right;">
          <button class="MapPost-item-link clickOnShowDetail" data-id="${ESML(p.docId)}">
            Read
          </button>
        </div>` : "";

        return `
        <div style="padding: 0.5rem; font-size: 1.6rem; max-width: 300px;">
          ${isLocked ? closeBtn : ""}
          ${(isLocked && isAuthor) ? `
              <div class="reply-btn-wrapper">
                  <button class="reply-btn-edit-detail" data-id="${ESML(p.docId)}">Edit</button>
                  <button class="reply-btn-delete-detail" data-id="${ESML(p.docId)}">Delete</button>
              </div>
              <hr class="MapPost-item-hr">
          ` : ""}
          <div class="MapPost-item-title" style="font-size: 1.5rem;">${ESML(p.title)}</div>
          <hr class="MapPost-item-hr">
          <div class="MapPost-item-summary" style="font-size: 1.4rem;">${ESML(displayText)}</div>
          <hr class="MapPost-item-hr">
          <div class="MapPost-item-title" style="font-size: 1.2rem;">
            Author: ${ESML(p.userName || "Anonymous")}<br>
            Target date: ${ESML(p.date)}
          </div>
          <div class="MapPost-item-meta" style="font-size: 1.2rem;">
            Posted: ${ESML(firstPosted)}<br>
            Updated: ${ESML(updatedAt)}
          </div>
          <hr class="MapPost-item-hr">
          ${linkButton}
        </div>
      `;
    }
    
    // ---- [External data] AirNow ----
    if (dataSource.startsWith("airnow-")) {

      let AirnowHtml = `
          ${closeBtn}
          <div style="${rowStyleHead}"><b>AirNow (Hourly)</b></div>
          <hr style="${hrStyle}">
          `;
                    
      if (dataSource === "airnow-pm25") {
          AirnowHtml += `
          <div style="${rowStyle}"> 
            <b>Obs PM2.5 (ug m⁻³):</b> 
            <b style="color: var(--card-shadow);">
              ${ESML(smartFmt(p["pm25(ug/m3)"], "pm25(ug/m3)", dataSource))}
            </b>
          </div>
          <hr style="${hrStyle}">
          <div style="${rowStyle}"><b>Param code:</b> ${ESML(p["paramCode"] || "NA")}</div>
          <div style="${rowStyle}"><b>State:</b> ${ESML(p["state"] || "NA")}</div>
          <div style="${rowStyle}"><b>AQS PM:</b> ${ESML(p["AQS"] || "NA")}</div>
          `;
      }
      
      if (dataSource === "airnow-ozone") {
          AirnowHtml += `
          <div style="${rowStyle}"> 
            <b>Obs O3 (ppb):</b> 
            <b style="color: var(--card-shadow);">
              ${ESML(smartFmt(p["ozone(ppb)"], "ozone(ppb)", dataSource))}
            </b>
          </div>
          <hr style="${hrStyle}">
          <div style="${rowStyle}"><b>Param code:</b> ${ESML(p["paramCode"] || "NA")}</div>
          <div style="${rowStyle}"><b>State:</b> ${ESML(p["state"] || "NA")}</div>
          <div style="${rowStyle}"><b>AQS O3:</b> ${ESML(p["AQS"] || "NA")}</div>
          `;
      }

      if (dataSource === "airnow-no2") {
          AirnowHtml += `
          <div style="${rowStyle}"> 
            <b>Obs NO2 (ppb):</b> 
            <b style="color: var(--card-shadow);">
              ${ESML(smartFmt(p["no2(ppb)"], "no2(ppb)", dataSource))}
            </b>
          </div>
          <hr style="${hrStyle}">
          <div style="${rowStyle}"><b>Param code:</b> ${ESML(p["paramCode"] || "NA")}</div>
          <div style="${rowStyle}"><b>State:</b> ${ESML(p["state"] || "NA")}</div>
          <div style="${rowStyle}"><b>AQS NO2:</b> ${ESML(p["AQS"] || "NA")}</div>
          `;
      }
      
      return AirnowHtml += `
          <div style="${rowStyle}"><b>Latitude:</b> ${ESML(smartFmt(p["latitude(deg)"], "latitude(deg)", dataSource, 3))}</div>
          <div style="${rowStyle}"><b>Longitude:</b> ${ESML(smartFmt(p["longitude(deg)"], "longitude(deg)", dataSource, 3))}</div>
          <div style="${rowStyle}"><b>Timestamp:</b> ${ESML(p["timestamp(utc)"] || "NA")}</div>
          `;
    }
    // ---- [External data] AirNow ----
  
    if (dataSource === "smoke") {
        return `
        ${closeBtn}
        <div style="${rowStyleHead}"><b>HMS-smoke</b></div>
        <hr style="${hrStyle}">
        <div style="${rowStyle}"><b>Density:</b> <b style="color: var(--card-shadow)";>${ESML(p["category"])}</b></div>`;
    }
    
    if (dataSource === "fire") {
        return `
        ${closeBtn}
        <div style="${rowStyleHead}"><b>HMS-fire point</b></div>
        <hr style="${hrStyle}">
        <div style="${rowStyle}"><b>FRP (MW):</b> <b style="color: var(--card-shadow)";>${ESML(String(p["FRP"]))}</b></div>
        <div style="${rowStyle}"><b>Method:</b> ${ESML(p["Method"])}</div>
        <div style="${rowStyle}"><b>Satellite:</b> ${ESML(p["Satellite"])}</div>
        <div style="${rowStyle}"><b>Ecosystem:</b> ${ESML(p["Ecosystem"])}</div>`;
    }
    
    if (dataSource === "burn") {
        return `
        ${closeBtn}
        <div style="${rowStyleHead}"><b>MODIS area burned</b></div>
        <hr style="${hrStyle}">
        <div style="${rowStyle}"><b>Region:</b> ${ESML(p.ID)}</div>
        <div style="${rowStyle}"><b>Area burned (km²):</b> <b style="color: var(--card-shadow)";>${ESML(p.area_km2)}</b></div>`;
    }

    let bodyHtml = `<div style="${rowStyle}">Data source: ${ESML(p.source || dataSource)}</div>
                    <hr style="${hrStyle}">
                    <div style="${rowStyle}">State: ${ESML(p.state || "NA")}</div>`;

    if (dataSource === "epa_ember") {
      bodyHtml += `
          <div style="${rowStyle}">AQS O3: ${ESML(p["AQS_O3"] || "NA")}</div>
          <div style="${rowStyle}">Site name: ${ESML(p["site_name"] || "NA")}</div>
          <div style="${rowStyle}">Longitude: ${ESML(smartFmt(p["lon"], "lon", dataSource, 3))}</div>
          <div style="${rowStyle}">Latitude: ${ESML(smartFmt(p["lat"], "lat", dataSource, 3))}</div>
          <hr style="${hrStyle}">
          <div style="${rowStyle}">Days with SMO>0: ${ESML(smartFmt(p["smoke"], "smoke", dataSource))}</div>
          <hr style="${hrStyle}">
          <div style="${rowStyle}">Obs MDA8 (ppb): ${ESML(smartFmt(p["MDA8O3"], "MDA8O3", dataSource))}</div>
          <div style="${rowStyle}">Pred MDA8 (ppb): ${ESML(smartFmt(p["MDA8O3_pred"], "MDA8O3_pred", dataSource))}</div>
          <div style="${rowStyle}">Residual (ppb): ${ESML(smartFmt(p["MDA8O3_resids"], "MDA8O3_resids", dataSource))}</div>
          <div style="${rowStyle}">SMO (ppb): ${ESML(smartFmt(p["SMO"], "SMO", dataSource))}</div>
          <hr style="${hrStyle}">`;
    } else if (dataSource === "pm_cbsa") {
      bodyHtml += `
          <div style="${rowStyle}">AQS PM: ${ESML(p["AQS_PM"] || "NA")}</div>
          <div style="${rowStyle}">Site name: ${ESML(p["site_name"] || "NA")}</div>
          <div style="${rowStyle}">Longitude: ${ESML(smartFmt(p["lon"], "lon", dataSource, 3))}</div>
          <div style="${rowStyle}">Latitude: ${ESML(smartFmt(p["lat"], "lat", dataSource, 3))}</div>
          <hr style="${hrStyle}">
          <div style="${rowStyle}">HMS: ${ESML(smartFmt(p["HMS"], "HMS", dataSource, 0))}</div>
          <div style="${rowStyle}">Smoke m0p5m: ${ESML(smartFmt(p["smoke_m0p5m"], "smoke_m0p5m", dataSource))}</div>
          <div style="${rowStyle}">Smoke m1p0m: ${ESML(smartFmt(p["smoke_m1p0m"], "smoke_m1p0m", dataSource))}</div>
          <hr style="${hrStyle}">
          <div style="${rowStyle}">Obs PM2.5 (ug m⁻³): ${ESML(smartFmt(p["PM2.5"], "PM2.5", dataSource))}</div>
          <div style="${rowStyle}">Quantile of PM2.5 (%): ${ESML(smartFmt(p["Quant_PM2.5"], "Quant_PM2.5", dataSource))}</div>
          <div style="${rowStyle}">PM2.5-Crit m0p5m (ug m⁻³): ${ESML(smartFmt(p["PM2.5_Crit_m0p5m"], "PM2.5_Crit_m0p5m", dataSource))}</div>
          <div style="${rowStyle}">PM2.5-Crit m1p0m (ug m⁻³): ${ESML(smartFmt(p["PM2.5_Crit_m1p0m"], "PM2.5_Crit_m1p0m", dataSource))}</div>
          <div style="${rowStyle}">Smoke PM2.5 m0p5m (ug m⁻³): ${ESML(smartFmt(p["smoke_PM2.5_m0p5m"], "smoke_PM2.5_m0p5m", dataSource))}</div>
          <div style="${rowStyle}">Smoke PM2.5 m1p0m (ug m⁻³): ${ESML(smartFmt(p["smoke_PM2.5_m1p0m"], "smoke_PM2.5_m1p0m", dataSource))}</div>`;
    } else if (dataSource === "gam_v1") {
      bodyHtml += `
          <div style="${rowStyle}">AQS O3: ${ESML(p["AQS_O3"] || "NA")}</div>
          <div style="${rowStyle}">Site name: ${ESML(p["site_name"] || "NA")}</div>
          <div style="${rowStyle}">Longitude: ${ESML(smartFmt(p["lon"], "lon", dataSource, 3))}</div>
          <div style="${rowStyle}">Latitude: ${ESML(smartFmt(p["lat"], "lat", dataSource, 3))}</div>
          <hr style="${hrStyle}">
          <div style="${rowStyle}">HMS: ${ESML(smartFmt(p["HMS"], "HMS", dataSource, 0))}</div>
          <div style="${rowStyle}">Smoke: ${ESML(smartFmt(p["smoke"], "smoke", dataSource))}</div>
          <hr style="${hrStyle}">
          <div style="${rowStyle}">Obs MDA8 (ppb): ${ESML(smartFmt(p["MDA8O3"], "MDA8O3", dataSource))}</div>
          <div style="${rowStyle}">Pred MDA8 (ppb): ${ESML(smartFmt(p["MDA8O3_pred"], "MDA8O3_pred", dataSource))}</div>
          <div style="${rowStyle}">Residual (ppb): ${ESML(smartFmt(p["MDA8O3_resids"], "MDA8O3_resids", dataSource))}</div>
          <div style="${rowStyle}">Quantile of residual (%): ${ESML(smartFmt(p.Quant_MDA8O3_resids, "Quant_MDA8O3_resids", dataSource))}</div>
          <div style="${rowStyle}">SMO (ppb): ${ESML(smartFmt(p["SMO"], "SMO", dataSource))}</div>
          <hr style="${hrStyle}">
          <div style="${rowStyle}">AQS PM: ${ESML(p["AQS_PM"] || "NA")}</div>
          <div style="${rowStyle}">Obs PM2.5 (ug m⁻³): ${ESML(smartFmt(p["PM2.5"], "PM2.5", dataSource))}</div>
          <div style="${rowStyle}">Quantile of PM2.5 (%): ${ESML(smartFmt(p["Quant_PM2.5"], "Quant_PM2.5", dataSource))}</div>
          <div style="${rowStyle}">PM2.5-Crit (ug m⁻³): ${ESML(smartFmt(p["PM2.5_Crit"], "PM2.5_Crit", dataSource))}</div>
          <hr style="${hrStyle}">
          <div style="${rowStyle}">TMAX (°C): ${ESML(smartFmt(p["TMAX"], "TMAX", dataSource))}</div>
          <div style="${rowStyle}">SRAD (W m⁻²): ${ESML(smartFmt(p["SRAD"], "SRAD", dataSource))}</div>`;
    } else {
      bodyHtml += `
          <div style="${rowStyle}">AQS O3: ${ESML(p["AQS_O3"] || "NA")}</div>
          <div style="${rowStyle}">Site name: ${ESML(p["site_name"] || "NA")}</div>
          <div style="${rowStyle}">Longitude: ${ESML(smartFmt(p["lon"], "lon", dataSource, 3))}</div>
          <div style="${rowStyle}">Latitude: ${ESML(smartFmt(p["lat"], "lat", dataSource, 3))}</div>
          <hr style="${hrStyle}">
          <div style="${rowStyle}">HMS: ${ESML(smartFmt(p["HMS"], "HMS", dataSource, 0))}</div>
          <div style="${rowStyle}">Smoke: ${ESML(smartFmt(p["smoke"], "smoke", dataSource))}</div>
          <hr style="${hrStyle}">
          <div style="${rowStyle}">Obs MDA8 (ppb): ${ESML(smartFmt(p["MDA8O3"], "MDA8O3", dataSource))}</div>
          <div style="${rowStyle}">Pred MDA8 (ppb): ${ESML(smartFmt(p["MDA8O3_pred"], "MDA8O3_pred", dataSource))}</div>
          <div style="${rowStyle}">Residual (ppb): ${ESML(smartFmt(p["MDA8O3_resids"], "MDA8O3_resids", dataSource))}</div>
          <div style="${rowStyle}">Quantile of residual (%): ${ESML(smartFmt(p.Quant_MDA8O3_resids, "Quant_MDA8O3_resids", dataSource))}</div>
          <div style="${rowStyle}">SMO (ppb): ${ESML(smartFmt(p["SMO"], "SMO", dataSource))}</div>
          <div style="${rowStyle}">Pred MDA8 (EDM) (ppb): ${ESML(smartFmt(p.edm_MDA8O3_pred, "edm_MDA8O3_pred", dataSource))}</div>
          <div style="${rowStyle}">Residual (EDM) (ppb): ${ESML(smartFmt(p.edm_MDA8O3_resids, "edm_MDA8O3_resids", dataSource))}</div>
          <div style="${rowStyle}">Quantile of residual (EDM) (%): ${ESML(smartFmt(p.edm_Quant_MDA8O3_resids, "edm_Quant_MDA8O3_resids", dataSource))}</div>
          <div style="${rowStyle}">SMO (EDM) (ppb): ${ESML(smartFmt(p.edm_SMO, "edm_SMO", dataSource))}</div>
          <hr style="${hrStyle}">
          <div style="${rowStyle}">AQS PM: ${ESML(p["AQS_PM"] || "NA")}</div>
          <div style="${rowStyle}">Obs PM2.5 (ug m⁻³): ${ESML(smartFmt(p["PM2.5"], "PM2.5", dataSource))}</div>
          <div style="${rowStyle}">Quantile of PM2.5 (%): ${ESML(smartFmt(p["Quant_PM2.5"], "Quant_PM2.5", dataSource))}</div>
          <div style="${rowStyle}">PM2.5-Crit (ug m⁻³): ${ESML(smartFmt(p["PM2.5_Crit"], "PM2.5_Crit", dataSource))}</div>
          <hr style="${hrStyle}">
          <div style="${rowStyle}">TMAX (K): ${ESML(smartFmt(p["T2MAX"], "T2MAX", dataSource))}</div>
          <div style="${rowStyle}">SRAD (W m⁻²): ${ESML(smartFmt(p["SRAD"], "SRAD", dataSource))}</div>`;
    }

    return createMetaHeader() + bodyHtml;
}


/**
 * Generates HTML content for state/region hover popups.
 */
export function stateHoverHTML(p, _cachedActiveLayerIds) {
  const rowStyle = "margin: 0; font-size: 1.5rem; line-height: 1.5;";
  const hrStyle = "border: 0; border-top: 0.1rem solid #ccc; margin: 0.4rem 0;";
  const id = p.ID || "Region";
  const stats = regionStats?.[id];

  let html = `<div style="${rowStyle}"><b>${ESML(id)}</b></div>`;
  if (!stats) return html;

  const checkedIds = _cachedActiveLayerIds;
  const EXCLUDED = ExcludeLayerGroups.stateHover;

  let layerRows = "";
  LAYER_TEMPLATES.forEach(tmpl => {
    if (tmpl.manualLayer) return;
    if (!checkedIds.includes("layer-" + tmpl.id) || EXCLUDED.includes(tmpl.id)) return;

    let label = typeof tmpl.title === "function" ? tmpl.title(document.getElementById("MapDataSelect")?.value) : tmpl.title;
    if (tmpl.id === "tmax" && stats.label_display) label = stats.label_display;

    if (tmpl.id.startsWith("ExcDays") && tmpl.labelParams) {
      const c1 = stats[tmpl.id + "_c1"] || 0;
      const c2 = stats[tmpl.id + "_c2"] || 0;
      layerRows += `<div style="${rowStyle}">${ESML(label)}: ${c1 + c2}</div>`;
      layerRows += `<div style="${rowStyle}; margin-left: 1rem;">• ${ESML(tmpl.labelParams[0])}: ${c1}</div>`;
      layerRows += `<div style="${rowStyle}; margin-left: 1rem;">• ${ESML(tmpl.labelParams[1])}: ${c2}</div>`;
    } else {
      const rawValue = stats[tmpl.id];
      const val = (typeof rawValue === "number" && isFinite(rawValue)) ? rawValue.toFixed(tmpl.decimals) : (rawValue || "NA");
      layerRows += `<div style="${rowStyle}">${ESML(label)}: ${ESML(String(val))}</div>`;
    }
  });

  if (layerRows) html += `<hr style="${hrStyle}">${layerRows}`;

  const bgRows = [];
  if (checkedIds.includes("layer-burn")) {
    const b = stats.burn || 0;
    bgRows.push(`Area burned (km²): ${b > 0 ? b.toFixed(1) : "NA"}`);
  }
  if (checkedIds.includes("layer-smoke")) {
    const sl = stats.smokeLight || 0, sm = stats.smokeMedium || 0, sh = stats.smokeHeavy || 0;
    bgRows.push(`Smoke area-L (km²): ${sl > 0 ? sl.toLocaleString() : "NA"}`);
    bgRows.push(`Smoke area-M (km²): ${sm > 0 ? sm.toLocaleString() : "NA"}`);
    bgRows.push(`Smoke area-H (km²): ${sh > 0 ? sh.toLocaleString() : "NA"}`);
  }
  if (checkedIds.includes("layer-fire")) {
    const fc = stats.fireCount || 0;
    const ff = stats.fireFrp || 0;
    bgRows.push(`Fire points: ${fc > 0 ? fc.toLocaleString() : "NA"}`);
    bgRows.push(`FRP (MW): ${ff > 0 ? ff.toFixed(0) : "NA"}`);
  }

  if (bgRows.length > 0) {
    html += `<hr style="${hrStyle}">` + bgRows.map(row => `<div style="${rowStyle}">${row}</div>`).join("");
  }

  return html;
}

