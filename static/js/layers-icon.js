
/**
 * 아이콘 렌더링: 캔버스(Canvas)를 사용하여 산불 뉴스나 사건 지점 등에 쓰이는 펄싱(Pulsing) 아이콘을 생성
 */

// --- Constants for standardized look ---
export const ICON_CONF = {
    INNER_RADIUS_RATIO: 0.5,
    PULSE_START_RATIO: 0.4,
    PULSE_SPREAD_RATIO: 0.6,
    STROKE_WIDTH_RATIO: 0.02,
    SHADOW_BLUR_RATIO: 0.05
};

// --- Core Drawing Functions (Pure Logic) ---
function drawIconCoreNews(ctx, size, t) {
    const x = size / 2;
    const y = size / 2;
    const r = size / 2;
    ctx.clearRect(0, 0, size, size);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // 1. Outer pulse
    const outerRadius = r * (ICON_CONF.PULSE_START_RATIO + ICON_CONF.PULSE_SPREAD_RATIO * t);
    ctx.beginPath();
    ctx.arc(x, y, outerRadius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0, 150, 255, ${0.4 * (1 - t)})`;
    ctx.fill();

    // 2. Inner circular badge
    ctx.beginPath();
    ctx.arc(x, y, r * ICON_CONF.INNER_RADIUS_RATIO, 0, Math.PI * 2);
    ctx.fillStyle = "#0072ff";
    ctx.shadowBlur = size * ICON_CONF.SHADOW_BLUR_RATIO;
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.fill();
    ctx.shadowBlur = 0;

    // 3. "NEWS" Text
    const fontSize = Math.floor(size * 0.3);
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeStyle = "black";
    ctx.lineWidth = size * 0.1;
    ctx.strokeText("NEWS", x, y);
    ctx.fillStyle = "white";
    ctx.fillText("NEWS", x, y);

    // 4. Stroke
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = size * ICON_CONF.STROKE_WIDTH_RATIO;
    ctx.stroke();
}

function drawIconCoreFire(ctx, size, t) {
    const x = size / 2;
    const y = size / 2;
    const r = size / 2;
    ctx.clearRect(0, 0, size, size);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // 1. Outer pulse
    const outerRadius = r * (ICON_CONF.PULSE_START_RATIO + ICON_CONF.PULSE_SPREAD_RATIO * t);
    ctx.beginPath();
    ctx.arc(x, y, outerRadius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 69, 0, ${0.4 * (1 - t)})`;
    ctx.fill();

    // 2. Inner circular badge
    ctx.beginPath();
    ctx.arc(x, y, r * ICON_CONF.INNER_RADIUS_RATIO, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.shadowBlur = size * ICON_CONF.SHADOW_BLUR_RATIO;
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.fill();
    ctx.shadowBlur = 0;

    // 3. Flame Shape
    const s = r;
    const flicker = Math.sin(performance.now() / 60) * 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y - s * 0.7 - flicker);
    ctx.bezierCurveTo(x - s * 0.5, y - s * 0.2, x - s * 0.3, y + s * 0.3, x, y + s * 0.4);
    ctx.bezierCurveTo(x + s * 0.3, y + s * 0.3, x + s * 0.5, y - s * 0.2, x, y - s * 0.7 - flicker);

    const pulseGrad = ctx.createLinearGradient(x, y - s, x, y + s);
    pulseGrad.addColorStop(0, "#ff4500");
    pulseGrad.addColorStop(1, "#ffcc00");
    ctx.fillStyle = pulseGrad;
    ctx.fill();

    // 4. Stroke
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = size * ICON_CONF.STROKE_WIDTH_RATIO;
    ctx.stroke();
}

