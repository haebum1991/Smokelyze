
import { savePatch, read, initStateShadingToggle } from "./ui-state.js";
import { onDescDrawerOpen } from "./ui-param-desc.js";
import {
    clearHighlight,
    setOnSetNewsDrawer,
    setOnSetStatsDrawer,
    setOnSetDescDrawer,
    setOnSetMapPostDrawer,
    setOnSetAccordionCollapsed,
    ESML
} from "./utils.js";

// --- Component: Modern Toggle Switch ---
const SWITCH_STYLE = `
.toggle-switch-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  padding-left: 0;
  border-bottom: 0.1rem solid var(--card-shadow);
  font-size: 1.4rem;
  color: var(--text-main);
}
.toggle-switch-label {
  position: relative;
  display: inline-block;
  width: 4rem;
  height: 2rem;
  flex-shrink: 0;
}
.toggle-switch-label input { 
  opacity: 0; 
  width: 0; 
  height: 0; 
}
.toggle-switch-slider {
  position: absolute;
  cursor: pointer;
  top: 0; 
  right: 0;
  left: 0;
  bottom: 0;
  background-color: grey; 
  transition: .3s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 1rem;
  overflow: hidden;
}
.toggle-switch-slider:before {
  position: absolute;
  content: "";
  height: 1.5rem; 
  width: 1.5rem;
  left: 0.1rem;
  top: 50%;
  transform: translateY(-50%);
  background-color: var(--color-white);
  border: 0.2rem solid var(--color-black);
  transition: .3s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 50%;
  box-shadow: 0 0.2rem 0.4rem rgba(0,0,0,0.2);
}
input:checked + .toggle-switch-slider { 
  background-color: var(--card-shadow);
}
input:checked + .toggle-switch-slider:before { 
  transform: translateY(-50%) translateX(2rem);
}
`;

const injectSwitchCSS = () => {
    if (document.getElementById("toggle-switch-component-style")) return;
    const style = document.createElement("style");
    style.id = "toggle-switch-component-style";
    style.textContent = SWITCH_STYLE;
    document.head.appendChild(style);
};

/**
 * Creates the HTML string for a modern toggle switch.
 */
export function createSwitchHTML(id, label, checked = false) {
    injectSwitchCSS();
    const isChecked = checked ? "checked" : "";
    return `
    <div class="toggle-switch-item">
      <label class="toggle-switch-label">
        <input type="checkbox" id="${id}" ${isChecked}>
        <span class="toggle-switch-slider"></span>
      </label>
      <span>${ESML(label)}</span>
    </div>
  `.trim();
}

/**
 * Creates and appends a switch element to a parent.
 */
export function appendSwitch(parent, options) {
    injectSwitchCSS();
    if (!parent) return;
    const temp = document.createElement("div");
    temp.innerHTML = createSwitchHTML(options.id, options.label, options.checked);
    const switchEl = temp.firstElementChild;
    parent.appendChild(switchEl);

    if (options.onChange) {
        const input = switchEl.querySelector("input");
        input?.addEventListener("change", (e) => options.onChange(e.target.checked));
    }
    return switchEl;
}

/**
 * Helper: Close other drawers (especially on mobile)
 */
