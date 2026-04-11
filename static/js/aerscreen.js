
/**
 * Smokelyze AERSCREEN Integration Module
 * Handles communication with the Go-based EPA AERSCREEN API.
 */
import { auth } from "./fb-init.js";
import { map } from "./map-init.js";
import { showErrorToast, showTaskNotification } from "./loader-ui.js";
import * as utils from "./utils.js";
import { setAerscreenDrawer } from "./ui-toggles.js";

const AERSCREEN_CONFIG = {
    API_URL: "https://fetch-aerscreen-go-service-1068523865415.us-central1.run.app/api/dispersion/aerscreen"
};

export const AerscreenTool = {
    isRunning: false,
    abortController: null,
    lastResult: null,

    /**
     * Unified visibility logic for AERSCREEN UI
     */
    updateVisibility() {
        const modeSelect = document.getElementById("AerscreenMode");
        const simplifiedParams = document.getElementById("AerscreenSimplifiedParams");
        const aerscreenParams = document.getElementById("AerscreenParams");
        const viewBtn = document.getElementById("AerscreenBtnViewResult");

        if (modeSelect && modeSelect.value === "aerscreen") {
            if (simplifiedParams) simplifiedParams.style.display = "none";
            if (aerscreenParams) aerscreenParams.style.display = "block";
            // Show result button only for EPA Aerscreen type that has data
            const hasAerscreenRes = this.lastResult && this.lastResult.isAerscreen;
            if (viewBtn) viewBtn.style.display = hasAerscreenRes ? "block" : "none";
        } else {
            if (simplifiedParams) simplifiedParams.style.display = "block";
            if (aerscreenParams) aerscreenParams.style.display = "none";
            // Always hide result button for Simplified Gaussian
            if (viewBtn) viewBtn.style.display = "none";
        }
    },

    /**
     * Calls the backend AERSCREEN API
     * @param {Object} params - Emission parameters from the UI
     */
    async runAnalysis(params) {
        if (this.isRunning) {
            if (showErrorToast) showErrorToast("AERSCREEN is currently running... please wait.", "warning");
            return;
        }

        // Let user know we are working (UI Feedback)
        this.isRunning = true;
        this.abortController = new AbortController();
        this.showLoading(true);

        const task = showTaskNotification("AERSCREEN Analysis", "Requesting dispersion from EPA engine...");

        try {
            // Map the internal params to the API request format
            const apiParams = {
                emission_rate: params.emission_rate || 500.0,
                stack_height: params.effective_height || 10.0,
                stack_diameter: params.stack_diameter || 5.0,
                stack_temp: params.stack_temp || 500.0,
                stack_velocity: params.stack_velocity || 5.0,
                ambient_temp: params.ambient_temp || 293.15,
                terrain_type: (params.terrain || "rural").toUpperCase(),

                // Allow overriding any of the newly added AERSCREEN parameters (Building, Makemet, Terrain, etc.)
                bld_downwash: params.bld_downwash,
                bld_height: params.bld_height,
                bld_min_dim: params.bld_min_dim,
                bld_max_dim: params.bld_max_dim,
                bld_angle: params.bld_angle,
                bld_x: params.bld_x,
                bld_y: params.bld_y,

                min_ambient_temp: params.min_ambient_temp,
                max_ambient_temp: params.max_ambient_temp,
                min_wind_speed: params.min_wind_speed,
                anemometer_ht: params.anemometer_ht,
                surface_albedo: params.surface_albedo,
                surface_bowen: params.surface_bowen,
                surface_roughness: params.surface_roughness,

                use_terrain: params.use_terrain,
                source_elevation: params.source_elevation,
                prof_base: params.prof_base,
                terrain_type_num: params.terrain_type_num,
                utm_zone_num: params.utm_zone_num,
                probe_distance: params.probe_distance,
                flagpole_height: params.flagpole_height,
                run_aermap: params.run_aermap,

                metric: params.metric,
                population: params.population,
                scaling_factor: params.scaling_factor,
                use_discrete_rec: params.use_discrete_rec,
                ambient_distance: params.ambient_distance,

                // NO2 Chemistry (NEW)
                no2_option: params.no2_option,
                no2_stack_ratio: params.no2_stack_ratio,
                ozone_units: params.ozone_units,
                ozone_value: params.ozone_value,

                use_fumigation: params.use_fumigation,
                shoreline: params.shoreline,
                shoreline_dist: params.shoreline_dist,
                shoreline_dir: params.shoreline_dir,
                fumigation_y: params.fumigation_y,
                debug_option: params.debug_option,
                lat: params.lat,
                lon: params.lon
            };

            // ----------------------------------------------------
            // [PREMIUM SECURITY LOCK] - Send Auth Token
            // ----------------------------------------------------
            let idToken = "guest_token_placeholder";
            if (auth && auth.currentUser) {
                try {
                    idToken = await auth.currentUser.getIdToken(true);
                } catch (e) {
                    console.warn("Failed to get instance Auth token:", e);
                }
            } else {
                throw new Error("You must be logged in to use AERSCREEN.");
            }

            const response = await fetch(AERSCREEN_CONFIG.API_URL, {
                method: "POST",
                signal: this.abortController.signal,
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${idToken}`
                },
                body: JSON.stringify(apiParams)
            });

            if (!response.ok) {
                task.update(`Failed: ${response.statusText}`, "error");
                throw new Error(`API Error: ${response.statusText}`);
            }

            const result = await response.json();
            console.log("AERSCREEN Result:", result);

            task.update("Simulation complete!", "success");
            this.handleSuccess(result, params);
        } catch (error) {
            if (error.name === "AbortError") {
                console.log("AERSCREEN: Analysis aborted by user.");
                task.update("Analysis aborted", "error");
            } else {
                console.error("AERSCREEN Failed:", error);
                task.update(`Failed: ${error.message}`, "error");
                if (showErrorToast) {
                    showErrorToast(`AERSCREEN Failed: ${error.message}`, "error");
                } else {
                    alert(`AERSCREEN Analysis Failed: ${error.message}`);
                }
            }
        } finally {
            this.isRunning = false;
            this.abortController = null;
            this.showLoading(false);
        }
    },

    /**
     * Aborts the currently running analysis
     */
    abortAnalysis() {
        if (this.isRunning && this.abortController) {
            this.abortController.abort();
            this.isRunning = false;
            this.abortController = null;
            this.showLoading(false);
        }
    },

    /**
     * Handles successful API response and updates the UI
     */
    handleSuccess(result, params) {
        if (result.status === "ERROR") {
            // Enhanced error display for diagnostics
            const errorMsg = result.error || "Unknown Engine Error";
            alert("AERSCREEN Engine Error: " + errorMsg);

            // Log to console for deep debugging
            console.group("AERSCREEN Engine Failure Details");
            console.error(errorMsg);
            console.groupEnd();
            return;
        }

        // 1. Show results in a popup or panel
        result.isAerscreen = true;
        this.lastResult = result;
        const viewBtn = document.getElementById("AerscreenBtnViewResult");
        if (viewBtn) viewBtn.style.display = "block";
        this.displayResultPanel(result);

        // 2. Add to history
        const runId = Date.now();
        aerscreenHistory.unshift({
            runId: runId,
            params: params,
            maxConc: result.max_concentration,
            maxDistKm: result.distance_to_max / 1000,
            peakPoint: result, // Store the full result for peak marker
            visible: true,
            type: "aerscreen"
        });

        if (aerscreenHistory.length > 10) aerscreenHistory.pop();
        saveToStorage();
        updateAerscreenDrawerList();

        // [INITIAL FOCUS] Automatically jump to the emission source location ONLY upon first creation
        const sourceLon = params.lon;
        const sourceLat = params.lat;
        if (map && sourceLon && sourceLat) {
            map.flyTo({ center: [sourceLon, sourceLat], zoom: 11, speed: 1.5 });
        }

        // 3. Add visual marker on the map for the Peak Concentration point
        try {
            markPeakOnMap(runId, result, params);
        } catch (e) {
            console.warn("AERSCREEN: Map marker failed (non-critical):", e.message);
        }
    },

    /**
     * Displays a clean results table
     */
    displayResultPanel(result) {
        const panelId = "AerscreenResultOverlay";
        let panel = document.getElementById(panelId);

        if (!panel) {
            panel = document.createElement("div");
            panel.id = panelId;
            panel.className = "MapPost-modal-overlay";
            panel.style.zIndex = "calc(var(--z-highest) + 1)";
            document.body.appendChild(panel);
        }

        panel.style.display = "flex";

        panel.innerHTML = `
            <div class="MapPost-modal">
                <div class="MapPost-modal-header">
                    <h3>
                        ${result.execution_time_sec < 0.1 ? 'Simplified Gaussian Results' : 'EPA AERSCREEN Results'}
                    </h3>
                    <button class="ui-btn-close" onclick="document.getElementById('${panelId}').style.display = 'none';">
                        <svg width="20" height="20">
                            <use xlink:href="#icon-close" />
                        </svg>
                    </button>
                </div>
                <div class="MapPost-modal-body">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                        <div style="padding: 1.5rem; border-radius: var(--border-radius-0p8rem); display: flex; flex-direction: column; justify-content: center;">
                            <div style="color: var(--text-main); font-size: 1.1rem; text-transform: uppercase; font-weight: bold; margin-bottom: 0.5rem;">Max ground concentration</div>
                            <div style="font-size: 2.2rem; font-weight: bold; color: var(--card-shadow);">
                                ${result.max_concentration.toFixed(2)} <span style="font-size: 1.3rem; font-weight: bold; color: var(--text-main);">ug m-3</span>
                            </div>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                            <div style="padding: 1.5rem; background: var(--sidebar-widget-bg); border-radius: var(--border-radius-0p8rem); border: 0.1rem solid var(--border-main); display: flex; flex-direction: column; justify-content: center;">
                                <div style="color: var(--text-main); font-size: 1.1rem; font-weight: bold;">Distance to Max</div>
                                <div style="color: var(--card-shadow); font-size: 1.8rem; font-weight: bold; margin-top: 0.5rem;">${(result.distance_to_max / 1000).toFixed(2)} km</div>
                            </div>
                            <div style="padding: 1.5rem; background: var(--sidebar-widget-bg); border-radius: var(--border-radius-0p8rem); border: 0.1rem solid var(--border-main); display: flex; flex-direction: column; justify-content: center;">
                                <div style="color: var(--text-main); font-size: 1.1rem; font-weight: bold;">Execution Time</div>
                                <div style="color: var(--card-shadow); font-size: 1.8rem; font-weight: bold; margin-top: 0.5rem;">${result.execution_time_sec.toFixed(2)}s</div>
                            </div>
                        </div>
                    </div>
                    
                    <div style="margin-top: 2rem;">
                        <div style="color: var(--text-main); font-size: 1.1rem; font-weight: bold; margin-bottom: 0.8rem; text-transform: uppercase;">AERSCREEN.OUT Summary</div>
                        <pre style="background: var(--sidebar-widget-bg); color: var(--text-main); padding: 1.5rem; border-radius: var(--border-radius-0p8rem); border: 0.1rem solid var(--border-main); font-size: 1.1rem; height: 35rem; overflow-y: auto; overflow-x: auto; font-family: monospace; font-weight: bold; line-height: 1.4; white-space: pre;">${result.output_summary ? result.output_summary : 'No explicit engine output was returned.'}</pre>
                    </div>

                    <div style="margin-top: 1.5rem; font-size: 1.1rem; color: var(--text-main); padding: 1.5rem; background: rgba(255,255,255,0.05); border-radius: var(--border-radius-0p8rem); line-height: 1.6; border: 0.1rem solid var(--border-main);">
                        <div style="font-weight: bold; color: var(--card-shadow); margin-bottom: 0.8rem; font-size: 1.2rem;">How to interpret this result:</div>
                        <ul style="margin: 0; padding-left: 1.5rem; display: flex; flex-direction: column; gap: 0.8rem;">
                            <li><strong>Worst-Case Scenario:</strong> AERSCREEN is a conservative screening model. It artificially tests every possible bad weather condition (stagnant air, poor dispersion) to find the absolute worst-case impact.</li>
                            <li><strong>Safety Threshold:</strong> If the <strong>Max ground concentration (${result.max_concentration.toFixed(1)} ug m-3)</strong> is well below regulatory limits (e.g., NAAQS PM2.5 daily standard of 35 ug m-3), you can confidently conclude the emissions source is safe without needing a costly, full-year meteorology AERMOD run.</li>
                            <li><strong>Plume Touchdown:</strong> The pollutant plume doesn't hit the ground immediately. Due to stack height and velocity, the worst air quality occurs exactly <strong>${(result.distance_to_max / 1000).toFixed(2)} km</strong> away from the source coordinate.</li>
                        </ul>
                    </div>

                    <div style="margin-top: 1.5rem; font-size: 1.1rem; color: var(--text-main); padding: 1.2rem; background: rgba(0,0,0,0.03); border-radius: var(--border-radius-0p8rem); line-height: 1.5; font-weight: bold;">
                        <strong>Engine Details:</strong> Calculated by official EPA AERMOD (v24142) wrapped in AERSCREEN (v21112) running on Alpine Linux.
                    </div>
                </div>
            </div>
        `;
    },

    showLoading(show) {
        const btn = document.getElementById("AerscreenBtnRun");
        if (!btn) return;

        if (show) {
            // Keep enabled so we can show "Already running" toast if user clicks again
            btn.disabled = false;
            btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Simulating...`;
            btn.style.opacity = "0.7";
        } else {
            btn.disabled = false;
            btn.innerHTML = `Run Simulation`;
            btn.style.opacity = "1";
        }
    }
};

// --- Dispersion Screening Logic ---
/**
 * Dispersion Screening Module
 * 
 * A standalone, frontend-only Gaussian puff/plume screening tool for
 * preliminary assessment of wildfire smoke impacts at receptor locations.
 * 
 * Scientific basis:
 *   - Gaussian dispersion equations (Turner, 1970; Seinfeld & Pandis, 2016)
 *   - Briggs plume rise formulas (Briggs, 1969, 1971, 1975)
 *   - Pasquill-Gifford-Turner dispersion coefficients (Turner, 1970)
 * 
 * DISCLAIMER: This tool provides screening-level estimates only.
 * Results should NOT substitute for EPA-approved regulatory modeling
 * (AERMOD/CALPUFF) in Exceptional Event Demonstrations or permit applications.
 * 
 * @author Smokelyze / Lee & Jaffe Research Group
 */

// ============================================================
// Section 1: Physical Constants & Lookup Tables
// ============================================================

/** Briggs urban dispersion parameters (σy, σz) */
const BRIGGS_URBAN = {
    "A-B": { ay: 0.32, by: 0.0004, az: 0.24, bz: 0.001 },
    "C": { ay: 0.22, by: 0.0004, az: 0.20, bz: 0.0 },
    "D": { ay: 0.16, by: 0.0004, az: 0.14, bz: 0.0003 },
    "E-F": { ay: 0.11, by: 0.0004, az: 0.08, bz: 0.00015 }
};

/** Briggs rural (open terrain) dispersion parameters */
const BRIGGS_RURAL = {
    "A": { ay: 0.22, by: 0.0001, az: 0.20, bz: 0.0 },
    "B": { ay: 0.16, by: 0.0001, az: 0.12, bz: 0.0 },
    "C": { ay: 0.11, by: 0.0001, az: 0.08, bz: 0.0002 },
    "D": { ay: 0.08, by: 0.0001, az: 0.06, bz: 0.0015 },
    "E": { ay: 0.06, by: 0.0001, az: 0.03, bz: 0.0003 },
    "F": { ay: 0.04, by: 0.0001, az: 0.016, bz: 0.0003 }
};

/**
 * Mapping from Pasquill stability class to Briggs parameter keys.
 * For urban terrain, A and B are merged into "A-B", E and F into "E-F".
 */
const STABILITY_TO_BRIGGS = {
    urban: { "A": "A-B", "B": "A-B", "C": "C", "D": "D", "E": "E-F", "F": "E-F" },
    rural: { "A": "A", "B": "B", "C": "C", "D": "D", "E": "E", "F": "F" }
};

/** Stability parameter s for stable classes (for plume rise limiting) */
const STABILITY_S = {
    "E": 8.7e-4,
    "F": 1.75e-3
};

/** Preset emission scenarios for quick selection */
const EMISSION_PRESETS = {
    smallFire: { label: "Small Fire (~100 acres)", emissionRate: 180, effectiveHeight: 300, heatRelease: 5 },
    mediumFire: { label: "Medium Fire (~1,000 acres)", emissionRate: 1800, effectiveHeight: 800, heatRelease: 50 },
    largeFire: { label: "Large Fire (~10,000 acres)", emissionRate: 18000, effectiveHeight: 1500, heatRelease: 500 },
    majorFire: { label: "Major Fire (~100,000+ acres)", emissionRate: 108000, effectiveHeight: 3000, heatRelease: 3000 },
    custom: { label: "Custom (Manual Input)", emissionRate: null, effectiveHeight: null, heatRelease: null }
};


// ============================================================
// Section 2: Gaussian Dispersion Engine
// ============================================================

/**
 * Calculates Briggs dispersion coefficients σy and σz.
 * @param {number} x - Downwind distance in meters
 * @param {string} stabilityClass - Pasquill stability class (A-F)
 * @param {string} terrain - "urban" or "rural"
 * @returns {{ sigmaY: number, sigmaZ: number }}
 */
function getDispersionCoeffs(x, stabilityClass, terrain = "rural") {
    const keyMap = STABILITY_TO_BRIGGS[terrain] || STABILITY_TO_BRIGGS.rural;
    const key = keyMap[stabilityClass] || "D";
    const params = (terrain === "urban" ? BRIGGS_URBAN : BRIGGS_RURAL)[key];

    if (!params) {
        return { sigmaY: 100, sigmaZ: 50 }; // safe fallback
    }

    const sigmaY = params.ay * x / Math.sqrt(1 + params.by * x);
    let sigmaZ = params.az * x / Math.sqrt(1 + params.bz * x);
    sigmaZ = Math.min(sigmaZ, 5000); // cap at 5km (prevent infinity in neutral)

    return { sigmaY, sigmaZ };
}

/**
 * Estimates effective plume rise for buoyancy-dominated fire plumes.
 * Uses Briggs buoyancy formulas adapted for fires.
 * 
 * Fb = g · Qh / (π · ρa · Cp · Ta)       [Briggs, 1969]
 * ΔH = 21.425 · Fb^(3/4) / u   (Fb < 55)
 * ΔH = 38.71  · Fb^(3/5) / u   (Fb ≥ 55)
 * ΔH = 2.6 · (Fb / (u·s))^(1/3) (stable)
 * 
 * @param {number} heatRelease_MW - Heat release rate in MW
 * @param {number} windSpeed - Wind speed in m s-1
 * @param {string} stabilityClass - Pasquill stability class
 * @returns {number} Plume rise in meters
 */
function estimatePlumeRise(heatRelease_MW, windSpeed, stabilityClass) {
    if (heatRelease_MW <= 0 || windSpeed <= 0) return 0;

    const rho = 1.225; // kg/m³, standard sea-level air density

    // Buoyancy flux (m⁴/s³) — a source property, independent of wind
    const Fb = (9.81 * heatRelease_MW * 1e6) / (Math.PI * rho * 1004 * 293);

    const u = Math.max(windSpeed, 1);
    const isStable = ["E", "F"].includes(stabilityClass);

    if (!isStable) {
        // Unstable/neutral: Briggs (1969)
        if (Fb < 55) {
            return 21.425 * Math.pow(Fb, 0.75) / u;
        } else {
            return 38.71 * Math.pow(Fb, 0.6) / u;
        }
    } else {
        // Stable: limited rise
        const s = STABILITY_S[stabilityClass] || 8.7e-4;
        return 2.6 * Math.pow(Fb / (u * s), 1 / 3);
    }
}

/**
 * Gaussian plume concentration at a single point.
 * Ground-level concentration (z=0) with ground reflection.
 * 
 * C(x,y,0) = Q / (π·u·σy·σz) · exp(-y²/2σy²) · exp(-H²/2σz²)
 * 
 * @param {number} Q - Emission rate (µg/s)
 * @param {number} u - Wind speed (m s-1)
 * @param {number} x - Downwind distance (m)
 * @param {number} y - Crosswind distance (m)
 * @param {number} H - Effective stack height (m)
 * @param {string} stabilityClass
 * @param {string} terrain
 * @returns {number} Concentration in ug m-3
 */
function gaussianPlumeConc(Q, u, x, y, H, stabilityClass, terrain) {
    if (x <= 0) return 0;
    const uEff = Math.max(u, 1); // minimum 1 m s-1 to avoid division by zero

    const { sigmaY, sigmaZ } = getDispersionCoeffs(x, stabilityClass, terrain);

    const expY = Math.exp(-0.5 * (y * y) / (sigmaY * sigmaY));
    const expZ = Math.exp(-0.5 * (H * H) / (sigmaZ * sigmaZ));

    // Ground-level Gaussian plume with reflection
    const C = (Q / (Math.PI * uEff * sigmaY * sigmaZ)) * expY * expZ;

    return Math.max(C, 0);
}


// ============================================================
// Section 3: Grid Computation & Contour Generation
// ============================================================

/**
 * Computes a 2D concentration grid around the source.
 * The grid is oriented with the wind direction.
 * @param {Object} params
 * @param {number} params.emissionRate - g/s (converted to µg/s internally)
 * @param {number} params.effectiveHeight - m (total: stack + plume rise)
 * @param {number} params.windSpeed - m s-1
 * @param {number} params.windDirection - degrees (meteorological, from)
 * @param {string} params.stabilityClass
 * @param {string} params.terrain
 * @param {number} params.gridExtent - km, half-width of grid
 * @param {number} params.gridResolution - number of cells per side
 * @returns {{ grid: Float64Array, xMin: number, xMax: number, yMin: number, yMax: number, nx: number, ny: number }}
 */
function computeConcentrationGrid(params) {
    const {
        emissionRate,
        effectiveHeight,
        windSpeed,
        windDirection,
        stabilityClass,
        terrain = "rural",
        gridExtent = 50,
        gridResolution = 150
    } = params;

    const Q = emissionRate * 1e6; // g/s → µg/s
    const H = effectiveHeight;
    const u = windSpeed;

    const nx = gridResolution;
    const ny = gridResolution;
    const extent = gridExtent * 1000; // km → m

    const grid = new Float64Array(nx * ny);

    // Wind direction: meteorological convention (direction wind is FROM)
    // Convert to math angle for rotation (direction wind is GOING TO)
    const windRad = ((windDirection + 180) % 360) * Math.PI / 180;
    const cosW = Math.cos(windRad);
    const sinW = Math.sin(windRad);

    for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
            // Grid coordinates (meters) centered on source
            const gx = -extent + (2 * extent * i) / (nx - 1);
            const gy = -extent + (2 * extent * j) / (ny - 1);

            // Rotate into wind-aligned coordinates
            // x = downwind, y = crosswind
            const xDown = gx * sinW + gy * cosW;
            const yCross = gx * cosW - gy * sinW;

            const conc = gaussianPlumeConc(Q, u, xDown, yCross, H, stabilityClass, terrain);
            grid[j * nx + i] = conc;
        }
    }

    return { grid, xMin: -extent, xMax: extent, yMin: -extent, yMax: extent, nx, ny };
}

