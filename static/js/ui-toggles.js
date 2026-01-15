
import { savePatch, read } from "./ui-state.js";
import { clearHighlight, setOnSetNewsDrawer, setOnSetStatsDrawer, setOnSetDescDrawer, setOnSetMapPostDrawer, setOnSetAccordionCollapsed } from "./utils.js";
import { onDescDrawerOpen } from "./ui-param-desc.js";

/**
 * Helper: Close other drawers (especially on mobile)
 * Ensures that only one drawer is open at a time on small screens.
 */
 
const STATS_ICON = `<svg class="ui-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle; margin-right:4px;"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>`;
const DESC_ICON = `<svg class="ui-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle; margin-left:4px;"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`;

export function closeAllExcept(activeId) {
    if (activeId !== "stats") {
        const drawer = document.getElementById("FigurePageDrawer");
        const btn = document.getElementById("FigurePageToggle");
        if (drawer?.classList.contains("open")) {
            drawer.classList.remove("open");
            btn?.classList.remove("active");
            if (btn) btn.textContent = "Stats. ▶";
            document.body.classList.remove("FigurePage-drawer-open");
        }
    }
    if (activeId !== "desc") {
        const drawer = document.getElementById("DescDrawer");
        const btn = document.getElementById("DescToggle");
        if (drawer?.classList.contains("open")) {
            drawer.classList.remove("open");
            btn?.classList.remove("active");
            if (btn) btn.textContent = "◀ Desc.";
        }
    }
    if (activeId !== "news") {
        const drawer = document.getElementById("WFnewsDrawer");
        const btn = document.getElementById("WFnewsToggle");
        if (drawer?.classList.contains("open")) {
            drawer.classList.remove("open");
            document.body.classList.remove("WFnews-drawer-open");
            if (btn) btn.style.display = "block";
        }
    }
    if (activeId !== "MapPost") {
        const drawer = document.getElementById("MapPostDrawer");
        const btn = document.getElementById("MapPostToggle");
        if (drawer?.classList.contains("open")) {
            drawer.classList.remove("open");
            document.body.classList.remove("MapPost-drawer-open");
            if (btn) btn.style.display = "block";
        }
    }
}

/**
 * Helper: Add swipe-to-close functionality (Modularized)
 * @param {HTMLElement} el The element to add swipe to
 */
export function addSwipeClose(el, options = {}) {
    const {
        direction = "right",
        threshold = 60,
        onClose = () => { },
        maxWidth = 1024
    } = options;

    let touchStartX = 0;
    let touchMoveX = 0;
    let isDragging = false;

    el.addEventListener("touchstart", (e) => {
        if (window.innerWidth > maxWidth) return;
        touchStartX = e.touches[0].clientX;
        isDragging = false;
    }, { passive: true });

    el.addEventListener("touchmove", (e) => {
        if (window.innerWidth > maxWidth) return;

        touchMoveX = e.touches[0].clientX;
        const deltaX = touchMoveX - touchStartX;

        // Check if movement is in the closing direction
        const isClosingMove = (direction === "right" && deltaX > 0) || (direction === "left" && deltaX < 0);

        if (isClosingMove) {
            if (!isDragging) {
                el.style.transition = "none";
                isDragging = true;
            }
            el.style.transform = `translateX(${deltaX}px)`;
        } else if (isDragging) {
            el.style.transform = "";
        }
    }, { passive: true });

    el.addEventListener("touchend", () => {
        if (window.innerWidth > maxWidth || !isDragging) return;

        el.style.transition = "";
        const deltaX = touchMoveX - touchStartX;
        const reachedThreshold = (direction === "right" && deltaX > threshold) ||
            (direction === "left" && deltaX < -threshold);

        if (reachedThreshold) {
            onClose();
        }

        el.style.transform = "";
        touchStartX = 0;
        touchMoveX = 0;
        isDragging = false;
    });
}

/**
 * Helper: Close button click handler (Modularized)
 * @param {string|HTMLElement} btnId The ID or target button element
 * @param {Function} onClose Callback function when clicked
 */
export function addCloseHandler(btnId, onClose) {
    const btn = typeof btnId === "string" ? document.getElementById(btnId) : btnId;
    if (!btn) return;
    btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
    });
}

/**
 * 1. Accordion Toggle (Layer Panel on the right)
 */