function drawIconCoreAlert(ctx, size, t) {
    const x = size / 2;
    const y = size / 2;
    const r = size / 2;
    ctx.clearRect(0, 0, size, size);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // 1. Outer pulse (Red)
    const outerRadius = r * (ICON_CONF.PULSE_START_RATIO + ICON_CONF.PULSE_SPREAD_RATIO * t);
    ctx.beginPath();
    ctx.arc(x, y, outerRadius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(220, 20, 60, ${0.4 * (1 - t)})`;
    ctx.fill();

    // 2. Inner circular badge
    ctx.beginPath();
    ctx.arc(x, y, r * ICON_CONF.INNER_RADIUS_RATIO, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r * ICON_CONF.INNER_RADIUS_RATIO);
    grad.addColorStop(0, "#ff4d4d");
    grad.addColorStop(1, "#b30000");
    ctx.fillStyle = grad;
    ctx.shadowBlur = size * ICON_CONF.SHADOW_BLUR_RATIO;
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.fill();
    ctx.shadowBlur = 0;

    // 3. Exclamation Mark (!)
    ctx.fillStyle = "#ffffff";
    const fontSize = Math.floor(size * 0.5);
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("!", x, y + (size * 0.02));

    // 4. Stroke
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = size * ICON_CONF.STROKE_WIDTH_RATIO;
    ctx.stroke();
}

// --- MapLibre Interface (Registers with map) ---

export function iconPulsingFire(map, size) {
    return {
        width: size,
        height: size,
        data: new Uint8Array(size * size * 4),
        onAdd() {
            const canvas = document.createElement("canvas");
            canvas.width = this.width;
            canvas.height = this.height;
            this.context = canvas.getContext("2d", { willReadFrequently: true });
        },
        render() {
            if (this._rendered) return false;
            drawIconCoreFire(this.context, this.width, 0);
            this.data = this.context.getImageData(0, 0, this.width, this.height).data;
            this._rendered = true;
            return true;
        }
    };
}

export function iconPulsingNews(map, size) {
    return {
        width: size,
        height: size,
        data: new Uint8Array(size * size * 4),
        onAdd() {
            const canvas = document.createElement("canvas");
            canvas.width = this.width;
            canvas.height = this.height;
            this.context = canvas.getContext("2d", { willReadFrequently: true });
        },
        render() {
            if (this._rendered) return false;
            drawIconCoreNews(this.context, this.width, 0);
            this.data = this.context.getImageData(0, 0, this.width, this.height).data;
            this._rendered = true;
            return true;
        }
    };
}

export function iconPulsingAlert(map, size) {
    return {
        width: size,
        height: size,
        data: new Uint8Array(size * size * 4),
        onAdd() {
            const canvas = document.createElement("canvas");
            canvas.width = this.width;
            canvas.height = this.height;
            this.context = canvas.getContext("2d", { willReadFrequently: true });
        },
        render() {
            if (this._rendered) return false;
            drawIconCoreAlert(this.context, this.width, 0);
            this.data = this.context.getImageData(0, 0, this.width, this.height).data;
            this._rendered = true;
            return true;
        }
    };
}

// --- UI Interface (For Menu/Accordion) ---
/**
 * Renders a specific pulsing icon canvas
 */
function renderUIPulsingIcon(canv) {
    const type = canv.getAttribute("data-type");
    const size = canv.width;
    const ctx = canv.getContext("2d", { willReadFrequently: true });

    if (type === "fire") drawIconCoreFire(ctx, size, 0);
    else if (type === "news") drawIconCoreNews(ctx, size, 0);
    else if (type === "alert") drawIconCoreAlert(ctx, size, 0);
}

/**
 * Initializes all pulsing icons currently in the DOM
 */
export function initUIPulsingIcons() {
    setTimeout(() => {
        const canvases = document.querySelectorAll(".ui-pulsing-icon");
        canvases.forEach(renderUIPulsingIcon);
    }, 500);
}

/**
 * Automatic Observer: Detects whenever a new icon canvas is added to the DOM (like in a tutorial popover)
 */
const uiIconObserver = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
            if (node.nodeType !== 1) return; // Only elements
            
            // Check the node itself or its children
            const canvases = node.classList?.contains("ui-pulsing-icon") 
                ? [node] 
                : node.querySelectorAll?.(".ui-pulsing-icon") || [];
            
            canvases.forEach(renderUIPulsingIcon);
        });
    });
});

// Start observing the whole document for added icons
uiIconObserver.observe(document.body, { childList: true, subtree: true });