/**
 * Generates GeoJSON contour polygons from the concentration grid.
 * Uses a simple marching-squares implementation.
 * @param {Object} gridResult - Output from computeConcentrationGrid
 * @param {number} sourceLon - Source longitude
 * @param {number} sourceLat - Source latitude
 * @param {number[]} levels - Concentration levels for contours (ug m-3)
 * @returns {Object} GeoJSON FeatureCollection
 */
function generateContourGeoJSON(gridResult, sourceLon, sourceLat, levels) {
    const { grid, xMin, xMax, yMin, yMax, nx, ny } = gridResult;
    const features = [];

    // Approximate meters per degree at given latitude
    const mPerDegLon = 111320 * Math.cos(sourceLat * Math.PI / 180);
    const mPerDegLat = 110574;

    for (const level of levels) {
        // For each contour level, generate filled polygon using flood-fill
        const cells = [];

        for (let j = 0; j < ny; j++) {
            for (let i = 0; i < nx; i++) {
                if (grid[j * nx + i] >= level) {
                    // Convert grid index to meter offset
                    const mx = xMin + (xMax - xMin) * i / (nx - 1);
                    const my = yMin + (yMax - yMin) * j / (ny - 1);
                    cells.push([mx, my]);
                }
            }
        }

        if (cells.length < 3) continue;

        // Compute convex hull for the contour polygon
        const hullPoints = convexHull(cells);

        if (hullPoints.length < 3) continue;

        // Convert meter offsets to lon/lat
        const coords = hullPoints.map(([mx, my]) => [
            sourceLon + mx / mPerDegLon,
            sourceLat + my / mPerDegLat
        ]);
        coords.push(coords[0]); // close polygon

        features.push({
            type: "Feature",
            properties: {
                concentration: level,
                label: `${level} ug m-3`
            },
            geometry: {
                type: "Polygon",
                coordinates: [coords]
            }
        });
    }

    return { type: "FeatureCollection", features };
}

