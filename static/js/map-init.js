
const isMobile = window.innerWidth <= 1024;

// Standard Vector style
// export const mapConfig = {
//     style: "https://tiles.openfreemap.org/styles/liberty",
//     center: [-98.5, 39.8],
//     zoom: isMobile ? 2.5 : 3.5
// };

export const MAP_STYLES = {
    osm: {
        id: "osm",
        name: "Default",
        type: "raster",
        style: {
            version: 8,
            sources: {
                "raster-tiles": {
                    type: "raster",
                    tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
                    tileSize: 256,
                    attribution: "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors"
                }
            },
            layers: [{ id: "background-tiles", type: "raster", source: "raster-tiles", minzoom: 0, maxzoom: 20 }]
        }
    },
    light: {
        id: "light",
        name: "Light",
        type: "raster",
        style: {
            version: 8,
            sources: {
                "raster-tiles": {
                    type: "raster",
                    tiles: ["https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png"],
                    tileSize: 256,
                    attribution: "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a>, <a href='https://carto.com/attributions'>CARTO</a>"
                }
            },
            layers: [{ id: "background-tiles", type: "raster", source: "raster-tiles", minzoom: 0, maxzoom: 20 }]
        }
    },
    topo: {
        id: "topo",
        name: "Topo",
        type: "raster",
        style: {
            version: 8,
            sources: {
                "raster-tiles": {
                    type: "raster",
                    tiles: ["https://tile.opentopomap.org/{z}/{x}/{y}.png"],
                    tileSize: 256,
                    attribution: "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a>, SRTM | Map style: &copy; <a href='https://opentopomap.org'>OpenTopoMap</a>"
                }
            },
            layers: [{ id: "background-tiles", type: "raster", source: "raster-tiles", minzoom: 0, maxzoom: 20 }]
        }
    },
    vector: {
        id: "vector",
        name: "Vector",
        type: "vector",
        style: "https://tiles.openfreemap.org/styles/liberty"
    }
};

// Initial Style Selection
const savedStyleId = sessionStorage.getItem("mapStyle") || "osm";
const initialStyle = MAP_STYLES[savedStyleId]?.style || MAP_STYLES.osm.style;

export const mapConfig = {
    style: initialStyle,
    center: [-98.5, 39.8],
    zoom: isMobile ? 2.5 : 3.5
};

function createMap() {
    // Check if we are on the map page (have container and library)
    if (typeof maplibregl === "undefined") {
        return null;
    }
    if (!document.getElementById("map")) {
        return null;
    }

    const m = new maplibregl.Map({
        container: "map",
        style: mapConfig.style,
        center: mapConfig.center,
        zoom: mapConfig.zoom,
        attributionControl: false,
        
        // Performance optimizations for low-end/integrated GPUs
        preserveDrawingBuffer: false,
        crossSourceCollisions: false, // Disables label collisions between sources
        fadeDuration: 0           // Disable cross-fading between zoom levels
    });

    // Handle WebGL context loss (black screen on low-end GPUs)
    const canvas = m.getCanvas();
    let contextLostCount = 0;

    // Track auto-reloads across page loads to prevent infinite loop
    const reloadKey = "webgl_reload_count";
    const reloadTimeKey = "webgl_reload_time";
    const pastReloads = parseInt(sessionStorage.getItem(reloadKey) || "0");
    const lastReloadTime = parseInt(sessionStorage.getItem(reloadTimeKey) || "0");

    // Reset counter if last reload was more than 60s ago
    if (Date.now() - lastReloadTime > 60000) {
        sessionStorage.setItem(reloadKey, "0");
    }

    canvas.addEventListener("webglcontextlost", (e) => {
        e.preventDefault();
        contextLostCount++;
        console.warn(`WebGL context lost (attempt ${contextLostCount})`);
    });

    canvas.addEventListener("webglcontextrestored", () => {
        if (contextLostCount <= 1) {
            // First time: silently restore
            console.log("WebGL context restored — reloading map style.");
            m.setStyle(mapConfig.style);
        } else if (pastReloads < 2) {
            // Auto-reload (max 2 times within 60s)
            sessionStorage.setItem(reloadKey, String(pastReloads + 1));
            sessionStorage.setItem(reloadTimeKey, String(Date.now()));
            console.error("WebGL context lost repeatedly. Auto-reloading page.");
            window.location.reload();
        } else {
            // Give up: show message instead of infinite reload
            console.error("WebGL context lost too many times. Stopping auto-reload.");
            document.getElementById("map").innerHTML = `
                <div style="display:flex;align-items:center;justify-content:center;height:100%;
                    color:white;font-size:1.6rem;text-align:center;padding:2rem;
                    background:rgba(0,0,0,0.85);">
                    Map rendering failed due to limited GPU resources.<br>
                    Please close other tabs and reload the page.
                </div>`;
        }
    });
    
    // Handle background tile loading errors (Grey screen / Network failure)
    m.on("error", (e) => {
        const err = e.error || {};
        // 429: Too Many Requests (Rate limited by free tile server)
        if (err.status === 429) {
            console.warn("Map tile server rate limit hit (429). Background may not appear.");
        } else if (err.status === 401 || err.status === 403) {
            console.error("Map style/tile access denied:", err);
        }
    });

    return m;
}

// Wait for maplibregl to be available ONLY if we are on the map page
if (document.getElementById("map")) {
    if (typeof maplibregl === "undefined") {
        console.log("Waiting for maplibregl library...");
        while (typeof maplibregl === "undefined") {
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }
}

export const map = createMap();

