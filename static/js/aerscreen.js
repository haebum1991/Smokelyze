
/**
 * Smokelyze AERSCREEN Integration Module
 * Handles communication with the Go-based EPA AERSCREEN API.
 */
import { auth } from "./fb-init.js";
import { map } from "./map-init.js";
import { showErrorToast } from "./loader-ui.js";
import * as utils from "./utils.js";
import { setAerscreenDrawer } from "./ui-toggles.js";

const AERSCREEN_CONFIG = {
    API_URL: "https://fetch-aerscreen-go-service-1068523865415.us-central1.run.app/api/dispersion/aerscreen"
};

export const AerscreenTool = {
    /**
     * Calls the backend AERSCREEN API
     * @param {Object} params - Emission parameters from the UI
     */
    async runAnalysis(params) {
        console.log("Starting AERSCREEN Analysis with params:", params);

        // Let user know we are working (UI Feedback)
        this.showLoading(true);

        try {
            // Map the internal params to the API request format
            const apiParams = {
                emission_rate: params.emission_rate || 500.0,
                stack_height: params.effective_height || 10.0,
                stack_diameter: 5.0,  // Wildfire plume approximation
                stack_temp: 500.0,    // Typical fire temp (K)
                stack_velocity: 5.0,   // Estimated buoyant lift (m/s)
                ambient_temp: 293.15,
                terrain_type: (params.terrain || "rural").toUpperCase()
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
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${idToken}`
                },
                body: JSON.stringify(apiParams)
            });

            if (!response.ok) throw new Error(`API Error: ${response.statusText}`);

            const result = await response.json();
            console.log("AERSCREEN Result:", result);

            this.handleSuccess(result, params);
        } catch (error) {
            console.error("AERSCREEN Failed:", error);
            alert(`AERSCREEN Analysis Failed: ${error.message}
Make sure the backend is running!`);
        } finally {
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
        this.displayResultPanel(result);

        // 2. Add to history
        const runId = Date.now();
        // Hide previous run
        if (aerscreenHistory.length > 0) {
            aerscreenHistory.forEach(h => h.visible = false);
        }

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

        // 3. Add visual marker on the map for the Peak Concentration point
        try {
            this.markPeakOnMap(result, params);
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
            panel.style.zIndex = "9999";
            document.body.appendChild(panel);
        }

        panel.style.display = "flex";

        panel.innerHTML = `
            <div class="MapPost-modal" style="max-width: 75rem; padding: 0;">
                <div class="MapPost-modal-header" style="background: linear-gradient(135deg, #1a1a2e, #16213e); color: #fff; padding: 1.5rem 2rem;">
                    <h3 style="margin: 0; font-size: 1.6rem; display: flex; align-items: center; gap: 8px;">
                        EPA AERSCREEN Result
                    </h3>
                    <button onclick="document.getElementById('${panelId}').style.display = 'none';" style="background: none; border: none; color: #fff; font-size: 2.4rem; cursor: pointer; padding: 0;">&times;</button>
                </div>
                <div class="MapPost-modal-body" style="padding: 2rem; background: var(--color-bg);">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                        <div style="padding: 1.5rem; background: rgba(255,100,0,0.05); border-radius: 10px; border-left: 5px solid #ff6600; display: flex; flex-direction: column; justify-content: center;">
                            <div style="color: var(--text-soft); font-size: 1.1rem; text-transform: uppercase; font-weight: 700; margin-bottom: 5px;">Max ground concentration</div>
                            <div style="font-size: 2.8rem; font-weight: 800; color: #ff4400;">
                                ${result.max_concentration.toFixed(2)} <span style="font-size: 1.4rem; font-weight: 400; color: var(--text-soft);">µg/m³</span>
                            </div>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                            <div style="padding: 1.5rem; background: var(--sidebar-widget-bg); border-radius: 8px; border: 1px solid var(--border-main); display: flex; flex-direction: column; justify-content: center;">
                                <div style="color: var(--text-soft); font-size: 1.1rem; font-weight: 600;">Distance to Max</div>
                                <div style="font-size: 2rem; font-weight: 700; margin-top: 5px;">${(result.distance_to_max / 1000).toFixed(2)} km</div>
                            </div>
                            <div style="padding: 1.5rem; background: var(--sidebar-widget-bg); border-radius: 8px; border: 1px solid var(--border-main); display: flex; flex-direction: column; justify-content: center;">
                                <div style="color: var(--text-soft); font-size: 1.1rem; font-weight: 600;">Execution Time</div>
                                <div style="font-size: 2rem; font-weight: 700; margin-top: 5px;">${result.execution_time_sec.toFixed(2)}s</div>
                            </div>
                        </div>
                    </div>
                    
                    <div style="margin-top: 2rem;">
                        <div style="color: var(--text-heading); font-size: 1.2rem; font-weight: 700; margin-bottom: 0.8rem; text-transform: uppercase;">AERSCREEN.OUT Summary</div>
                        <pre style="background: var(--sidebar-widget-bg); color: var(--text-main); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border-main); font-size: 1.1rem; height: 35rem; overflow-y: auto; overflow-x: auto; font-family: 'Courier New', Courier, monospace; line-height: 1.4; white-space: pre;">${result.output_summary ? result.output_summary : 'No explicit engine output was returned.'}</pre>
                    </div>

                    <div style="margin-top: 1.5rem; font-size: 1.1rem; color: var(--text-main); padding: 1.5rem; background: rgba(255,255,255,0.05); border-radius: 8px; line-height: 1.6; border: 1px solid var(--border-main);">
                        <div style="font-weight: 700; color: #ffab40; margin-bottom: 0.8rem; font-size: 1.3rem;">How to interpret this result:</div>
                        <ul style="margin: 0; padding-left: 1.5rem; display: flex; flex-direction: column; gap: 0.8rem;">
                            <li><strong>Worst-Case Scenario:</strong> AERSCREEN is a conservative screening model. It artificially tests every possible bad weather condition (stagnant air, poor dispersion) to find the absolute worst-case impact.</li>
                            <li><strong>Safety Threshold:</strong> If the <strong>Max ground concentration (${result.max_concentration.toFixed(1)} µg/m³)</strong> is well below regulatory limits (e.g., NAAQS PM2.5 daily standard of 35 µg/m³), you can confidently conclude the emissions source is safe without needing a costly, full-year meteorology AERMOD run.</li>
                            <li><strong>Plume Touchdown:</strong> The pollutant plume doesn't hit the ground immediately. Due to stack height and velocity, the worst air quality occurs exactly <strong>${(result.distance_to_max / 1000).toFixed(2)} km</strong> away from the source coordinate.</li>
                        </ul>
                    </div>

                    <div style="margin-top: 1.5rem; font-size: 1.1rem; color: var(--text-soft); padding: 1.2rem; background: rgba(0,0,0,0.03); border-radius: 6px; line-height: 1.5;">
                        <strong>Engine Details:</strong> Calculated by official EPA AERMOD (v24142) wrapped in AERSCREEN (v21112) running on Alpine Linux.
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Adds a peak marker on the map
     */
    markPeakOnMap(result, params) {
        if (!map) return;

        // Calculate the peak point location based on distance and wind direction
        // This is a simplified projection
        const distKm = result.distance_to_max / 1000;
        const bearing = (params.wind_direction + 180) % 360; // Wind is going TO this direction

        const sourceLon = params.lon;
        const sourceLat = params.lat;

        // Simple projection: 1 degree lat ~ 111km, 1 degree lon ~ 111 * cos(lat)
        const dLat = (distKm / 111) * Math.cos(bearing * Math.PI / 180);
        const dLon = (distKm / (111 * Math.cos(sourceLat * Math.PI / 180))) * Math.sin(bearing * Math.PI / 180);

        const peakLon = sourceLon + dLon;
        const peakLat = sourceLat + dLat;

        // Add a marker and fly to it
        new maplibregl.Marker({ color: "#ff0000", scale: 1.2 })
            .setLngLat([peakLon, peakLat])
            .setPopup(new maplibregl.Popup().setHTML(`<b>Peak Impact</b><br>${result.max_concentration.toFixed(1)} µg/m³`))
            .addTo(map);

        map.flyTo({ center: [peakLon, peakLat], zoom: 11, speed: 1.5 });
    },

    showLoading(show) {
        const btn = document.getElementById("AerscreenBtnRun");
        if (!btn) return;

        if (show) {
            btn.disabled = true;
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
 * Uses Briggs' buoyancy formulas adapted for fires.
 * 
 * Fb = g · Qh / (π · ρa · Cp · Ta)       [Briggs, 1969]
 * ΔH = 21.425 · Fb^(3/4) / u   (Fb < 55)
 * ΔH = 38.71  · Fb^(3/5) / u   (Fb ≥ 55)
 * ΔH = 2.6 · (Fb / (u·s))^(1/3) (stable)
 * 
 * @param {number} heatRelease_MW - Heat release rate in MW
 * @param {number} windSpeed - Wind speed in m/s
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
 * @param {number} u - Wind speed (m/s)
 * @param {number} x - Downwind distance (m)
 * @param {number} y - Crosswind distance (m)
 * @param {number} H - Effective stack height (m)
 * @param {string} stabilityClass
 * @param {string} terrain
 * @returns {number} Concentration in µg/m³
 */
function gaussianPlumeConc(Q, u, x, y, H, stabilityClass, terrain) {
    if (x <= 0) return 0;
    const uEff = Math.max(u, 1); // minimum 1 m/s to avoid division by zero

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
 * @param {number} params.windSpeed - m/s
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
 * @param {number[]} levels - Concentration levels for contours (µg/m³)
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
                label: `${level} µg/m³`
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
 * Simple convex hull (Andrew's monotone chain algorithm)
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

    // Remove last point of each half because it's repeated
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

const SOURCE_ID = "dispersion-contour-source";
const FILL_LAYER_ID = "dispersion-contour-fill";
const LINE_LAYER_ID = "dispersion-contour-line";
const MARKER_SOURCE_ID = "dispersion-source-marker";
const MARKER_LAYER_ID = "dispersion-source-marker-layer";

let currentMarker = null;

/**
 * Renders dispersion contours on the MapLibre map.
 * @param {Object} geojson - GeoJSON FeatureCollection from generateContourGeoJSON
 * @param {number} sourceLon
 * @param {number} sourceLat
 */
function renderContoursOnMap(geojson, sourceLon, sourceLat) {
    if (!map) return;

    // Remove existing layers/sources
    clearMapLayers();

    // Add source with contour data
    map.addSource(SOURCE_ID, { type: "geojson", data: geojson });

    // Fill layer (semi-transparent colored regions)
    map.addLayer({
        id: FILL_LAYER_ID,
        type: "fill",
        source: SOURCE_ID,
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
        id: LINE_LAYER_ID,
        type: "line",
        source: SOURCE_ID,
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

    // Source marker (fire icon point)
    map.addSource(MARKER_SOURCE_ID, {
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
        id: MARKER_LAYER_ID,
        type: "circle",
        source: MARKER_SOURCE_ID,
        paint: {
            "circle-radius": 8,
            "circle-color": "#ff3300",
            "circle-stroke-width": 3,
            "circle-stroke-color": "#ffffff"
        }
    });
}

/** Removes all dispersion layers from the map */
function clearMapLayers() {
    if (!map) return;

    [FILL_LAYER_ID, LINE_LAYER_ID, MARKER_LAYER_ID].forEach(id => {
        if (map.getLayer(id)) map.removeLayer(id);
    });
    [SOURCE_ID, MARKER_SOURCE_ID].forEach(id => {
        if (map.getSource(id)) map.removeSource(id);
    });

    if (currentMarker) {
        currentMarker.remove();
        currentMarker = null;
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
        aerscreenHistory = history;
        updateAerscreenDrawerList();

        // Restore the most recent visible run if exists
        const visibleRun = aerscreenHistory.find(h => h.visible);
        if (visibleRun) {
            if (visibleRun.geojson) {
                renderContoursOnMap(visibleRun.geojson, visibleRun.params.lon, visibleRun.params.lat);
            } else if (visibleRun.peakPoint) {
                // Restoration logic for peak marker could go here if needed
                AerscreenTool.markPeakOnMap(visibleRun.peakPoint, visibleRun.params);
            }
        }
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

    const btnRunMain = document.getElementById("AerscreenBtnRun");
    if (btnRunMain) btnRunMain.addEventListener("click", () => {
        const mode = document.getElementById("AerscreenMode")?.value || "simplified";
        const params = getInputs();

        if (mode === "aerscreen") {
            AerscreenTool.runAnalysis(params);
        } else {
            handleManualRun();
            const drawer = document.getElementById("AerscreenDrawer");
            if (drawer) drawer.classList.add("open");
        }
        hideModal();
    });

    // Preset selector
    const presetSelect = document.getElementById("AerscreenPreset");
    const emissionInput = document.getElementById("AerscreenEmissionRate");
    const heightInput = document.getElementById("AerscreenEffHeight");

    if (presetSelect) {
        presetSelect.addEventListener("change", () => {
            const preset = EMISSION_PRESETS[presetSelect.value];
            if (preset && preset.emissionRate !== null) {
                emissionInput.value = preset.emissionRate;
                heightInput.value = preset.effectiveHeight;
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
                    if (document.getElementById("AerscreenMode")) document.getElementById("AerscreenMode").value = item.type === "aerscreen" ? "aerscreen" : "simplified";
                    if (document.getElementById("AerscreenEmissionRate")) document.getElementById("AerscreenEmissionRate").value = (item.params.emission_rate * 3.6).toFixed(0);
                    if (document.getElementById("AerscreenEffHeight")) document.getElementById("AerscreenEffHeight").value = item.params.effective_height;
                    if (document.getElementById("AerscreenWindSpeed")) document.getElementById("AerscreenWindSpeed").value = item.params.wind_speed;
                    if (document.getElementById("AerscreenWindDir")) document.getElementById("AerscreenWindDir").value = item.params.wind_direction;
                    if (document.getElementById("AerscreenStability")) document.getElementById("AerscreenStability").value = item.params.stability_class;
                    if (document.getElementById("AerscreenTerrain")) document.getElementById("AerscreenTerrain").value = item.params.terrain;

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
    return {
        emission_rate: (parseFloat(document.getElementById("AerscreenEmissionRate").value) || 1800) / 3.6,
        effective_height: parseFloat(document.getElementById("AerscreenEffHeight").value) || 800,
        wind_speed: parseFloat(document.getElementById("AerscreenWindSpeed").value) || 5,
        wind_direction: parseFloat(document.getElementById("AerscreenWindDir").value) || 270,
        stability_class: document.getElementById("AerscreenStability").value,
        terrain: document.getElementById("AerscreenTerrain").value,
        lat: parseFloat(document.getElementById("AerscreenSourceLat").value) || 39.8,
        lon: parseFloat(document.getElementById("AerscreenSourceLon").value) || -98.5
    };
}

/**
 * Main aerscreen execution — reads inputs, computes, renders results + map.
 */
function handleManualRun() {
    console.log("Starting aerscreen Manual Run...");
    const params = getInputs();
    if (!params) return;

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
        gridResolution: 150    // 150×150 grid
    });

    // 2. Generate contour GeoJSON
    const contourLevels = [0.1, 0.5, 1, 5, 10, 25, 50, 100, 250, 500];
    const geojson = generateContourGeoJSON(gridResult, sourceLon, sourceLat, contourLevels);

    // 3. Render on map
    renderContoursOnMap(geojson, sourceLon, sourceLat);

    // 4. Find max concentration
    const maxConc = Math.max(...gridResult.grid);
    const maxIdx = gridResult.grid.indexOf(maxConc);
    const maxJ = Math.floor(maxIdx / gridResult.nx);
    const maxI = maxIdx % gridResult.nx;
    const maxDistX = gridResult.xMin + (gridResult.xMax - gridResult.xMin) * maxI / (gridResult.nx - 1);
    const maxDistY = gridResult.yMin + (gridResult.yMax - gridResult.yMin) * maxJ / (gridResult.ny - 1);
    const maxDistKm = Math.sqrt(maxDistX * maxDistX + maxDistY * maxDistY) / 1000;

    // 5. Build History Item
    const runId = Date.now();

    // Hide previous run
    if (aerscreenHistory.length > 0) {
        aerscreenHistory[0].visible = false;
    }

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

    // Fly to source location
    if (map) {
        map.flyTo({ center: [sourceLon, sourceLat], zoom: 8, speed: 2 });
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
        const typeColor = item.type === "aerscreen" ? "#ffab40" : "#ff6b00";

        return `
            <div class="Hysplit-item" data-run-id="${item.runId}" style="border-left: 5px solid ${typeColor}; cursor: pointer;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                    <div style="font-size: 1.3rem; font-weight: bold; color: var(--text-heading);">
                        ${typeLabel} Max: <span style="color:${typeColor};">${fmtConc(item.maxConc)}</span> µg/m³
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
                    <strong>Wind:</strong> ${item.params.wind_speed}m/s from ${item.params.wind_direction}°<br>
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

    // Hide all layers first
    clearMapLayers();

    // In our simplified screening visualization, we only ever show one map layer at a time
    // If they turned THIS one on, turn others off in state.
    if (item.visible) {
        aerscreenHistory.forEach(h => {
            if (h.runId !== runId) h.visible = false;
        });
        if (item.type === "contour") {
            renderContoursOnMap(item.geojson, item.params.lon, item.params.lat);
        } else if (item.peakPoint) {
            AerscreenTool.markPeakOnMap(item.peakPoint, item.params);
        }
    }

    saveToStorage();
    updateAerscreenDrawerList();
}

function removeRun(runId) {
    aerscreenHistory = aerscreenHistory.filter(h => h.runId !== runId);
    clearMapLayers();

    // Check if there is still a visible item
    const visibleItem = aerscreenHistory.find(h => h.visible);
    if (visibleItem) {
        if (visibleItem.type === "contour") {
            renderContoursOnMap(visibleItem.geojson, visibleItem.params.lon, visibleItem.params.lat);
        } else if (visibleItem.peakPoint) {
            AerscreenTool.markPeakOnMap(visibleItem.peakPoint, visibleItem.params);
        }
    }

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
export function destroyDispersion() {
    clearMapLayers();
    aerscreenHistory = [];
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
document.addEventListener("smokelyze-reset-aerscreen", () => {
    destroyDispersion();
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