/**
 * Simple convex hull (Andrew monotone chain algorithm)
 * @param {number[][]} points - Array of [x, y]
 * @returns {number[][]} Hull vertices in order
 */
function convexHull(points) {
    if (points.length < 3) return points.slice();

    const sorted = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);

    const cross = (O, A, B) => (A[0] - O[0]) * (B[1] - O[1]) - (A[1] - O[1]) * (B[0] - O[0]);

    const lower = [];
    for (const p of sorted) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
            lower.pop();
        }
        lower.push(p);
    }

    const upper = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
        const p = sorted[i];
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
            upper.pop();
        }
        upper.push(p);
    }

    // Remove last point of each half because its repeated
    lower.pop();
    upper.pop();

    return lower.concat(upper);
}


// ============================================================
// Section 4: Receptor Distance Calculator
// ============================================================

/**
 * Calculates ground-level concentration at a specific distance downwind.
 * This is the "single receptor" calculation for the results table.
 * @param {Object} params
 * @returns {{ centerlineConc: number, plumeSigmaY: number, plumeSigmaZ: number }}
 */
function calcReceptorConcentration(params) {
    const {
        emissionRate,
        effectiveHeight,
        windSpeed,
        stabilityClass,
        distance_km,
        terrain = "rural"
    } = params;

    const Q = emissionRate * 1e6; // g/s → µg/s
    const x = distance_km * 1000;
    const H = effectiveHeight;
    const u = Math.max(windSpeed, 1);

    const { sigmaY, sigmaZ } = getDispersionCoeffs(x, stabilityClass, terrain);

    // Centerline (y=0) ground-level (z=0) concentration
    const centerlineConc = (Q / (Math.PI * u * sigmaY * sigmaZ)) * Math.exp(-0.5 * (H * H) / (sigmaZ * sigmaZ));

    return {
        centerlineConc: Math.max(centerlineConc, 0),
        plumeSigmaY: sigmaY,
        plumeSigmaZ: sigmaZ
    };
}