export function setAccordionCollapsed(collapsed) {
    const page = document.getElementById("AccordionPage");
    const btn = document.getElementById("AccordionToggle");
    if (!page || !btn) return;

    if (collapsed) {
        page.classList.add("collapsed");
        btn.textContent = "Layers ◀";
    } else {
        page.classList.remove("collapsed");
        btn.textContent = "Layers ▶";
    }
    if (savePatch) savePatch({ accordionCollapsed: collapsed });
}

export function initAccordion() {
    const page = document.getElementById("AccordionPage");
    const btn = document.getElementById("AccordionToggle");
    if (!page || !btn) return;

    btn.addEventListener("click", () => {
        const isNowCollapsed = !page.classList.contains("collapsed");
        setAccordionCollapsed(isNowCollapsed);
    });

    // Swipe-to-close (Right-side panel, swipe right to close)
    addSwipeClose(page, {
        direction: "right",
        onClose: () => setAccordionCollapsed(true)
    });

    // Restore state from session
    if (read) {
        const s = read();
        if (s.accordionCollapsed) {
            page.classList.add("collapsed");
            btn.textContent = "Layers ◀";
        }
    }
}


/**
 * 2. Stats Drawer (Left Side)
 */
export function setStatsDrawer(open) {
    const btn = document.getElementById("FigurePageToggle");
    const drawer = document.getElementById("FigurePageDrawer");
    if (!btn || !drawer) return;

    const actualOpen = (open !== undefined) ? open : !drawer.classList.contains("open");
    drawer.classList.toggle("open", actualOpen);
    btn.classList.toggle("active", actualOpen);
    btn.textContent = actualOpen ? "Stats. ◀" : "Stats. ▶";
    document.body.classList.toggle("FigurePage-drawer-open", actualOpen);

    if (actualOpen && window.innerWidth <= 1024) {
        closeAllExcept("stats");
        if (clearHighlight) clearHighlight();
    }
}

export function initStatsDrawer() {
    const btn = document.getElementById("FigurePageToggle");
    const drawer = document.getElementById("FigurePageDrawer");
    const closeBtn = document.getElementById("FigurePageDrawerClose");
    if (!btn || !drawer) return;

    btn.textContent = "Stats. ▶"; // Initial label
    btn.addEventListener("click", () => setStatsDrawer());
    addCloseHandler(closeBtn, () => setStatsDrawer(false));

    // Swipe-to-close (Left-side drawer, swipe left to close)
    addSwipeClose(drawer, {
        direction: "left",
        onClose: () => setStatsDrawer(false)
    });
}


/**
 * 3. Desc Drawer (Description / Right Side)
 */
export function setDescDrawer(open) {
    const btn = document.getElementById("DescToggle");
    const drawer = document.getElementById("DescDrawer");
    if (!btn || !drawer) return;

    const actualOpen = (open !== undefined) ? open : !drawer.classList.contains("open");
    if (actualOpen) {
        drawer.classList.add("open");
        btn.classList.add("active");
        btn.textContent = "▶ Desc.";
        if (window.innerWidth <= 1024) {
            closeAllExcept("desc");
            if (clearHighlight) clearHighlight();
        }
        // Notify Desc module if it needs to refresh content
        if (onDescDrawerOpen) {
            onDescDrawerOpen();
        }
    } else {
        drawer.classList.remove("open");
        btn.classList.remove("active");
        btn.textContent = "◀ Desc.";
    }
}

export function initDescDrawer() {
    const btn = document.getElementById("DescToggle");
    const drawer = document.getElementById("DescDrawer");
    const closeBtn = document.getElementById("DescDrawerClose");
    if (!btn || !drawer) return;

    btn.textContent = "◀ Desc."; // Initial label
    btn.addEventListener("click", () => setDescDrawer());
    addCloseHandler(closeBtn, () => setDescDrawer(false));

    // Swipe-to-close (Right-side drawer, swipe right to close)
    addSwipeClose(drawer, {
        direction: "right",
        onClose: () => setDescDrawer(false)
    });
}


/**
 * 4. Wildfire News Drawer (Floating on the left)
 */
export function setNewsDrawer(open) {
    const btn = document.getElementById("WFnewsToggle");
    const drawer = document.getElementById("WFnewsDrawer");
    if (!btn || !drawer) return;

    const actualOpen = (open !== undefined) ? open : !drawer.classList.contains("open");
    if (actualOpen) {
        if (drawer.classList.contains("open")) return;
        drawer.classList.add("open");
        document.body.classList.add("WFnews-drawer-open");
        btn.style.display = "none";
        if (window.innerWidth <= 1024) {
            closeAllExcept("news");
            if (clearHighlight) clearHighlight();
        }
    } else {
        if (!drawer.classList.contains("open")) return;
        drawer.classList.remove("open");
        document.body.classList.remove("WFnews-drawer-open");
        btn.style.display = "block";
    }
}

