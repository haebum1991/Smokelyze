
/**
 * 인터랙션 및 정보창: 지도 위 지점을 클릭하거나 호버(Hover)했을 때 보여줄 팝업 및 툴팁 내용을 생성
 */
 
import { ESML, formatDate, getEffectiveDataset } from "./utils.js";
import { auth } from "./fb-init.js";
import { ExcludeLayerGroups, LAYER_TEMPLATES } from "./layers-def.js";
import { regionStats, closedLegendIds } from "./layers-state.js";


/**
 * Initialize the global tooltip element and its styles.
 */
export function initGlobalTooltip() {
    if (document.getElementById("MapTooltip")) return;

    const style = document.createElement("style");
    style.innerHTML = `
      #MapTooltip {
        z-index: var(--z-MapTooltip);  
        font-size: 1.6rem;
        
        position: fixed;
        top: var(--header-height-total) !important; 
        left: var(--toolbar-date-width) !important; 
        
        pointer-events: none;
        display: none;
        max-width: 20vw;
        padding: 1rem;
        
        color: var(--text-main);
        background: var(--color-bg);
        border: 0.1rem solid var(--card-shadow);
        border-radius: var(--border-radius-0p8rem);
      }
      
      @media (max-width: 1024px) {
        #MapTooltip { 
          font-size: 1.4rem;
          max-width: 50vw;
          top: calc(var(--header-height-total) + var(--toolbar-date-height)) !important; 
          left: 0 !important;
        }
      }
    `;

    document.head.appendChild(style);
    const tooltipDiv = document.createElement("div");
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
    const rowStyleHead = "margin: 0; font-weight: bold; color: var(--card-shadow); padding-right: 2.8rem;";
    const rowStyle = "margin: 0;";
    const hrStyle = "border: 0.1rem solid black; margin-top: 0.3rem; margin-bottom: 0.3rem;";
    const closeBtn = isLocked ? `
    <button class="action-close-popup ui-btn-close" style="position: absolute; top: 0.8rem; right: 0.8rem;">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>` : "";
    
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
        <div style="max-width: 30rem; padding: 0.5rem; padding-right: 2.8rem;">
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
        <div style="${rowStyle}"><b>Acres:</b> ${ESML(p.DiscoveryAcres)}</div>
        <div style="${rowStyle}"><b>Latitude:</b> ${ESML(smartFmt(p.lat, "lat", dataSource, 3))}</div>
        <div style="${rowStyle}"><b>Longitude:</b> ${ESML(smartFmt(p.lon, "lon", dataSource, 3))}</div>`;
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
        <div style="padding: 0.5rem; font-size: 1.6rem; max-width: 30rem; padding-right: 2.8rem;">
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
    
    // ---- [External data] ----
    if (dataSource === "hysplit" || dataSource.startsWith("hysplit-")) {
        
        // [Safety] Handle alternate property names used in different HYSPLIT iterations
        const dateVal1 = p.date;
        const dateVal2 = p.date2;
        const heightVal = p.height;
        const pressVal = p.pressure;
        
        return `
        ${closeBtn}
        <div style="margin: 0; font-weight: bold; color: ${p.color || "var(--card-shadow)"}; padding-right: 2.8rem;">HYSPLIT Point Info</div>
        <hr style="${hrStyle}">
        <div style="${rowStyle}"><b>Date:</b> ${ESML(dateVal1)} UTC</div>
        <div style="${rowStyle}"><b>Date2:</b> ${ESML(dateVal2)} UTC</div>
        <div style="${rowStyle}"><b>Latitude:</b> ${ESML(smartFmt(p.lat, "lat", dataSource, 3))}</div>
        <div style="${rowStyle}"><b>Longitude:</b> ${ESML(smartFmt(p.lon, "lon", dataSource, 3))}</div>
        <div style="${rowStyle}"><b>AGL:</b> ${ESML(heightVal)}m</div>
        <div style="${rowStyle}"><b>Pressure:</b> ${ESML(pressVal)} hPa</div>
        ${p.q_ug_m3 !== undefined ? `<div style="${rowStyle}"><b>Conc:</b> <b style="color: var(--card-shadow);">${ESML(smartFmt(p.q_ug_m3, "q_ug_m3", dataSource, 3))}</b> ug m⁻³</div>` : ""}
        ${p.q_kg !== undefined ? `<div style="${rowStyle}"><b>Mass:</b> ${ESML(smartFmt(p.q_kg, "q_kg", dataSource, 3))} kg</div>` : ""}`;
    }
    
    if (dataSource === "airnow_hourly" || dataSource.startsWith("airnow-hourly-")) {
        return `
              ${closeBtn}
              <div style="${rowStyleHead}"><b>AirNow (Hourly)</b></div>
              <hr style="${hrStyle}">
              <div style="${rowStyle}"> 
                <b>Obs PM2.5 (hourly) (ug m⁻³):</b> 
                <b style="color: var(--card-shadow);">${ESML(smartFmt(p["pm25(ug/m3)"], "pm25(ug/m3)", dataSource))}</b>
              </div>
              <div style="${rowStyle}"> 
                <b>Obs O3 (hourly) (ppb):</b> 
                <b style="color: var(--card-shadow);">${ESML(smartFmt(p["ozone(ppb)"], "ozone(ppb)", dataSource))}</b>
              </div>
              <div style="${rowStyle}"> 
                <b>Obs NO2 (hourly) (ppb):</b> 
                <b style="color: var(--card-shadow);">${ESML(smartFmt(p["no2(ppb)"], "no2(ppb)", dataSource))}</b>
              </div>
              <hr style="${hrStyle}">
              <div style="${rowStyle}"><b>State:</b> ${ESML(p["state"] || "NA")}</div>
              <div style="${rowStyle}"><b>AQS:</b> ${ESML(p["AQS"] || "NA")}</div>
              <div style="${rowStyle}"><b>Latitude:</b> ${ESML(smartFmt(p["lat"], "lat", dataSource, 3))}</div>
              <div style="${rowStyle}"><b>Longitude:</b> ${ESML(smartFmt(p["lon"], "lon", dataSource, 3))}</div>
              <div style="${rowStyle}"><b>Timestamp:</b> ${ESML(p["current_hour_str"] || "NA")}</div>
          `;
    }
    
    if (dataSource === "airnow_daily") {
      let AirnowHtml = `
            ${closeBtn}
            <div style="${rowStyleHead}"><b>AirNow (Daily)</b></div>
            <hr style="${hrStyle}">
            `;
      
      // Always show MDA8 O3 (NA if missing)
      const mda8Value = (p["MDA8O3"] !== undefined && p["MDA8O3"] !== null)
        ? ESML(smartFmt(p["MDA8O3"], "MDA8O3", dataSource))
        : "NA";
      AirnowHtml += `
            <div style="${rowStyle}"> 
              <b>Obs MDA8 (ppb):</b> 
              <b style="color: var(--card-shadow);">
                ${mda8Value}
              </b>
            </div>
            `;
            
      // Always show PM2.5 (NA if missing)
      const pm25Value = (p["PM2.5"] !== undefined && p["PM2.5"] !== null)
        ? ESML(smartFmt(p["PM2.5"], "PM2.5", dataSource))
        : "NA";
      AirnowHtml += `
            <div style="${rowStyle}"> 
              <b>Obs PM2.5 (ug m⁻³):</b> 
              <b style="color: var(--card-shadow);">
                ${pm25Value}
              </b>
            </div>
            `;

      return AirnowHtml += `
            <hr style="${hrStyle}">
            <div style="${rowStyle}"><b>State:</b> ${ESML(p["state"] || "NA")}</div>
            <div style="${rowStyle}"><b>AQS:</b> ${ESML(p["AQS"] || "NA")}</div>
            <div style="${rowStyle}"><b>Site name:</b> ${ESML(p["site_name"] || "NA")}</div>
            <div style="${rowStyle}"><b>Latitude:</b> ${ESML(smartFmt(p["lat"], "lat", dataSource, 3))}</div>
            <div style="${rowStyle}"><b>Longitude:</b> ${ESML(smartFmt(p["lon"], "lon", dataSource, 3))}</div>
            <div style="${rowStyle}"><b>Timestamp:</b> ${ESML(p["date"] || "NA")}</div>
            `;
    }
    
    // ---- [External data] ----
  
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
        <div style="${rowStyle}"><b>Ecosystem:</b> ${ESML(p["Ecosystem"])}</div>
        <div style="${rowStyle}"><b>Latitude:</b> ${ESML(smartFmt(p.lat, "lat", dataSource, 3))}</div>
        <div style="${rowStyle}"><b>Longitude:</b> ${ESML(smartFmt(p.lon, "lon", dataSource, 3))}</div>
        <div style="${rowStyle}"><b>Scan time (UTC):</b> ${ESML((p["ScanTimes"] || "").replace(" UTC", ""))}</div>`;
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
    } else if (dataSource === "pm_cbsa" || dataSource === "pm_cbsa_pred") {
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
    } else if (dataSource === "gam_v2" || dataSource === "gam_v2_pred") {
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
    } else {
      bodyHtml += `
          <hr style="${hrStyle}">
          <div style="${rowStyle};">(No additional details defined for this source)</div>`;
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
    if (closedLegendIds.has(tmpl.id)) return; // 범례가 닫힌 레이어는 툴팁(Hover) 정보에서도 숨깁니다.

    let label = typeof tmpl.title === "function" ? tmpl.title(getEffectiveDataset()) : tmpl.title;
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
  if (checkedIds.includes("layer-burn") && !closedLegendIds.has("burn")) {
    const b = stats.burn || 0;
    bgRows.push(`Area burned (km²): ${ESML(b > 0 ? b.toFixed(1) : "NA")}`);
  }
  if (checkedIds.includes("layer-smoke") && !closedLegendIds.has("smoke")) {
    const sl = stats.smokeLight || 0, sm = stats.smokeMedium || 0, sh = stats.smokeHeavy || 0;
    bgRows.push(`Smoke area-L (km²): ${ESML(sl > 0 ? sl.toLocaleString() : "NA")}`);
    bgRows.push(`Smoke area-M (km²): ${ESML(sm > 0 ? sm.toLocaleString() : "NA")}`);
    bgRows.push(`Smoke area-H (km²): ${ESML(sh > 0 ? sh.toLocaleString() : "NA")}`);
  }
  if (checkedIds.includes("layer-fire") && !closedLegendIds.has("fire")) {
    const fc = stats.fireCount || 0;
    const ff = stats.fireFrp || 0;
    bgRows.push(`Fire points: ${ESML(fc > 0 ? fc.toLocaleString() : "NA")}`);
    bgRows.push(`FRP (MW): ${ESML(ff > 0 ? ff.toFixed(0) : "NA")}`);
  }

  if (bgRows.length > 0) {
    html += `<hr style="${hrStyle}">` + bgRows.map(row => `<div style="${rowStyle}">${row}</div>`).join("");
  }

  return html;
}