// ============================================================
// Section 5: Map Rendering (MapLibre Integration)
// ============================================================

const getSourceId = (runId) => `aerscreen-src-contour-${runId}`;
const getFillLayerId = (runId) => `aerscreen-layer-fill-${runId}`;
const getLineLayerId = (runId) => `aerscreen-layer-line-${runId}`;
const getMarkerSourceId = (runId) => `aerscreen-src-marker-${runId}`;
const getMarkerLayerId = (runId) => `aerscreen-layer-marker-${runId}`;

let activeMarkers = {}; // Store MapLibre markers by runId

/**
 * Adds a peak marker on the map
 */
function markPeakOnMap(runId, result, params) {
    if (!map) return;

    const windDir = (params && params.wind_direction !== undefined) ? params.wind_direction : 270;
    const distKm = result.distance_to_max / 1000;
    const bearing = (windDir + 180) % 360;

    const sourceLon = params.lon;
    const sourceLat = params.lat;

    const dLat = (distKm / 111) * Math.cos(bearing * Math.PI / 180);
    const dLon = (distKm / (111 * Math.cos(sourceLat * Math.PI / 180))) * Math.sin(bearing * Math.PI / 180);

    const peakLon = sourceLon + dLon;
    const peakLat = sourceLat + dLat;

    if (isNaN(peakLon) || isNaN(peakLat)) {
        console.warn("AERSCREEN: Calculated peak coordinates are NaN. Skipping marker.", { peakLon, peakLat, distKm, windDir });
        return;
    }

    // Remove old marker for this run if exists
    if (activeMarkers[runId]) {
        activeMarkers[runId].remove();
    }

    // Add a marker and fly to it
    const marker = new maplibregl.Marker({ color: "#ff0000", scale: 1.2 })
        .setLngLat([peakLon, peakLat])
        .setPopup(new maplibregl.Popup().setHTML(`<b>Peak Impact</b><br>${result.max_concentration.toFixed(1)} ug m-3`))
        .addTo(map);

    activeMarkers[runId] = marker;
}

/**
 * Renders dispersion contours on the MapLibre map.
 */
