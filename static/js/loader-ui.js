
/**
 * UI 피드백 및 시각화: 로딩 스피너, 에러 메시지(Toast), 산불 뉴스 목록 렌더링
 */
 
import * as utils from "./utils.js";
import { setLoadedNewsFeatures } from "./loader-state.js";

let loadingCounter = 0;

export function toggleSpinner(show) {
    const spinner = document.getElementById("MapLoadingSpinner");
    if (!spinner) return;
    if (show) {
        loadingCounter++;
        spinner.style.display = "block";
    } else {
        loadingCounter--;
        if (loadingCounter <= 0) {
            loadingCounter = 0;
            spinner.style.display = "none";
        }
    }
}

export function showErrorToast(message, type = "error") {
    const toast = document.createElement("div");
    toast.innerHTML = message;

    let bgColor = "rgba(220, 53, 69, 0.9)"; // Default Red
    if (type === "info") bgColor = "rgba(106, 17, 203, 0.9)"; // Purple

    Object.assign(toast.style, {
        position: "fixed",
        textAlign: "center",
        top: "40%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        backgroundColor: bgColor,
        color: "white",
        padding: "1rem 2rem",
        borderRadius: "0.5rem",
        boxShadow: "0 0.2rem 1rem rgba(0,0,0,0.2)",
        zIndex: "var(--z-index-message)",
        fontSize: "1.6rem",
        fontWeight: "bold",
        pointerEvents: "none",
        transition: "opacity 0.3s ease"
    });

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 500);
    }, 3000);
}

export function updateWildfireNewsList(features) {
    const listContainer = document.getElementById("WFnewsDrawerList");
    const drawer = document.getElementById("WFnewsDrawer");
    if (!listContainer || !drawer) return;

    let allNews = features || [];

    // Sort: items with coordinates first
    allNews.sort((a, b) => {
        const aCoords = a.geometry && a.geometry.coordinates;
        const bCoords = b.geometry && b.geometry.coordinates;
        const aHas = Array.isArray(aCoords) && aCoords.length >= 2;
        const bHas = Array.isArray(bCoords) && bCoords.length >= 2;
        if (aHas && !bHas) return -1;
        if (!aHas && bHas) return 1;
        return 0;
    });

    setLoadedNewsFeatures(allNews);

    const totalCount = allNews.length;
    const titleEl = document.getElementById("WFnewsDrawerTitle");
    if (titleEl) {
        titleEl.textContent = `Wildfire News (${totalCount})`;
    }

    if (totalCount === 0) {
        listContainer.innerHTML = '<div style="padding:2rem; text-align:center; color:var(--text-main); font-size:1.4rem;">No additional news today or <br>No data was collected on this date.</div>';
        return;
    }

    let html = "";
    allNews.forEach((f, idx) => {
        const p = f.properties;
        const coords = f.geometry && f.geometry.coordinates;
        const hasCoords = Array.isArray(coords) && coords.length >= 2;

        let zoomButton = "";
        if (hasCoords) {
            zoomButton = `
          <button class="WFnews-item-link action-news-location"
            data-lon="${utils.ESML(String(coords[0]))}"
            data-lat="${utils.ESML(String(coords[1]))}"
            data-idx="${idx}">
            State location
          </button>
        `;
        }

        html += `
      <div class="WFnews-item">
        <div class="WFnews-item-title"> (${idx + 1}) ${utils.ESML(p.title)}</div>
        <div class="WFnews-item-meta">
          State: ${utils.ESML(p.location)}<br>
            ${utils.ESML(p.published)} UTC</div>
        <hr class="WFnews-item-hr">
          <div style="text-align:right">
            ${zoomButton}
            <button class="WFnews-item-link action-read-news" data-link="${utils.ESML(p.link)}">
              Read
            </button>
          </div>
      </div>
      `;
    });

    listContainer.innerHTML = html;
}

export function showTaskNotification(title, initialStatus = "Initializing...") {
    const container = document.createElement("div");
    container.className = "task-notification";
    
    container.innerHTML = `
        <div class="task-icon spinning">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
        </div>
        <div class="task-content">
            <div class="task-title">${title}</div>
            <div class="task-status">${initialStatus}</div>
        </div>
    `;

    document.body.appendChild(container);

    return {
        update: (status, type = "running") => {
            const statusEl = container.querySelector(".task-status");
            const iconEl = container.querySelector(".task-icon");
            if (statusEl) statusEl.innerText = status;
            
            if (type === "success") {
                container.classList.add("complete");
                iconEl.classList.remove("spinning");
                iconEl.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2ecc71" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                setTimeout(() => {
                    container.style.opacity = "0";
                    container.style.transform = "translateX(20px)";
                    setTimeout(() => container.remove(), 500);
                }, 4000);
            } else if (type === "error") {
                container.classList.add("error");
                iconEl.classList.remove("spinning");
                iconEl.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff4d4d" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
                setTimeout(() => {
                    container.style.opacity = "0";
                    setTimeout(() => container.remove(), 500);
                }, 6000);
            }
        },
        close: () => {
            container.style.opacity = "0";
            setTimeout(() => container.remove(), 500);
        }
    };
}

