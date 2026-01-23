
import { savePatch, read, initStateColorToggle } from "./ui-state.js";
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

function injectSwitchCSS() {
    if (document.getElementById("toggle-switch-component-style")) return;
    const style = document.createElement("style");
    style.id = "toggle-switch-component-style";
    style.textContent = SWITCH_STYLE;
    document.head.appendChild(style);
}

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
        input.addEventListener("change", (e) => options.onChange(e.target.checked));
    }
    return switchEl;
}

/**
 * Helper: Close other drawers (especially on mobile)
 * Ensures that only one drawer is open at a time on small screens.
 */
 
const LAYERS_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>`;
const CLOSE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

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
        btn.style.display = "flex"; // 패널 닫히면 열기 버튼 보임
    } else {
        page.classList.remove("collapsed");
        btn.style.display = "none"; // 패널 열리면 열기 버튼 숨김 (패널 내 X 버튼 사용)
    }
    if (savePatch) savePatch({ accordionCollapsed: collapsed });
}

export function initAccordion() {
    const page = document.getElementById("AccordionPage");
    const openBtn = document.getElementById("AccordionToggle");
    const closeBtn = document.getElementById("AccordionClose");
    if (!page || !openBtn) return;

    // 열기 버튼 클릭 시
    openBtn.addEventListener("click", () => setAccordionCollapsed(false));

    // 패널 내 닫기 버튼 클릭 시
    if (closeBtn) {
        closeBtn.addEventListener("click", () => setAccordionCollapsed(true));
    }

    // Swipe-to-close
    addSwipeClose(page, {
        direction: "right",
        onClose: () => setAccordionCollapsed(true)
    });
    
    // Inject State Choropleth toggle
    const StateChoroplethContainer = document.getElementById("ToggleSwitchStateChoropleth");
    if (StateChoroplethContainer) {
        appendSwitch(StateChoroplethContainer, {
            id: "MapBtnStateChoropleth",
            label: "State Choropleth",
            checked: true // Default
        });
        initStateColorToggle();
    }
    
    if (read) {
        const s = read();
        const isCollapsed = s.accordionCollapsed !== undefined ? s.accordionCollapsed : true;
        setAccordionCollapsed(isCollapsed);
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