function renderContoursOnMap(runId, geojson, sourceLon, sourceLat) {
    if (!map) return;

    const srcId = getSourceId(runId);
    const fillId = getFillLayerId(runId);
    const lineId = getLineLayerId(runId);
    const mSrcId = getMarkerSourceId(runId);
    const mLayerId = getMarkerLayerId(runId);

    // Remove existing layers for this specific run if they exist
    clearMapLayers(runId);

    // Add source with contour data
    map.addSource(srcId, { type: "geojson", data: geojson });

    // Fill layer (semi-transparent colored regions)
    map.addLayer({
        id: fillId,
        type: "fill",
        source: srcId,
        paint: {
            "fill-color": [
                "interpolate", ["linear"], ["get", "concentration"],
                0.1, "rgba(255, 255, 100, 0.08)",
                1, "rgba(255, 230, 0, 0.12)",
                5, "rgba(255, 180, 0, 0.18)",
                10, "rgba(255, 140, 0, 0.25)",
                25, "rgba(255, 80, 0, 0.32)",
                50, "rgba(220, 30, 0, 0.40)",
                100, "rgba(180, 0, 40, 0.50)",
                500, "rgba(120, 0, 80, 0.60)"
            ],
            "fill-opacity": 0.85
        }
    });

    // Outline layer
    map.addLayer({
        id: lineId,
        type: "line",
        source: srcId,
        paint: {
            "line-color": [
                "interpolate", ["linear"], ["get", "concentration"],
                0.1, "rgba(200, 200, 50, 0.4)",
                10, "rgba(255, 120, 0, 0.6)",
                50, "rgba(220, 30, 0, 0.7)",
                100, "rgba(180, 0, 40, 0.8)"
            ],
            "line-width": 1.5,
            "line-dasharray": [3, 2]
        }
    });

    // Source marker
    map.addSource(mSrcId, {
        type: "geojson",
        data: {
            type: "FeatureCollection",
            features: [{
                type: "Feature",
                geometry: { type: "Point", coordinates: [sourceLon, sourceLat] },
                properties: { label: "Emission Source" }
            }]
        }
    });

    map.addLayer({
        id: mLayerId,
        type: "circle",
        source: mSrcId,
        paint: {
            "circle-radius": 8,
            "circle-color": "#ff3300",
            "circle-stroke-width": 3,
            "circle-stroke-color": "#ffffff"
        }
    });
}

/** Removes dispersion layers from the map */
function clearMapLayers(runId) {
    if (!map) return;

    const idsToRemove = runId ? [runId] : aerscreenHistory.map(h => h.runId);

    idsToRemove.forEach(id => {
        const fillId = getFillLayerId(id);
        const lineId = getLineLayerId(id);
        const mLayerId = getMarkerLayerId(id);
        const srcId = getSourceId(id);
        const mSrcId = getMarkerSourceId(id);

        if (map.getLayer(fillId)) map.removeLayer(fillId);
        if (map.getLayer(lineId)) map.removeLayer(lineId);
        if (map.getLayer(mLayerId)) map.removeLayer(mLayerId);
        if (map.getSource(srcId)) map.removeSource(srcId);
        if (map.getSource(mSrcId)) map.removeSource(mSrcId);

        if (activeMarkers[id]) {
            activeMarkers[id].remove();
            delete activeMarkers[id];
        }
    });

    // Final sweep for any orphaned aerscreen layers
    if (!runId) {
        try {
            const style = map.getStyle();
            if (style.layers) {
                style.layers.forEach(l => {
                    if (l.id.startsWith("aerscreen-layer-")) map.removeLayer(l.id);
                });
            }
            if (style.sources) {
                Object.keys(style.sources).forEach(id => {
                    if (id.startsWith("aerscreen-src-")) map.removeSource(id);
                });
            }
        } catch (e) { }
    }
}


// ============================================================
// Section 6: UI Module
// ============================================================

// ============================================================
// Section 6: UI Module & State
// ============================================================

let aerscreenHistory = [];
let isAerscreenMode = false;
const STORAGE_KEY = "smokelyze_aerscreen_history";

/**
 * Persistence: Save to localStorage
 */
function saveToStorage() {
    try {
        const toSave = aerscreenHistory.slice(0, 10);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
        console.warn("AERSCREEN: Failed to save to localStorage", e);
    }
}

/**
 * Persistence: Load from localStorage
 */
function loadFromStorage() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
        const history = JSON.parse(saved);
        // HYSPLIT-like logic: set all to false when initializing from storage
        history.forEach(item => {
            item.visible = false;
        });
        aerscreenHistory = history;

        const lastAerscreen = aerscreenHistory.find(h => h.type === "aerscreen");
        if (lastAerscreen && lastAerscreen.peakPoint) {
            AerscreenTool.lastResult = lastAerscreen.peakPoint;
            const viewBtn = document.getElementById("AerscreenBtnViewResult");
            if (viewBtn) viewBtn.style.display = "block";
        }

        updateAerscreenDrawerList();
    } catch (e) {
        console.error("AERSCREEN: Error loading from storage", e);
    }
}

/**
 * Toggles the map selection mode (identical pattern to HYSPLIT)
 */
export function handleAerscreenModeToggle(force) {
    isAerscreenMode = (force !== undefined) ? force : !isAerscreenMode;

    // Security: Immediate login check when entering mode
    if (isAerscreenMode && !auth.currentUser) {
        if (utils.showAuthOverlay) utils.showAuthOverlay();
        isAerscreenMode = false;
        return;
    }

    const mapEl = document.getElementById("map");
    if (!mapEl) return;

    if (isAerscreenMode) {
        mapEl.classList.add("Aerscreen-mode-cursor");
        if (showErrorToast) {
            showErrorToast("AERSCREEN Mode: Click on the map to select a source location.", "info");
        }
        setAerscreenDrawer(false);
    } else {
        mapEl.classList.remove("Aerscreen-mode-cursor");
    }
}

function fmtConc(val) {
    if (val < 0.01) return "< 0.01";
    if (val < 1) return val.toFixed(2);
    if (val < 100) return val.toFixed(1);
    return val.toFixed(0);
}

/**
 * Binds all event listeners for the external HTML modal and drawer.
 */
