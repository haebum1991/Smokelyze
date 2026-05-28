
/**
 * UI Telemetry Panel (Admin Only)
 * Monitors active WebGL contexts and JS heap memory in real-time.
 * Placed to the right of FigurePageToggle, visible only to admins on PC.
 */

let webglRefs = [];
let lastActiveContextsSignature = "";

let telemetryContainer = null;
let webglValueSpan = null;
let heapValueSpan = null;

/**
 * Updates telemetry data (reference filtering, change detection, console logging, UI updates)
 * Runs in a single, highly optimized pass.
 */
function updateTelemetry() {
    const aliveRefs = [];
    const activeContexts = [];
    const seen = new Set();

    // Single-pass: filter out dead WeakRefs, deduplicate, and identify active contexts
    for (const ref of webglRefs) {
        const ctx = ref.deref();
        if (ctx && !seen.has(ctx)) {
            seen.add(ctx);
            aliveRefs.push(ref);

            const isConnected = ctx.canvas?.isConnected || false;
            const isLost = typeof ctx.isContextLost === "function" ? ctx.isContextLost() : false;
            if (isConnected && !isLost) {
                activeContexts.push(ctx);
            }
        }
    }
    webglRefs = aliveRefs;

    // Generate a simple signature based on canvas identities to detect state changes
    const activeSignature = activeContexts
        .map(ctx => ctx.canvas ? `${ctx.canvas.id || "no_id"}.${ctx.canvas.className || "no_class"}` : "no_canvas")
        .join("|");

    // Only walk the DOM and log to the console if the active WebGL contexts have actually changed
    if (activeSignature !== lastActiveContextsSignature) {
        lastActiveContextsSignature = activeSignature;

        if (activeContexts.length > 0) {
            const lines = activeContexts.map((ctx, i) => {
                const canvas = ctx.canvas;
                if (!canvas) return `  #${i + 1}: [No Canvas]`;

                const parent = canvas.parentElement || { tagName: "NO_PARENT", className: "" };
                const grandparent = parent.parentElement || { tagName: "NO_GRANDPARENT", id: "", className: "" };

                const parentClass = (parent.className || "").trim().replace(/\s+/g, ".");
                const grandparentClass = (grandparent.className || "").trim().replace(/\s+/g, ".");

                return `  #${i + 1}: ID="${canvas.id || ""}", Class="${canvas.className || ""}", Parent=${parent.tagName}${parentClass ? "." + parentClass : ""}, Grandparent=${grandparent.tagName}${grandparent.id ? "#" + grandparent.id : ""}${grandparentClass ? "." + grandparentClass : ""}, isConnected=true`;
            }).join("\n");

            console.log(`[Telemetry WebGL Debug] Active: ${activeContexts.length} / Tracked: ${aliveRefs.length}
${lines}`);
        } else {
            console.log(`[Telemetry WebGL Debug] Active: 0 / Tracked: ${aliveRefs.length}`);
        }
    }

    // Update values in the UI pill
    if (webglValueSpan) {
        const count = activeContexts.length;
        let color = "#48bb78"; // HSL green
        if (count >= 10) color = "#ecc94b"; // HSL yellow
        if (count >= 14) color = "#f56565"; // HSL red

        webglValueSpan.style.color = color;
        webglValueSpan.textContent = `${count}/16`;
    }

    if (heapValueSpan) {
        if (performance && performance.memory) {
            const heap = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
            heapValueSpan.textContent = `${heap} MB`;
        } else {
            heapValueSpan.textContent = "N/A";
        }
    }
}


/**
 * Initializes the Telemetry widget
 */
export function initTelemetry() {
    // Intercept WebGL context creation to track allocations
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, attributes) {
        const context = originalGetContext.call(this, type, attributes);
        if (context && (type === "webgl" || type === "webgl2" || type === "experimental-webgl")) {
            const isAlreadyTracked = webglRefs.some(ref => ref.deref() === context);
            if (!isAlreadyTracked) {
                webglRefs.push(new WeakRef(context));
                updateTelemetry();
            }
        }
        return context;
    };

    // Inject CSS styling
    const style = document.createElement("style");
    style.innerHTML = `
        #TelemetryPanel {
            display: none;
            position: absolute;
            bottom: -4.8rem;
            left: 10.5rem;
            z-index: var(--z-FigurePage-toggle); 
            height: 3.6rem;
            padding: 0 1.2rem;
            border-radius: var(--border-radius-0p8rem);
            background: var(--color-bg);
            border: 0.1rem solid var(--card-shadow);
            color: var(--text-strong);
            font-size: 1.3rem;
            align-items: center;
            gap: 1.5rem;
            white-space: nowrap;
            transition: all 0.3s ease;
        }
        #TelemetryPanel:hover {
            transform: scale(1.05);
        }
        .telemetry-item {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        .telemetry-label,
        .telemetry-value {
            font-weight: bold;
        }
        @media (max-width: 1024px) {
            #TelemetryPanel {
                display: none !important; /* Always force hide on mobile/tablet */
            }
        }
    `;
    document.head.appendChild(style);

    // Build Capsule UI
    telemetryContainer = document.createElement("div");
    telemetryContainer.id = "TelemetryPanel";

    const webglItem = document.createElement("div");
    webglItem.className = "telemetry-item";
    webglItem.innerHTML = `
        <span class="telemetry-label">WebGL:</span>
        <span class="telemetry-value" id="telemetry-webgl-val">0/16</span>
    `;
    webglValueSpan = webglItem.querySelector("#telemetry-webgl-val");

    const heapItem = document.createElement("div");
    heapItem.className = "telemetry-item";
    heapItem.innerHTML = `
        <span class="telemetry-label">Memory:</span>
        <span class="telemetry-value" id="telemetry-heap-val" style="color: #38bdf8;">0 MB</span>
    `;
    heapValueSpan = heapItem.querySelector("#telemetry-heap-val");

    telemetryContainer.appendChild(webglItem);
    telemetryContainer.appendChild(heapItem);

    // Position next to FigurePageToggle inside MapWrapper if possible
    const toggleBtn = document.getElementById("FigurePageToggle");
    if (toggleBtn && toggleBtn.parentElement) {
        toggleBtn.parentElement.appendChild(telemetryContainer);
    } else {
        document.body.appendChild(telemetryContainer);
    }

    // Initial visibility check from sessionStorage (managed centrally by signin.js thereafter)
    const isAdmin = sessionStorage.getItem("smokelyze_is_admin") === "true";
    telemetryContainer.style.display = isAdmin ? "flex" : "none";

    // Refresh every 1000ms
    setInterval(updateTelemetry, 1000);
    updateTelemetry();
}

// Automatically initialize telemetry on import
initTelemetry();

