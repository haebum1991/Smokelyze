
/**
 * Geometry Utilities Module
 * Provides point-in-polygon calculations and coordinate-to-state mapping
 * Uses ray-casting algorithm for efficient polygon containment testing
 */

import { getBoundaryFeatures } from "./geo-boundary.js";

// Cache for coordinate → state ID mappings
// Key format: "lon,lat" (rounded to 3 decimals)
const stateCache = new Map();

/**
 * Ray-casting algorithm for point-in-polygon test
 * @param {Array<number>} point - [longitude, latitude]
 * @param {Array<Array<number>>} polygon - Array of [lon, lat] coordinates
 * @returns {boolean} True if point is inside polygon
 */
function pointInPolygon(point, polygon) {
    const [x, y] = point;
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [xi, yi] = polygon[i];
        const [xj, yj] = polygon[j];

        const intersect = ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

        if (intersect) inside = !inside;
    }

    return inside;
}

/**
 * Test if point is inside a GeoJSON geometry
 * Supports Polygon and MultiPolygon geometries
 * @param {Array<number>} point - [longitude, latitude]
 * @param {Object} geometry - GeoJSON geometry object
 * @returns {boolean} True if point is inside geometry
 */
function pointInGeometry(point, geometry) {
    if (!geometry || !geometry.type || !geometry.coordinates) {
        return false;
    }

    if (geometry.type === "Polygon") {
        // Polygon: array of rings, first is outer, rest are holes
        const outerRing = geometry.coordinates[0];
        if (!pointInPolygon(point, outerRing)) {
            return false;
        }

        // Check if point is in any holes
        for (let i = 1; i < geometry.coordinates.length; i++) {
            if (pointInPolygon(point, geometry.coordinates[i])) {
                return false; // Point is in a hole
            }
        }

        return true;
    } else if (geometry.type === "MultiPolygon") {
        // MultiPolygon: array of polygons
        for (const polygon of geometry.coordinates) {
            const outerRing = polygon[0];
            if (!pointInPolygon(point, outerRing)) {
                continue;
            }

            // Check holes
            let inHole = false;
            for (let i = 1; i < polygon.length; i++) {
                if (pointInPolygon(point, polygon[i])) {
                    inHole = true;
                    break;
                }
            }

            if (!inHole) {
                return true;
            }
        }

        return false;
    }

    return false;
}

/**
 * Find which boundary feature contains the given point
 * @param {number} lon - Longitude
 * @param {number} lat - Latitude
 * @param {Array<Object>} boundaryFeatures - Array of GeoJSON features
 * @returns {Object|null} Matching feature or null if not found
 */
function findContainingFeature(lon, lat, boundaryFeatures) {
    const point = [lon, lat];

    for (const feature of boundaryFeatures) {
        if (pointInGeometry(point, feature.geometry)) {
            return feature;
        }
    }

    return null;
}

/**
 * Get state/region ID for a coordinate point
 * Uses caching to avoid repeated calculations for the same coordinates
 * @param {number} lon - Longitude
 * @param {number} lat - Latitude
 * @returns {Promise<string|null>} State ID or null if not found
 */
export async function getStateForCoordinate(lon, lat) {
    // Round coordinates to 3 decimals for cache key (same as AirNow data)
    const roundedLon = Math.round(lon * 1000) / 1000;
    const roundedLat = Math.round(lat * 1000) / 1000;
    const cacheKey = `${roundedLon},${roundedLat}`;

    // Check cache first
    if (stateCache.has(cacheKey)) {
        return stateCache.get(cacheKey);
    }

    // Load boundaries and find containing feature
    try {
        const boundaryFeatures = await getBoundaryFeatures();
        const feature = findContainingFeature(roundedLon, roundedLat, boundaryFeatures);

        const stateId = feature ? feature.properties.ID : null;

        // Cache the result
        stateCache.set(cacheKey, stateId);

        return stateId;
    } catch (error) {
        console.error("Error getting state for coordinate:", error);
        return null;
    }
}

/**
 * Batch process multiple coordinates to get their states
 * More efficient than calling getStateForCoordinate repeatedly
 * @param {Array<{lon: number, lat: number}>} coordinates - Array of coordinate objects
 * @returns {Promise<Array<string|null>>} Array of state IDs in same order as input
 */
export async function getStatesForCoordinates(coordinates) {
    const startTime = performance.now();

    // Load boundaries once
    const boundaryFeatures = await getBoundaryFeatures();

    const results = coordinates.map(({ lon, lat }) => {
        const roundedLon = Math.round(lon * 1000) / 1000;
        const roundedLat = Math.round(lat * 1000) / 1000;
        const cacheKey = `${roundedLon},${roundedLat}`;

        // Check cache
        if (stateCache.has(cacheKey)) {
            return stateCache.get(cacheKey);
        }

        // Calculate and cache
        const feature = findContainingFeature(roundedLon, roundedLat, boundaryFeatures);
        const stateId = feature ? feature.properties.ID : null;
        stateCache.set(cacheKey, stateId);

        return stateId;
    });

    const elapsed = (performance.now() - startTime).toFixed(0);
    const cached = coordinates.filter(({ lon, lat }) => {
        const key = `${Math.round(lon * 1000) / 1000},${Math.round(lat * 1000) / 1000}`;
        return stateCache.has(key);
    }).length;

    console.log(`State lookup: ${coordinates.length} points, ${cached} cached, ${elapsed}ms`);

    return results;
}

/**
 * Clear the state cache (useful for testing)
 */
export function clearStateCache() {
    stateCache.clear();
    console.log("State cache cleared");
}

/**
 * Get cache statistics
 * @returns {Object} Cache size and hit information
 */
export function getStateCacheStats() {
    return {
        size: stateCache.size,
        entries: Array.from(stateCache.entries()).slice(0, 10) // First 10 for debugging
    };
}