function bindEvents() {
    // Drawer buttons
    const btnNew = document.getElementById("AerscreenBtnNew");
    if (btnNew) btnNew.addEventListener("click", () => {
        handleAerscreenModeToggle(true);
    });

    const btnClearAll = document.getElementById("AerscreenBtnClearAll");
    if (btnClearAll) btnClearAll.addEventListener("click", () => {
        clearMapLayers();
        aerscreenHistory = [];
        saveToStorage();
        updateAerscreenDrawerList();
    });

    const closeDrawer = document.getElementById("AerscreenDrawerClose");
    if (closeDrawer) closeDrawer.addEventListener("click", () => {
        document.getElementById("AerscreenDrawer").classList.remove("open");
    });

    // Setup Drawer drag capability (similar to Hysplit)
    if (window.makeDraggable) {
        window.makeDraggable(document.getElementById("AerscreenDrawer"), document.getElementById("AerscreenDrawerTitle"));
    }

    // Modal buttons
    const btnCloseModal = document.getElementById("AerscreenModalClose");
    if (btnCloseModal) btnCloseModal.addEventListener("click", hideModal);

    const btnCancelModal = document.getElementById("AerscreenBtnCancel");
    if (btnCancelModal) btnCancelModal.addEventListener("click", () => {
        hideModal();
        handleAerscreenModeToggle(false);
    });

    const btnViewRes = document.getElementById("AerscreenBtnViewResult");
    if (btnViewRes) btnViewRes.addEventListener("click", () => {
        if (AerscreenTool.lastResult) {
            AerscreenTool.displayResultPanel(AerscreenTool.lastResult);
        }
    });

    const btnRunMain = document.getElementById("AerscreenBtnRun");
    if (btnRunMain) btnRunMain.addEventListener("click", () => {
        // Hide the modal immediately on run
        hideModal();

        const mode = document.getElementById("AerscreenMode")?.value || "simplified";
        const params = getInputs();

        if (mode === "aerscreen") {
            AerscreenTool.runAnalysis(params);
        } else {
            handleManualRun();
            const drawer = document.getElementById("AerscreenDrawer");
            if (drawer) drawer.classList.add("open");
        }
    });

    const modeSelect = document.getElementById("AerscreenMode");
    const simplifiedParams = document.getElementById("AerscreenSimplifiedParams");
    const aerscreenParams = document.getElementById("AerscreenParams");

    if (modeSelect) {
        modeSelect.addEventListener("change", () => AerscreenTool.updateVisibility());
        AerscreenTool.updateVisibility(); // Initialize state
    }

    const aerscreenTerrainSelect = document.getElementById("AerscreenTerrain");
    const aerscreenPopulationGroup = document.getElementById("AerscreenPopulationGroup");
    if (aerscreenTerrainSelect && aerscreenPopulationGroup) {
        aerscreenTerrainSelect.addEventListener("change", (e) => {
            aerscreenPopulationGroup.style.display = e.target.value === "urban" ? "block" : "none";
        });
    }

    const no2OptionSelect = document.getElementById("AerscreenNo2Option");
    const no2Details = document.getElementById("AerscreenNo2Details");
    if (no2OptionSelect && no2Details) {
        no2OptionSelect.addEventListener("change", (e) => {
            no2Details.style.display = e.target.value !== "1" ? "block" : "none";
        });
    }

    const bldDownwashSelect = document.getElementById("AerscreenBldDownwash");
    const bldDetails = document.getElementById("AerscreenBldDetails");
    if (bldDownwashSelect && bldDetails) {
        bldDownwashSelect.addEventListener("change", (e) => {
            const isY = e.target.value === "Y";
            bldDetails.style.display = isY ? "block" : "none";

            // Inject safe defaults if turned on, reset to 0 if turned off
            if (isY) {
                if (document.getElementById("AerscreenBldHeight").value <= 0) document.getElementById("AerscreenBldHeight").value = 10.0;
                if (document.getElementById("AerscreenBldMinDim").value <= 0) document.getElementById("AerscreenBldMinDim").value = 10.0;
                if (document.getElementById("AerscreenBldMaxDim").value <= 0) document.getElementById("AerscreenBldMaxDim").value = 20.0;
                if (document.getElementById("AerscreenBldAngle").value === "") document.getElementById("AerscreenBldAngle").value = 0.0;
            } else {
                document.getElementById("AerscreenBldHeight").value = 0.0;
                document.getElementById("AerscreenBldMinDim").value = 0.0;
                document.getElementById("AerscreenBldMaxDim").value = 0.0;
                document.getElementById("AerscreenBldAngle").value = 0.0;
            }
        });
    }

    // Preset selector
    const presetSelect = document.getElementById("AerscreenPreset");

    if (presetSelect) {
        presetSelect.addEventListener("change", () => {
            const preset = EMISSION_PRESETS[presetSelect.value];
            if (preset && preset.emissionRate !== null) {
                if (document.getElementById("AerscreenEmissionRate")) document.getElementById("AerscreenEmissionRate").value = preset.emissionRate;
                if (document.getElementById("AerscreenEffHeight")) document.getElementById("AerscreenEffHeight").value = preset.effectiveHeight;
            }
        });
    }

    // Delegation for drawer list items
    const listEl = document.getElementById("AerscreenDrawerList");
    if (listEl) {
        listEl.addEventListener("click", (e) => {
            const toggleBtn = e.target.closest(".Aerscreen-item-toggle");
            if (toggleBtn) {
                e.stopPropagation();
                const runId = toggleBtn.getAttribute("data-run-id");
                toggleVisibility(parseInt(runId));
                return;
            }

            const focusBtn = e.target.closest(".Aerscreen-item-focus");
            if (focusBtn) {
                e.stopPropagation();
                const runId = parseInt(focusBtn.getAttribute("data-run-id"));
                const item = aerscreenHistory.find(h => h.runId === runId);
                if (item && map) {
                    // Automatically show if hidden
                    if (!item.visible) {
                        toggleVisibility(runId);
                    }
                    // Fly to the emission location and highlight it
                    map.flyTo({ center: [item.params.lon, item.params.lat], zoom: 10, speed: 1.5 });
                }
                return;
            }

            const removeBtn = e.target.closest(".Aerscreen-item-remove");
            if (removeBtn) {
                e.stopPropagation();
                const runId = removeBtn.getAttribute("data-run-id");
                removeRun(parseInt(runId));
                return;
            }

            const itemBody = e.target.closest(".Hysplit-item");
            if (itemBody) {
                const runId = parseInt(itemBody.getAttribute("data-run-id"));
                const item = aerscreenHistory.find(h => h.runId === runId);
                if (item) {
                    // Populate historical modal parameters
                    if (document.getElementById("AerscreenMode")) {
                        const modeEl = document.getElementById("AerscreenMode");
                        modeEl.value = item.type === "aerscreen" ? "aerscreen" : "simplified";
                        modeEl.dispatchEvent(new Event("change"));
                    }
                    if (document.getElementById("AerscreenEmissionRate")) document.getElementById("AerscreenEmissionRate").value = (item.params.emission_rate * 3.6).toFixed(0);
                    if (document.getElementById("AerscreenEffHeight")) document.getElementById("AerscreenEffHeight").value = item.params.effective_height;
                    if (document.getElementById("AerscreenTerrain")) {
                        const terrEl = document.getElementById("AerscreenTerrain");
                        terrEl.value = item.params.terrain || "rural";
                        terrEl.dispatchEvent(new Event("change"));
                    }
                    if (document.getElementById("AerscreenPopulation")) document.getElementById("AerscreenPopulation").value = item.params.population || 2000000;

                    if (item.type === "aerscreen") {
                        if (document.getElementById("AerscreenStackDiameter")) document.getElementById("AerscreenStackDiameter").value = item.params.stack_diameter || 5.0;
                        if (document.getElementById("AerscreenStackTemp")) document.getElementById("AerscreenStackTemp").value = item.params.stack_temp || 500.0;
                        if (document.getElementById("AerscreenStackVelocity")) document.getElementById("AerscreenStackVelocity").value = item.params.stack_velocity || 5.0;
                        if (document.getElementById("AerscreenAmbientDistance")) document.getElementById("AerscreenAmbientDistance").value = item.params.ambient_distance || 1.0;

                        if (document.getElementById("AerscreenNo2Option")) {
                            const no2El = document.getElementById("AerscreenNo2Option");
                            no2El.value = item.params.no2_option || "1";
                            no2El.dispatchEvent(new Event("change"));
                        }
                        if (document.getElementById("AerscreenNo2StackRatio")) document.getElementById("AerscreenNo2StackRatio").value = item.params.no2_stack_ratio || 0.1;
                        if (document.getElementById("AerscreenOzoneUnits")) document.getElementById("AerscreenOzoneUnits").value = item.params.ozone_units || "3";
                        if (document.getElementById("AerscreenOzoneValue")) document.getElementById("AerscreenOzoneValue").value = item.params.ozone_value || 40;

                        if (document.getElementById("AerscreenBldDownwash")) {
                            const bldEl = document.getElementById("AerscreenBldDownwash");
                            bldEl.value = item.params.bld_downwash || "N";
                            bldEl.dispatchEvent(new Event("change"));
                        }
                        if (document.getElementById("AerscreenBldHeight")) document.getElementById("AerscreenBldHeight").value = item.params.bld_height || 0;
                        if (document.getElementById("AerscreenBldMinDim")) document.getElementById("AerscreenBldMinDim").value = item.params.bld_min_dim || 0;
                        if (document.getElementById("AerscreenBldMaxDim")) document.getElementById("AerscreenBldMaxDim").value = item.params.bld_max_dim || 0;
                        if (document.getElementById("AerscreenBldAngle")) document.getElementById("AerscreenBldAngle").value = item.params.bld_angle || 0;
                    } else {
                        if (document.getElementById("AerscreenWindSpeed")) document.getElementById("AerscreenWindSpeed").value = item.params.wind_speed;
                        if (document.getElementById("AerscreenWindDir")) document.getElementById("AerscreenWindDir").value = item.params.wind_direction;
                        if (document.getElementById("AerscreenStability")) document.getElementById("AerscreenStability").value = item.params.stability_class;
                    }

                    // [FIX] Update specific result data for history recall
                    if (item.type === "aerscreen" && item.peakPoint) {
                        AerscreenTool.lastResult = item.peakPoint;
                        AerscreenTool.lastResult.isAerscreen = true;
                    } else {
                        AerscreenTool.lastResult = null; // Hide modal link for simplified
                    }

                    // [FIX] Sync button visibility immediately using the tool method
                    AerscreenTool.updateVisibility();

                    // Open the modal exactly at that historical location
                    openDispersionAt(item.params.lon, item.params.lat);
                }
            }
        });
    }
}