export function initNewsDrawer() {
    const btn = document.getElementById("WFnewsToggle");
    const drawer = document.getElementById("WFnewsDrawer");
    const closeBtn = document.getElementById("WFnewsDrawerClose");
    if (!btn || !drawer) return;

    btn.addEventListener("click", () => setNewsDrawer());
    addCloseHandler(closeBtn, () => setNewsDrawer(false));

    // Swipe-to-close (Left-side drawer, swipe left to close)
    addSwipeClose(drawer, {
        direction: "left",
        onClose: () => setNewsDrawer(false)
    });
}

/**
 * 5. MapPost Drawer
 */
export function setMapPostDrawer(open) {
    const btn = document.getElementById("MapPostToggle");
    const drawer = document.getElementById("MapPostDrawer");
    if (!drawer) return;

    const actualOpen = (open !== undefined) ? open : !drawer.classList.contains("open");
    if (actualOpen) {
        if (drawer.classList.contains("open")) return;
        drawer.classList.add("open");
        document.body.classList.add("MapPost-drawer-open");
        if (btn) btn.style.display = "none";
        if (window.innerWidth <= 1024) {
            closeAllExcept("MapPost");
            if (clearHighlight) clearHighlight();
        }
    } else {
        if (!drawer.classList.contains("open")) return;
        drawer.classList.remove("open");
        document.body.classList.remove("MapPost-drawer-open");
        if (btn) btn.style.display = "block";
    }
}

export function initMapPostDrawer() {
    const btn = document.getElementById("MapPostToggle");
    const drawer = document.getElementById("MapPostDrawer");
    const closeBtn = document.getElementById("MapPostDrawerClose");
    if (!drawer) return;

    if (btn) btn.addEventListener("click", () => setMapPostDrawer());
    addCloseHandler(closeBtn, () => setMapPostDrawer(false));

    // Swipe-to-close (Left-side drawer, swipe left to close)
    addSwipeClose(drawer, {
        direction: "left",
        onClose: () => setMapPostDrawer(false)
    });
}

/**
 * 6. Checkbox & Drawer Sync Logic
 */
export function initCheckboxDrawerSync() {
    const newsCb = document.getElementById("layer-wildfire-news");
    const MapPostCb = document.getElementById("layer-MapPost");
    if (!newsCb || !MapPostCb) return;

    const isMobile = window.innerWidth <= 1024;

    newsCb.addEventListener("change", () => {
        if (newsCb.checked) {
            // Auto-open only on Desktop and if no legend is currently displayed
            const isLegendOn = document.getElementById("MapLegend")?.style.display === "block";
            if (!isMobile && !isLegendOn) {
                setNewsDrawer(true);
            }
            setMapPostDrawer(false);
        } else {
            setNewsDrawer(false);
        }
    });

    MapPostCb.addEventListener("change", () => {
        if (MapPostCb.checked) {
            // Auto-open only on Desktop and if no legend is currently displayed
            const isLegendOn = document.getElementById("MapLegend")?.style.display === "block";
            if (!isMobile && !isLegendOn) {
                setMapPostDrawer(true);
            }
            setNewsDrawer(false);
        } else {
            setMapPostDrawer(false);
        }
    });

    // Initial sync on load - also block auto-open on mobile
    setTimeout(() => {
        if (isMobile) return;

        if (newsCb.checked && !MapPostCb.checked) setNewsDrawer(true);
        if (!newsCb.checked && MapPostCb.checked) setMapPostDrawer(true);
    }, 500);
}

/**
 * Main Initialization
 */
export function initAll() {
    initAccordion();
    initStatsDrawer();
    initDescDrawer();
    initNewsDrawer();
    initMapPostDrawer();
    initCheckboxDrawerSync();
}

// Run on load
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll);
} else {
    initAll();
}

// Register callbacks for utils.js
setOnSetNewsDrawer(setNewsDrawer);
setOnSetStatsDrawer(setStatsDrawer);
setOnSetDescDrawer(setDescDrawer);
setOnSetMapPostDrawer(setMapPostDrawer);
setOnSetAccordionCollapsed(setAccordionCollapsed);