const LAYERS_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>`;
const CLOSE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

export function closeAllExcept(activeId) {
    const drawers = [
        { id: "stats", drawer: "FigurePageDrawer", btn: "FigurePageToggle", cls: "FigurePage-drawer-open" },
        { id: "desc", drawer: "DescDrawer", btn: "DescToggle", cls: null },
        { id: "news", drawer: "WFnewsDrawer", btn: "WFnewsToggle", cls: "WFnews-drawer-open" },
        { id: "MapPost", drawer: "MapPostDrawer", btn: "MapPostToggle", cls: "MapPost-drawer-open" }
    ];

    drawers.forEach(({ id, drawer, btn, cls }) => {
        if (id !== activeId) {
            const drawerEl = document.getElementById(drawer);
            const btnEl = document.getElementById(btn);
            if (drawerEl?.classList.contains("open")) {
                drawerEl.classList.remove("open");
                btnEl?.classList.remove("active");
                if (cls) document.body.classList.remove(cls);
                if (["news", "MapPost"].includes(id) && btnEl) btnEl.style.display = "block";
            }
        }
    });
}

/**
 * Helper: Add swipe-to-close functionality (Modularized)
 */
export function addSwipeClose(el, options = {}) {
    const { direction = "right", threshold = 60, onClose = () => { }, maxWidth = 1024 } = options;

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

        if (reachedThreshold) onClose();

        el.style.transform = "";
        touchStartX = 0;
        touchMoveX = 0;
        isDragging = false;
    });
}

/**
 * Helper: Close button click handler (Modularized)
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
 * 1. Accordion Toggle
 */
export function setAccordionCollapsed(collapsed) {
    const page = document.getElementById("AccordionPage");
    const btn = document.getElementById("AccordionToggle");
    if (!page || !btn) return;

    if (collapsed) {
        page.classList.add("collapsed");
        btn.style.display = "flex";
    } else {
        page.classList.remove("collapsed");
        btn.style.display = "none";
    }
    savePatch?.({ accordionCollapsed: collapsed });
}

export function initAccordion() {
    const page = document.getElementById("AccordionPage");
    const openBtn = document.getElementById("AccordionToggle");
    const closeBtn = document.getElementById("AccordionClose");
    if (!page || !openBtn) return;

    openBtn.addEventListener("click", () => setAccordionCollapsed(false));
    if (closeBtn) closeBtn.addEventListener("click", () => setAccordionCollapsed(true));

    addSwipeClose(page, { direction: "right", onClose: () => setAccordionCollapsed(true) });

    const StateShadingContainer = document.getElementById("ToggleSwitchStateShading");
    if (StateShadingContainer) {
        appendSwitch(StateShadingContainer, {
            id: "MapBtnStateShading",
            label: "State Shading",
            checked: true
        });
        initStateShadingToggle();
    }

    const s = read?.();
    const isCollapsed = s?.accordionCollapsed ?? true;
    setAccordionCollapsed(isCollapsed);
}

/**
 * 2. Stats Drawer
 */
export function setStatsDrawer(open) {
    const btn = document.getElementById("FigurePageToggle");
    const drawer = document.getElementById("FigurePageDrawer");
    if (!btn || !drawer) return;

    const actualOpen = (open !== undefined) ? open : !drawer.classList.contains("open");
    drawer.classList.toggle("open", actualOpen);
    btn.classList.toggle("active", actualOpen);
    document.body.classList.toggle("FigurePage-drawer-open", actualOpen);

    if (actualOpen && window.innerWidth <= 1024) {
        closeAllExcept("stats");
        clearHighlight?.();
    }
}

export function initStatsDrawer() {
    const btn = document.getElementById("FigurePageToggle");
    const drawer = document.getElementById("FigurePageDrawer");
    const closeBtn = document.getElementById("FigurePageDrawerClose");
    if (!btn || !drawer) return;

    btn.addEventListener("click", () => setStatsDrawer());
    addCloseHandler(closeBtn, () => setStatsDrawer(false));
    addSwipeClose(drawer, { direction: "left", onClose: () => setStatsDrawer(false) });
}

/**
 * 3. Desc Drawer
 */
export function setDescDrawer(open) {
    const btn = document.getElementById("DescToggle");
    const drawer = document.getElementById("DescDrawer");
    if (!btn || !drawer) return;

    const actualOpen = (open !== undefined) ? open : !drawer.classList.contains("open");
    if (actualOpen) {
        drawer.classList.add("open");
        btn.classList.add("active");
        if (window.innerWidth <= 1024) {
            closeAllExcept("desc");
            clearHighlight?.();
        }
        onDescDrawerOpen?.();
    } else {
        drawer.classList.remove("open");
        btn.classList.remove("active");
    }
}

export function initDescDrawer() {
    const btn = document.getElementById("DescToggle");
    const drawer = document.getElementById("DescDrawer");
    const closeBtn = document.getElementById("DescDrawerClose");
    if (!btn || !drawer) return;

    btn.addEventListener("click", () => setDescDrawer());
    addCloseHandler(closeBtn, () => setDescDrawer(false));
    addSwipeClose(drawer, { direction: "right", onClose: () => setDescDrawer(false) });
}

/**
 * 4. Wildfire News Drawer
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
            clearHighlight?.();
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
    addSwipeClose(drawer, { direction: "left", onClose: () => setNewsDrawer(false) });
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
            clearHighlight?.();
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
    addSwipeClose(drawer, { direction: "left", onClose: () => setMapPostDrawer(false) });
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
            const isLegendOn = document.getElementById("MapLegend")?.style.display === "block";
            if (!isMobile && !isLegendOn) setNewsDrawer(true);
            setMapPostDrawer(false);
        } else {
            setNewsDrawer(false);
        }
    });

    MapPostCb.addEventListener("change", () => {
        if (MapPostCb.checked) {
            const isLegendOn = document.getElementById("MapLegend")?.style.display === "block";
            if (!isMobile && !isLegendOn) setMapPostDrawer(true);
            setNewsDrawer(false);
        } else {
            setMapPostDrawer(false);
        }
    });

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