function hideModal() {
    const modal = document.getElementById("AerscreenModalOverlay");
    if (modal) modal.style.display = "none";
}

/**
 * Extract all parameters from the UI modal.
 */
function getInputs() {
    const mode = document.getElementById("AerscreenMode")?.value || "simplified";
    const lat = parseFloat(document.getElementById("AerscreenSourceLat")?.value) || 39.8;
    const lon = parseFloat(document.getElementById("AerscreenSourceLon")?.value) || -98.5;

    // 1. Collect Shared Parameters
    const baseParams = {
        lat: lat,
        lon: lon,
        emission_rate: (parseFloat(document.getElementById("AerscreenEmissionRate")?.value) || 1800) / 3.6,
        effective_height: parseFloat(document.getElementById("AerscreenEffHeight")?.value) || 10.0,
        terrain: document.getElementById("AerscreenTerrain")?.value || "rural",
        population: parseFloat(document.getElementById("AerscreenPopulation")?.value) || 0,
    };

    if (mode === "aerscreen") {
        return {
            ...baseParams,
            mode: "aerscreen",
            // Advanced Stack Data
            stack_diameter: parseFloat(document.getElementById("AerscreenStackDiameter")?.value) || 5.0,
            stack_temp: parseFloat(document.getElementById("AerscreenStackTemp")?.value) || 500.0,
            stack_velocity: parseFloat(document.getElementById("AerscreenStackVelocity")?.value) || 5.0,

            // Building Data
            bld_downwash: document.getElementById("AerscreenBldDownwash")?.value || "N",
            bld_height: parseFloat(document.getElementById("AerscreenBldHeight")?.value) || 0,
            bld_min_dim: parseFloat(document.getElementById("AerscreenBldMinDim")?.value) || 0,
            bld_max_dim: parseFloat(document.getElementById("AerscreenBldMaxDim")?.value) || 0,

            // Makemet Data
            min_ambient_temp: parseFloat(document.getElementById("AerscreenMinAmbTemp")?.value) || 250,
            max_ambient_temp: parseFloat(document.getElementById("AerscreenMaxAmbTemp")?.value) || 315,
            min_wind_speed: parseFloat(document.getElementById("AerscreenMinWindSpeed")?.value) || 0.5,
            surface_albedo: parseFloat(document.getElementById("AerscreenAlbedo")?.value) || 0.20,
            surface_bowen: parseFloat(document.getElementById("AerscreenBowen")?.value) || 1.0,

            // Terrain/Survey Options
            use_terrain: document.getElementById("AerscreenUseTerrain")?.value || "N",
            run_aermap: document.getElementById("AerscreenRunAermap")?.value || "N",
            probe_distance: parseFloat(document.getElementById("AerscreenProbeDistance")?.value) || 5000,
            ambient_distance: parseFloat(document.getElementById("AerscreenAmbientDistance")?.value) || 1.0,

            // NO2 Chemistry
            no2_option: document.getElementById("AerscreenNo2Option")?.value || "1",
            no2_stack_ratio: parseFloat(document.getElementById("AerscreenNo2StackRatio")?.value) || 0.1,
            ozone_units: document.getElementById("AerscreenOzoneUnits")?.value || "3",
            ozone_value: parseFloat(document.getElementById("AerscreenOzoneValue")?.value) || 40
        };
    } else {
        return {
            ...baseParams,
            mode: "simplified",
            wind_speed: parseFloat(document.getElementById("AerscreenWindSpeed")?.value) || 5.0,
            wind_direction: parseFloat(document.getElementById("AerscreenWindDir")?.value) || 270.0,
            stability_class: document.getElementById("AerscreenStability")?.value || "D",

            // Defaults for simplified mode compatibility
            stack_diameter: 5.0,
            stack_temp: 500.0,
            stack_velocity: 5.0,
            ambient_distance: 1.0
        };
    }
}

/**
 * Main aerscreen execution ??reads inputs, computes, renders results + map.
 */
function handleManualRun() {
    if (AerscreenTool.isRunning) {
        if (showErrorToast) showErrorToast("AERSCREEN is currently running... please wait.", "warning");
        return;
    }

    console.log("Starting aerscreen Manual Run...");
    const params = getInputs();
    if (!params) return;

    AerscreenTool.isRunning = true;
    AerscreenTool.showLoading(true);

    const task = showTaskNotification("Dispersion Screening", "Computing local concentration grid...");

    try {
        // Read inputs
        const emissionRate = params.emission_rate;
        const effectiveHeight = params.effective_height;
        const windSpeed = params.wind_speed;
        const windDirection = params.wind_direction;
        const stabilityClass = params.stability_class;
        const terrain = params.terrain;
        const sourceLat = params.lat;
        const sourceLon = params.lon;

        // 1. Compute concentration grid
        const gridResult = computeConcentrationGrid({
            emissionRate, effectiveHeight, windSpeed, windDirection, stabilityClass, terrain,
            gridExtent: 50,        // 50 km half-extent
            gridResolution: 150    // 150??50 grid
        });

        // 2. Generate contour GeoJSON
        const contourLevels = [0.1, 0.5, 1, 5, 10, 25, 50, 100, 250, 500];
        const geojson = generateContourGeoJSON(gridResult, sourceLon, sourceLat, contourLevels);

        // 3. Find max concentration
        const maxConc = Math.max(...gridResult.grid);
        const maxIdx = gridResult.grid.indexOf(maxConc);
        const maxJ = Math.floor(maxIdx / gridResult.nx);
        const maxI = maxIdx % gridResult.nx;
        const maxDistX = gridResult.xMin + (gridResult.xMax - gridResult.xMin) * maxI / (gridResult.nx - 1);
        const maxDistY = gridResult.yMin + (gridResult.yMax - gridResult.yMin) * maxJ / (gridResult.ny - 1);
        const maxDistKm = Math.sqrt(maxDistX * maxDistX + maxDistY * maxDistY) / 1000;

        // 5. Build History Item
        const runId = Date.now();

        // 4. Render on map
        renderContoursOnMap(runId, geojson, sourceLon, sourceLat);

        aerscreenHistory.unshift({
            runId: runId,
            params: params,
            geojson: geojson,
            maxConc: maxConc,
            maxDistKm: maxDistKm,
            visible: true,
            type: "contour"
        });

        if (aerscreenHistory.length > 10) aerscreenHistory.pop();
        saveToStorage();
        updateAerscreenDrawerList();

        // [INITIAL FOCUS] Automatically jump to the emission source location
        if (map) {
            map.flyTo({ center: [sourceLon, sourceLat], zoom: 8, speed: 2 });
        }

        // Clear current EPA results pointer since Simplified has no results window
        AerscreenTool.lastResult = null;
        AerscreenTool.updateVisibility();

        task.update("Simulation complete!", "success");
    } catch (err) {
        console.error("Dispersion Screening failed:", err);
        task.update(`Failed: ${err.message}`, "error");
    } finally {
        AerscreenTool.isRunning = false;
        AerscreenTool.showLoading(false);
    }
}

