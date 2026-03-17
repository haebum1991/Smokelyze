
const isMobile = window.innerWidth <= 1024;

export const mapConfig = {
    style: "https://tiles.openfreemap.org/styles/liberty",
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
        preserveDrawingBuffer: false
    });

    // Handle WebGL context loss (black screen + broken icons on low-end GPUs)
    const canvas = m.getCanvas();
    let contextLostCount = 0;
    const MAX_RESTORE_ATTEMPTS = 2;

    canvas.addEventListener("webglcontextlost", (e) => {
        e.preventDefault();
        contextLostCount++;
        console.warn(`WebGL context lost (${contextLostCount}/${MAX_RESTORE_ATTEMPTS})`);
    });

    canvas.addEventListener("webglcontextrestored", () => {
        if (contextLostCount <= MAX_RESTORE_ATTEMPTS) {
            console.log("WebGL context restored — reloading map style.");
            m.setStyle(mapConfig.style);
        } else {
            console.error("WebGL context lost too many times. Please reload the page.");
            const toast = document.getElementById("ErrorToast");
            if (toast) {
                toast.innerHTML = "Map rendering failed due to limited GPU resources. Please reload the page.";
                toast.style.display = "block";
            }
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

