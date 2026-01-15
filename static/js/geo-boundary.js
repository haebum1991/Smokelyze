
/**
 * Boundary Loader Module
 * Handles loading and caching of the map boundaries GeoJSON file
 * Used for point-in-polygon calculations to determine state/region for coordinates
 */

// Cache for the loaded boundary GeoJSON
let boundaryGeoJSON = null;
let boundaryLoadPromise = null;

/**
 * Load and decompress the boundary GeoJSON file
 * @returns {Promise<Object>} GeoJSON FeatureCollection
 */
export async function loadBoundaries() {
    // Return cached data if already loaded
    if (boundaryGeoJSON) {
        return boundaryGeoJSON;
    }

    // Return existing promise if already loading
    if (boundaryLoadPromise) {
        return boundaryLoadPromise;
    }

    // Start loading
    boundaryLoadPromise = (async () => {
        try {
            console.log("Loading boundary file...");
            const startTime = performance.now();

            const response = await fetch("/map_boundaries_raw_4326.geojson.gz");
            
            if (!response.ok) {
                throw new Error(`Failed to load boundaries: HTTP ${response.status}`);
            }

            // Decompress gzip
            const ds = new DecompressionStream("gzip");
            const decompressedStream = response.body.pipeThrough(ds);
            const reader = decompressedStream.getReader();

            let text = "";
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                text += new TextDecoder().decode(value);
            }

            // Parse JSON
            boundaryGeoJSON = JSON.parse(text);
            
            const loadTime = (performance.now() - startTime).toFixed(0);
            console.log(`Boundary file loaded: ${boundaryGeoJSON.features.length} features in ${loadTime}ms`);

            return boundaryGeoJSON;
        } catch (error) {
            console.error("Failed to load boundary file:", error);
            boundaryLoadPromise = null; // Reset promise to allow retry
            throw error;
        }
    })();

    return boundaryLoadPromise;
}

/**
 * Get boundary features (loads if not already loaded)
 * @returns {Promise<Array>} Array of boundary features
 */
export async function getBoundaryFeatures() {
    const geojson = await loadBoundaries();
    return geojson.features;
}

/**
 * Clear cached boundary data (useful for testing)
 */
export function clearBoundaryCache() {
    boundaryGeoJSON = null;
    boundaryLoadPromise = null;
    console.log("Boundary cache cleared");
}