function updateAerscreenDrawerList() {
    const listEl = document.getElementById("AerscreenDrawerList");
    if (!listEl) return;

    if (aerscreenHistory.length === 0) {
        listEl.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-main); font-size: 1.4rem;">No simulations yet.<br>Click a point on map or use the button above.</div>`;
        return;
    }

    listEl.innerHTML = aerscreenHistory.map(item => {
        const visibleCls = item.visible ? "active" : "";
        const eyeIcon = item.visible
            ? `<svg width="18" height="18"><use xlink:href="#icon-eye-open" /></svg>`
            : `<svg width="18" height="18"><use xlink:href="#icon-eye-closed" /></svg>`;

        const typeLabel = item.type === "aerscreen" ? "EPA" : "Local";

        return `
            <div class="Hysplit-item" data-run-id="${item.runId}" style="cursor: pointer;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                    <div style="font-size: 1.3rem; font-weight: bold; color: var(--text-heading);">
                        ${typeLabel} Max: <span style="color:var(--card-shadow);">${fmtConc(item.maxConc)}</span> ug m-3
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="Aerscreen-item-focus ui-btn-close" data-run-id="${item.runId}" title="Emission Location">
                            <svg width="18" height="18">
                                <use xlink:href="#icon-location" />
                            </svg>
                        </button>
                        <button class="Aerscreen-item-toggle ui-btn-close ${visibleCls}" data-run-id="${item.runId}">
                            ${eyeIcon}
                        </button>
                        <button class="Aerscreen-item-remove ui-btn-close" data-run-id="${item.runId}">
                            <svg width="18" height="18"><use xlink:href="#icon-close" /></svg>
                        </button>
                    </div>
                </div>
                <div style="font-size: 1.1rem; color: var(--text-main);">
                    <strong>Source:</strong> ${(item.params.emission_rate * 3.6).toFixed(0)} kg hr-1, Eff. Height: ${item.params.effective_height}m<br>
                    ${item.params.wind_speed !== undefined ? `<strong>Wind:</strong> ${item.params.wind_speed}m s-1 from ${item.params.wind_direction}°<br>` : "<strong>Wind:</strong> AERSCREEN Matched<br>"}
                    <strong>Loc:</strong> ${item.params.lon.toFixed(3)}, ${item.params.lat.toFixed(3)}
                </div>
            </div>
        `;
    }).join("");
}

function toggleVisibility(runId) {
    const item = aerscreenHistory.find(h => h.runId === runId);
    if (!item) return;

    item.visible = !item.visible;

    if (item.visible) {
        if (item.type === "contour") {
            renderContoursOnMap(runId, item.geojson, item.params.lon, item.params.lat);
        } else if (item.peakPoint) {
            markPeakOnMap(runId, item.peakPoint, item.params);
        }
    } else {
        clearMapLayers(runId);
    }

    saveToStorage();
    updateAerscreenDrawerList();
}

function removeRun(runId) {
    clearMapLayers(runId);
    aerscreenHistory = aerscreenHistory.filter(h => h.runId !== runId);
    saveToStorage();
    updateAerscreenDrawerList();
}

// ============================================================
// Section 7: Public API & Initialization
// ============================================================

/** Programmatically open modal with pre-filled source location */
export function openDispersionAt(lon, lat) {
    const modal = document.getElementById("AerscreenModalOverlay");
    if (!modal) return;

    modal.style.display = "flex";

    const locLabel = document.getElementById("InputAerscreenLocation");
    const lonInput = document.getElementById("AerscreenSourceLon");
    const latInput = document.getElementById("AerscreenSourceLat");

    if (locLabel) locLabel.innerText = `${lon.toFixed(4)}, ${lat.toFixed(4)}`;
    if (lonInput) lonInput.value = lon;
    if (latInput) latInput.value = lat;
}

/** Clean up everything */
export function destroyDispersion(deleteHistory = true) {
    clearMapLayers();

    if (deleteHistory) {
        aerscreenHistory = [];
        saveToStorage();
    } else {
        aerscreenHistory.forEach(h => h.visible = false);
    }

    updateAerscreenDrawerList();

    // Close result panel if open
    const panel = document.getElementById("AerscreenResultOverlay");
    if (panel) panel.style.display = "none";

    // Close drawer
    if (setAerscreenDrawer) setAerscreenDrawer(false);
}

// ============================================================
// Section 8: Context Menu Integration
// ============================================================

/** Stores the last right-clicked coordinate for dispersion source */
let pendingDispersionLngLat = null;

/** Initialize the module */
export function init() {
    console.log("Dispersion Screening Module Initializing...");
    bindEvents();
    loadFromStorage();
}

if (map) {
    // 1. Capture coordinate from context menu (same pattern as HYSPLIT)
    map.on("contextmenu", (e) => {
        pendingDispersionLngLat = e.lngLat;
    });

    // 1b. Map click for Aerscreen Mode
    map.on("click", (e) => {
        if (isAerscreenMode) {
            handleAerscreenModeToggle(false);
            openDispersionAt(e.lngLat.lng, e.lngLat.lat);
        }
    });
}

// Global event delegation for context menu button
document.body.addEventListener("click", (e) => {
    const dispBtn = e.target.closest("#MapPostBtnAerscreen");
    if (dispBtn) {
        e.preventDefault();

        // Hide context menu
        const ctxMenu = document.getElementById("MapPostContextMenu");
        if (ctxMenu) ctxMenu.style.display = "none";

        // Open modal with the right-clicked coordinates
        if (pendingDispersionLngLat) {
            openDispersionAt(pendingDispersionLngLat.lng, pendingDispersionLngLat.lat);
        } else {
            const center = map.getCenter();
            openDispersionAt(center.lng, center.lat);
        }
    }
});

// Listen for reset events from ui-reset.js (Decoupled Reset)
document.addEventListener("smokelyze-reset-aerscreen", (e) => {
    AerscreenTool.abortAnalysis();
    destroyDispersion(e.detail?.deleteHistory ?? false);
});

// Global exposure for everything
window.Aerscreen = {
    init: init,
    run: openDispersionAt,
    runManual: handleManualRun,
    getCurrentParams: getInputs,
    reset: destroyDispersion,
    Tool: AerscreenTool // Expose the tool object as well
};

// Auto-initialize when the script is loaded
if (map) {
    if (typeof init === "function") init();
} else {
    document.addEventListener("map-ready", () => {
        if (typeof init === "function") init();
    });
}

// Admin-only Visibility Logic
import { db, doc, getDoc, onAuthStateChanged } from "./fb-init.js";

onAuthStateChanged(auth, async (user) => {
    const toggleBtn = document.getElementById("AerscreenToggle");
    const ctxBtn = document.getElementById("MapPostBtnAerscreen");
    const drawer = document.getElementById("AerscreenDrawer");

    let isAdmin = false;
    if (user) {
        try {
            const userSnap = await getDoc(doc(db, "smokelyze_users", user.uid));
            if (userSnap.exists()) {
                isAdmin = (userSnap.data().role === "admin");
            }
        } catch (e) {
            console.warn("AERSCREEN: Admin check failed:", e);
        }
    }

    if (toggleBtn) toggleBtn.style.display = isAdmin ? "block" : "none";
    if (ctxBtn) ctxBtn.style.display = isAdmin ? "block" : "none";

    // If not admin and drawer is open, close it
    if (!isAdmin && drawer) {
        drawer.classList.remove("open");
    }
});

