
const isMobile = window.innerWidth <= 1024;

export const mapConfig = {
    style: "https://tiles.openfreemap.org/styles/liberty",
    center: [-98.5, 39.8],
    zoom: isMobile ? 2.5 : 3.5
};

function createMap() {
    // Check if we are on the map page (have container and library)
    if (typeof maplibregl === "undefined") {
        console.warn("Maplibre GL not found. Skipping map initialization.");
        return null;
    }
    if (!document.getElementById("map")) {
        console.warn("Map container (#map) not found. Skipping map initialization.");
        return null;
    }

    return new maplibregl.Map({
        container: "map",
        style: mapConfig.style,
        center: mapConfig.center,
        zoom: mapConfig.zoom,
        attributionControl: false,
        preserveDrawingBuffer: true
    });
}

export const map = createMap();

