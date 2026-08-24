
/**
 * 아이콘 렌더링: 캔버스(Canvas)를 사용하여 산불 마커, 뉴스, 알림 아이콘 생성 (정적 렌더링)
 */

// --- Core Drawing Functions (Pure Logic) ---
export function drawIconCoreNews(ctx, size) {
    const x = size / 2;
    const y = size / 2;
    const radius = size * 0.25;
    ctx.clearRect(0, 0, size, size);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // 1. Circular badge
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = "#0072ff";
    ctx.shadowBlur = size * 0.05;
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = Math.max(1, size * 0.02);
    ctx.stroke();

    // 2. "NEWS" Text
    const fontSize = Math.floor(size * 0.3);
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeStyle = "black";
    ctx.lineWidth = size * 0.08;
    ctx.strokeText("NEWS", x, y);
    ctx.fillStyle = "white";
    ctx.fillText("NEWS", x, y);
}

// Vector paths for Flame Icon (viewBox: 0 0 92.27 122.88)
const PATH_FIRE_OUTER = new Path2D("M18.61,54.89C15.7,28.8,30.94,10.45,59.52,0C42.02,22.71,74.44,47.31,76.23,70.89 c4.19-7.15,6.57-16.69,7.04-29.45c21.43,33.62,3.66,88.57-43.5,80.67c-4.33-0.72-8.5-2.09-12.3-4.13C10.27,108.8,0,88.79,0,69.68 C0,57.5,5.21,46.63,11.95,37.99C12.85,46.45,14.77,52.76,18.61,54.89L18.61,54.89z");
const PATH_FIRE_INNER = new Path2D("M33.87,92.58c-4.86-12.55-4.19-32.82,9.42-39.93c0.1,23.3,23.05,26.27,18.8,51.14 c3.92-4.44,5.9-11.54,6.25-17.15c6.22,14.24,1.34,25.63-7.53,31.43c-26.97,17.64-50.19-18.12-34.75-37.72 C26.53,84.73,31.89,91.49,33.87,92.58L33.87,92.58z");

export function drawIconCoreFire(ctx, size) {
    ctx.clearRect(0, 0, size, size);
    ctx.save();

    // Scale 92.27 x 122.88 vector bounds to be slightly slimmer and centered
    const scaleY = (size * 0.92) / 122.88;
    const scaleX = scaleY * 0.80;
    const offsetX = (size - 92.27 * scaleX) / 2;
    const offsetY = (size - 122.88 * scaleY) / 2;

    ctx.translate(offsetX, offsetY);
    ctx.scale(scaleX, scaleY);

    // 1. Outer Flame (#EC6F59)
    ctx.fillStyle = "#EC6F59";
    ctx.fill(PATH_FIRE_OUTER);

    // 2. Inner Flame (#FAD15C)
    ctx.fillStyle = "#FAD15C";
    ctx.fill(PATH_FIRE_INNER);

    ctx.restore();
}

export function drawIconCoreAlert(ctx, size) {
    const x = size / 2;
    const y = size / 2;
    const radius = size * 0.25;
    ctx.clearRect(0, 0, size, size);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // 1. Circular badge
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    grad.addColorStop(0, "#ff4d4d");
    grad.addColorStop(1, "#b30000");
    ctx.fillStyle = grad;
    ctx.shadowBlur = size * 0.05;
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = Math.max(1, size * 0.02);
    ctx.stroke();

    // 2. Exclamation Mark (!)
    ctx.fillStyle = "#ffffff";
    const fontSize = Math.floor(size * 0.5);
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("!", x, y + (size * 0.02));
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
            this.context = canvas.getContext("2d");
        },
        render() {
            if (this._rendered) return false;
            drawIconCoreFire(this.context, this.width);
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
            this.context = canvas.getContext("2d");
        },
        render() {
            if (this._rendered) return false;
            drawIconCoreNews(this.context, this.width);
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
            this.context = canvas.getContext("2d");
        },
        render() {
            if (this._rendered) return false;
            drawIconCoreAlert(this.context, this.width);
            this.data = this.context.getImageData(0, 0, this.width, this.height).data;
            this._rendered = true;
            return true;
        }
    };
}

// --- UI Interface (For Menu/Accordion) ---

export function initUIPulsingIcons() {
    setTimeout(() => {
        const canvases = document.querySelectorAll(".ui-pulsing-icon");
        canvases.forEach(canv => {
            const type = canv.getAttribute("data-type");
            const size = canv.width;
            const ctx = canv.getContext("2d");

            if (type === "fire") drawIconCoreFire(ctx, size);
            else if (type === "news") drawIconCoreNews(ctx, size);
            else if (type === "alert") drawIconCoreAlert(ctx, size);
        });
    }, 500);
}

