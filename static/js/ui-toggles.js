
import { savePatch, read, initStateShadingToggle, initPointLayersToggle, initNaShadingToggle, saveGlobalMapStyle, readGlobalMapStyle } from "./ui-state.js";
import { onDescDrawerOpen, appendDrawerHelpIcon, appendAllLayerHelpIcons, appendGenericHelpIcon } from "./ui-param-desc.js";
import { MAP_STYLES, map } from "./map-init.js";
import {
    clearHighlight,
    setOnSetNewsDrawer,
    setOnSetStatsDrawer,
    setOnSetDescDrawer,
    setOnSetMapPostDrawer,
    setOnSetHysplitDrawer,
    setOnSetAccordionCollapsed,
    ESML
} from "./utils.js";
import { triggerRefresh } from "./stats-common.js";

// --- Component: Modern Toggle Switch ---
const SWITCH_STYLE = `
.toggle-switch-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 1rem;
  padding-top: 0.5rem;
  padding-left: 0;
  font-size: 1.5rem;
  color: var(--text-main);
}
.toggle-switch-left-group {
  display: flex;
  align-items: center;
  gap: 1rem;
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
  border-radius: calc(var(--border-radius-0p8rem) * 2);
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
      <div class="toggle-switch-left-group">
        <label class="toggle-switch-label">
          <input type="checkbox" id="${id}" ${isChecked}>
          <span class="toggle-switch-slider"></span>
        </label>
        <span>${ESML(label)}</span>
      </div>
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
const drawerSetters = {};

export function closeAllExcept(activeId, onlyIds = null) {
    const drawers = [
        { id: "stats", drawer: "FigurePageDrawer", btn: "FigurePageToggle", cls: "FigurePage-drawer-open" },
        { id: "desc", drawer: "DescDrawer", btn: "DescToggle", cls: null },
        { id: "news", drawer: "WFnewsDrawer", btn: "WFnewsToggle", cls: "WFnews-drawer-open" },
        { id: "MapPost", drawer: "MapPostDrawer", btn: "MapPostToggle", cls: "MapPost-drawer-open" },
        { id: "hysplit", drawer: "HysplitDrawer", btn: "HysplitToggle", cls: "Hysplit-drawer-open" },
        { id: "legend", drawer: "LegendDrawer", btn: "LegendToggle", cls: "Legend-drawer-open" },
        { id: "aerscreen", drawer: "AerscreenDrawer", btn: "AerscreenToggle", cls: "Aerscreen-drawer-open" },
        { id: "areastats", drawer: "AreaStatsDrawer", btn: "MapBtnDraw", cls: "AreaStats-drawer-open" }
    ];

    drawers.forEach(({ id, drawer, btn, cls }) => {
        if (id !== activeId) {
            
            // If onlyIds is provided, only close if the id is in that list
            if (onlyIds && !onlyIds.includes(id)) return;
            
            const drawerEl = document.getElementById(drawer);
            if (drawerEl?.classList.contains("open")) {
                const setter = drawerSetters[id];
                if (setter) {
                    setter(false); // Clean closing through setter (fires onClose)
                } else {
                    // Fallback
                    drawerEl.classList.remove("open");
                    const btnEl = document.getElementById(btn);
                    if (btnEl) btnEl.classList.remove("active");
                    if (cls) document.body.classList.remove(cls);
                }
            }
        }
    });
}

/**
 * Helper: Add swipe-to-close functionality (Modularized)
 */
export function addSwipeClose(el, options = {}) {
    const { direction = "right", threshold = 60, onClose = () => { }, maxWidth = 1024, strictMaxWidth = false } = options;

    let touchStartX = 0;
    let touchStartY = 0;
    let isDragging = false;

    function checkSwipeEnabled() {
        if (strictMaxWidth) {
            return window.innerWidth <= maxWidth;
        }
        return window.innerWidth <= maxWidth ||
            /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ||
            (navigator.maxTouchPoints > 0 && /Macintosh/i.test(navigator.userAgent));
    }

    el.addEventListener("touchstart", (e) => {
        if (!checkSwipeEnabled()) return;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        isDragging = false;
    }, { passive: true });

    el.addEventListener("touchmove", (e) => {
        if (!checkSwipeEnabled()) return;

        const touchMoveX = e.touches[0].clientX;
        const touchMoveY = e.touches[0].clientY;
        const deltaX = touchMoveX - touchStartX;
        const deltaY = touchMoveY - touchStartY;

        let isClosingMove = false;
        if (direction === "right" && deltaX > 0) isClosingMove = true;
        if (direction === "left" && deltaX < 0) isClosingMove = true;
        if (direction === "down" && deltaY > 0) isClosingMove = true;

        if (isClosingMove) {
            const distance = direction === "down" ? deltaY : Math.abs(deltaX);
            if (!isDragging && distance > 5) {
                el.style.transition = "none";
                isDragging = true;
            }

            if (isDragging) {
                const transformValue = direction === "down" ? `translateY(${deltaY}px)` : `translateX(${deltaX}px)`;
                el.style.setProperty("transform", transformValue, "important");
            }
        }
    }, { passive: true });

    el.addEventListener("touchend", (e) => {
        if (!checkSwipeEnabled() || !isDragging) return;

        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;

        // Restore transition for smooth snap back or exit
        el.style.transition = "transform 0.3s cubic-bezier(0.165, 0.84, 0.44, 1)";

        let reachedThreshold = false;
        if (direction === "right" && deltaX > threshold) reachedThreshold = true;
        if (direction === "left" && deltaX < -threshold) reachedThreshold = true;
        if (direction === "down" && deltaY > threshold) reachedThreshold = true;

        if (reachedThreshold) {
            onClose();
            // Optional: after calling onClose, we might want to keep the transform 
            // but usually onClose hides the element via classes.
        }

        // Reset transform to original position if not closed, or to ensure clean state
        el.style.removeProperty("transform");

        // Cleanup after transition finishes
        setTimeout(() => {
            if (!el.classList.contains("open") && !el.classList.contains("active") && el.classList.contains("collapsed")) {
                el.style.transition = "";
            }
        }, 300);

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
            label: "Show State Shading",
            checked: true
        });
        initStateShadingToggle();
        appendDrawerHelpIcon("ToggleSwitchStateShading", "show-state-shading");
    }

    const PointLayersContainer = document.getElementById("ToggleSwitchPointLayers");
    if (PointLayersContainer) {
        appendSwitch(PointLayersContainer, {
            id: "MapBtnPointLayers",
            label: "Show Points",
            checked: true
        });
        initPointLayersToggle();
        appendDrawerHelpIcon("ToggleSwitchPointLayers", "show-points");
    }
    
    const DayNightContainer = document.getElementById("ToggleSwitchDayNight");
    if (DayNightContainer) {
        appendSwitch(DayNightContainer, {
            id: "MapBtnDayNight",
            label: "Show Day/Night Shadow",
            checked: true
        });

        const btn = document.getElementById("MapBtnDayNight");
        if (btn) {
            btn.addEventListener("change", () => {
                const isHourlyActive = document.getElementById("timePicker")?.style.display === "block";
                import("./layers.js").then(module => {
                    module.setDayNightVisibility(isHourlyActive);
                });
            });
        }

        appendDrawerHelpIcon("ToggleSwitchDayNight", "show-day-night");
    }
    
    const NaShadingContainer = document.getElementById("ToggleSwitchNaShading");
    if (NaShadingContainer) {
        appendSwitch(NaShadingContainer, {
            id: "MapBtnNaShading",
            label: "Show N/A values",
            checked: true
        });
        initNaShadingToggle();
        appendDrawerHelpIcon("ToggleSwitchNaShading", "show-na-values");
    }
    
    const mapTypeHeader = document.getElementById("MapTypeHeader");
    if (mapTypeHeader) {
        appendGenericHelpIcon("MapTypeHeader", "map-type");
    }
    
    // --- Base Map Selection ---
    const grid = document.getElementById("BaseMapGrid");
    if (grid) {
        const currentStyleId = sessionStorage.getItem("mapStyle") || "osm";

        Object.values(MAP_STYLES).forEach(itemCfg => {
            const item = document.createElement("div");
            item.className = `base-map-item ${itemCfg.id === currentStyleId ? "active" : ""}`;
            item.dataset.id = itemCfg.id;
            let imgName = "standard_webp";
            if (itemCfg.id === "osm") imgName = "standard_webp";
            else if (itemCfg.id === "topo") imgName = "topo_webp";
            else if (itemCfg.id === "light") imgName = "light_webp";
            else if (itemCfg.id === "vector") imgName = "vector_webp";

            item.innerHTML = `
                <img src="/images/map_thumbs/${imgName}.webp" alt="${itemCfg.name}">
                <div class="base-map-label">${itemCfg.name}</div>
            `;

            item.addEventListener("click", () => {
                if (item.classList.contains("active")) return;

                // 1. Update UI
                grid.querySelectorAll(".base-map-item").forEach(el => el.classList.remove("active"));
                item.classList.add("active");

                // 2. Persist
                saveGlobalMapStyle(itemCfg.id);
                sessionStorage.setItem("mapStyle", itemCfg.id);
                
                if (map) {
                    const proj = map.getProjection();
                    if (proj && proj.type) {
                        sessionStorage.setItem("mapProjection", proj.type);
                    }
                }

                // 3. Full Redraw via Reload
                sessionStorage.setItem("mapStyleChanged", "true");
                window.location.reload();
            });
            grid.appendChild(item);
        });
    }
    
    // --- Boundary Color Selection ---
    const activeColor = sessionStorage.getItem("boundaryColor") || "#ffffff";
    const colorBtns = document.querySelectorAll(".boundary-color-btn");
    const picker = document.getElementById("boundary-color-picker");

    // Helper to deactivate all buttons
    const deactivateAllColorButtons = () => {
        colorBtns.forEach(b => {
            b.classList.remove("active");
            b.style.borderColor = "transparent";
            b.style.boxShadow = "0 0.2rem 0.6rem rgba(0,0,0,0.15)";
        });
        if (picker) {
            const customLabel = picker.parentElement;
            if (customLabel) {
                customLabel.classList.remove("active");
                customLabel.style.borderColor = "transparent";
                customLabel.style.boxShadow = "0 0.2rem 0.6rem rgba(0,0,0,0.15)";
            }
        }
    };

    // Helper to activate a specific element
    const activateColorButton = (el) => {
        el.classList.add("active");
        el.style.borderColor = "var(--card-shadow)";
        el.style.boxShadow = "0 0 1rem var(--card-shadow)";
    };

    // Initialize preset buttons
    colorBtns.forEach(btn => {
        const btnColor = btn.dataset.color;
        if (btnColor === activeColor.toLowerCase()) {
            activateColorButton(btn);
        }
        
        btn.addEventListener("click", () => {
            deactivateAllColorButtons();
            activateColorButton(btn);
            
            sessionStorage.setItem("boundaryColor", btnColor);
            
            if (map && map.getLayer("states-line")) {
                try {
                    map.setPaintProperty("states-line", "line-color", btnColor);
                } catch (e) {
                    console.error("Failed to update boundary color", e);
                }
            }
        });
    });

    // Initialize Custom Color Picker
    if (picker) {
        const presets = ["#ffffff", "#888888", "#000000"];
        const isPreset = presets.includes(activeColor.toLowerCase());
        
        if (!isPreset) {
            picker.value = activeColor;
            const customLabel = picker.parentElement;
            if (customLabel) {
                activateColorButton(customLabel);
            }
        }

        const handleCustomColorInput = (e) => {
            const chosenColor = e.target.value;
            deactivateAllColorButtons();
            
            const customLabel = picker.parentElement;
            if (customLabel) {
                activateColorButton(customLabel);
            }

            sessionStorage.setItem("boundaryColor", chosenColor);
            
            if (map && map.getLayer("states-line")) {
                try {
                    map.setPaintProperty("states-line", "line-color", chosenColor);
                } catch (err) {
                    console.error("Failed to update boundary color", err);
                }
            }
        };

        picker.addEventListener("input", handleCustomColorInput);
        picker.addEventListener("change", handleCustomColorInput);
    }
    
    // --- Boundary Width Selection ---
    const widthSelect = document.getElementById("boundary-width-select");
    if (widthSelect) {
        const savedWidth = sessionStorage.getItem("boundaryWidth") || "1.0";
        const normalizedWidth = parseFloat(savedWidth).toFixed(1);
        widthSelect.value = normalizedWidth;

        widthSelect.addEventListener("change", (e) => {
            const val = parseFloat(e.target.value);
            sessionStorage.setItem("boundaryWidth", String(val));
            
            if (map && map.getLayer("states-line")) {
                try {
                    map.setPaintProperty("states-line", "line-width", val);
                } catch (err) {
                    console.error("Failed to update boundary width", err);
                }
            }
        });
    }
    
    const s = read?.();
    const isCollapsed = s?.accordionCollapsed ?? true;
    setAccordionCollapsed(isCollapsed);
}

export function setBoundarySettings(color = "#ffffff", width = 1.0) {
    if (color === "#ffffff" && width === 1.0) {
        sessionStorage.removeItem("boundaryColor");
        sessionStorage.removeItem("boundaryWidth");
    } else {
        sessionStorage.setItem("boundaryColor", color);
        sessionStorage.setItem("boundaryWidth", String(width));
    }
    
    const colorBtns = document.querySelectorAll(".boundary-color-btn");
    colorBtns.forEach(b => {
        const btnColor = b.dataset.color;
        if (btnColor === color.toLowerCase()) {
            b.classList.add("active");
            b.style.borderColor = "var(--card-shadow)";
            b.style.boxShadow = "0 0 1rem var(--card-shadow)";
        } else {
            b.classList.remove("active");
            b.style.borderColor = "transparent";
            b.style.boxShadow = "0 0.2rem 0.6rem rgba(0,0,0,0.15)";
        }
    });

    const picker = document.getElementById("boundary-color-picker");
    if (picker) {
        const presets = ["#ffffff", "#888888", "#000000"];
        const isPreset = presets.includes(color.toLowerCase());
        const customLabel = picker.parentElement;
        if (customLabel) {
            if (!isPreset) {
                picker.value = color;
                customLabel.classList.add("active");
                customLabel.style.borderColor = "var(--card-shadow)";
                customLabel.style.boxShadow = "0 0 1rem var(--card-shadow)";
            } else {
                picker.value = "#ffffff";
                customLabel.classList.remove("active");
                customLabel.style.borderColor = "transparent";
                customLabel.style.boxShadow = "0 0.2rem 0.6rem rgba(0,0,0,0.15)";
            }
        }
    }

    const widthSelect = document.getElementById("boundary-width-select");
    if (widthSelect) {
        widthSelect.value = parseFloat(width).toFixed(1);
    }

    if (map && map.getLayer("states-line")) {
        try {
            map.setPaintProperty("states-line", "line-color", color);
            map.setPaintProperty("states-line", "line-width", parseFloat(width));
        } catch (e) {
            console.error("Failed to update boundary settings on map", e);
        }
    }
}

/**
 * Drawer Toggle Factory
 * Creates a reusable set*Drawer function from a config object.
 */
function createDrawerToggle(config) {
    const { id, btnId, drawerId, bodyClass, onOpen, onClose } = config;

    const setter = function setDrawer(open) {
        const btn = document.getElementById(btnId);
        const drawer = document.getElementById(drawerId);
        if (!drawer) return;

        const actualOpen = (open !== undefined) ? open : !drawer.classList.contains("open");
        drawer.classList.toggle("open", actualOpen);
        if (btn) btn.classList.toggle("active", actualOpen);
        if (bodyClass) document.body.classList.toggle(bodyClass, actualOpen);

        if (actualOpen) {
            if (window.innerWidth <= 1024) {
                // Mobile: Close everything
                closeAllExcept(id);
                clearHighlight?.();
            } else if (["legend", "news", "MapPost", "hysplit", "aerscreen", "areastats"].includes(id)) {
                // PC: Only close siblings in the same group (Left side drawers)
                closeAllExcept(id, ["legend", "news", "MapPost", "hysplit", "aerscreen", "areastats"]);
            }
            onOpen?.();
        } else {
            onClose?.();
        }
    };

    drawerSetters[id] = setter;
    return setter;
}

/**
 * 2. Stats Drawer
 */
export const setStatsDrawer = createDrawerToggle({
    id: "stats",
    btnId: "FigurePageToggle",
    drawerId: "FigurePageDrawer",
    bodyClass: "FigurePage-drawer-open",
    onOpen: () => {
        if (typeof triggerRefresh === "function") {
            triggerRefresh();
        }
    }
});

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
export const setDescDrawer = createDrawerToggle({
    id: "desc",
    btnId: "DescToggle",
    drawerId: "DescDrawer",
    onOpen: () => onDescDrawerOpen?.()
});

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
export const setNewsDrawer = createDrawerToggle({
    id: "news",
    btnId: "WFnewsToggle",
    drawerId: "WFnewsDrawer",
    bodyClass: "WFnews-drawer-open",
    // [Smart News Fetch] Notify system to check for news data
    onOpen: () => window.dispatchEvent(new CustomEvent("news-drawer-opened"))
});

export function initNewsDrawer() {
    const btn = document.getElementById("WFnewsToggle");
    const drawer = document.getElementById("WFnewsDrawer");
    const closeBtn = document.getElementById("WFnewsDrawerClose");
    if (!btn || !drawer) return;

    btn.addEventListener("click", () => setNewsDrawer());
    addCloseHandler(closeBtn, () => setNewsDrawer(false));
    addSwipeClose(drawer, { direction: "left", onClose: () => setNewsDrawer(false) });

    const container = document.getElementById("ToggleSwitchWildfire");
    if (container) {
        appendSwitch(container, {
            id: "layer-wildfire-news",
            label: "Show Locations on Map",
            checked: false
        });
    }

    // Add help icon for standalone modal
    appendDrawerHelpIcon("WFnewsDrawer", "wildfire-news");
}

/**
 * 5. MapPost Drawer
 */
export const setMapPostDrawer = createDrawerToggle({
    id: "MapPost",
    btnId: "MapPostToggle",
    drawerId: "MapPostDrawer",
    bodyClass: "MapPost-drawer-open",
    // [Smart MapPost Fetch] Notify system
    onOpen: () => window.dispatchEvent(new CustomEvent("mappost-drawer-opened")),
    onClose: () => window.dispatchEvent(new CustomEvent("mappost-drawer-closed"))
});

export function initMapPostDrawer() {
    const btn = document.getElementById("MapPostToggle");
    const drawer = document.getElementById("MapPostDrawer");
    const closeBtn = document.getElementById("MapPostDrawerClose");
    if (!drawer) return;

    if (btn) btn.addEventListener("click", () => setMapPostDrawer());
    addCloseHandler(closeBtn, () => setMapPostDrawer(false));
    addSwipeClose(drawer, { direction: "left", onClose: () => setMapPostDrawer(false) });

    const container = document.getElementById("ToggleSwitchMapPost");
    if (container) {
        appendSwitch(container, {
            id: "layer-MapPost",
            label: "Show MapPost on Map",
            checked: false
        });
    }

    // Add help icon for standalone modal
    appendDrawerHelpIcon("MapPostDrawer", "MapPost");
}

/**
 * 6. Legend Drawer
 */
export const setLegendDrawer = createDrawerToggle({
    id: "legend",
    btnId: "LegendToggle",
    drawerId: "LegendDrawer",
    bodyClass: "Legend-drawer-open",
    onOpen: () => window.dispatchEvent(new CustomEvent("legend-drawer-opened"))
});

export function initLegendDrawer() {
    const btn = document.getElementById("LegendToggle");
    const drawer = document.getElementById("LegendDrawer");
    const closeBtn = document.getElementById("LegendDrawerClose");
    if (!drawer) return;

    if (btn) btn.addEventListener("click", () => setLegendDrawer());
    addCloseHandler(closeBtn, () => setLegendDrawer(false));
    addSwipeClose(drawer, { direction: "left", onClose: () => setLegendDrawer(false) });
}

/**
 * 7. Hysplit Drawer
 */
export const setHysplitDrawer = createDrawerToggle({
    id: "hysplit",
    btnId: "HysplitToggle",
    drawerId: "HysplitDrawer",
    bodyClass: "Hysplit-drawer-open",
    onOpen: () => window.dispatchEvent(new CustomEvent("hysplit-drawer-opened"))
});

export function initHysplitDrawer() {
    const btn = document.getElementById("HysplitToggle");
    const drawer = document.getElementById("HysplitDrawer");
    const closeBtn = document.getElementById("HysplitDrawerClose");
    if (!drawer) return;

    if (btn) btn.addEventListener("click", () => setHysplitDrawer());
    addCloseHandler(closeBtn, () => setHysplitDrawer(false));
    addSwipeClose(drawer, { direction: "left", onClose: () => setHysplitDrawer(false) });
    
    const container = document.getElementById("ToggleSwitchHysplitFlow");
    if (container) {
        appendSwitch(container, {
            id: "MapBtnHysplitFlow",
            label: "Show All Sim. on Map",
            checked: false, 
            onChange: (val) => {
                window.dispatchEvent(new CustomEvent("hysplit-all-toggle", { detail: val }));
            }
        });
    }

    // Add help icon for standalone modal
    appendDrawerHelpIcon("HysplitDrawer", "HysplitSim");
}

/**
 * 8. Aerscreen Drawer
 */
export const setAerscreenDrawer = createDrawerToggle({
    id: "aerscreen",
    btnId: "AerscreenToggle",
    drawerId: "AerscreenDrawer",
    bodyClass: "Aerscreen-drawer-open",
    onOpen: () => window.dispatchEvent(new CustomEvent("aerscreen-drawer-opened"))
});

export function initAerscreenDrawer() {
    const btn = document.getElementById("AerscreenToggle");
    const drawer = document.getElementById("AerscreenDrawer");
    const closeBtn = document.getElementById("AerscreenDrawerClose");
    if (!drawer) return;

    if (btn) btn.addEventListener("click", () => setAerscreenDrawer());
    addCloseHandler(closeBtn, () => setAerscreenDrawer(false));
    addSwipeClose(drawer, { direction: "left", onClose: () => setAerscreenDrawer(false) });
}

/**
 * 9. Area Stats Drawer
 */
export const setAreaStatsDrawer = createDrawerToggle({
    id: "areastats",
    btnId: "MapBtnDraw",
    drawerId: "AreaStatsDrawer",
    bodyClass: "AreaStats-drawer-open",
    onOpen: () => window.dispatchEvent(new CustomEvent("areastats-drawer-opened")),
    onClose: () => window.dispatchEvent(new CustomEvent("areastats-drawer-closed"))
});

export function initAreaStatsDrawer() {
    const btn = document.getElementById("MapBtnDraw");
    const drawer = document.getElementById("AreaStatsDrawer");
    const closeBtn = document.getElementById("AreaStatsDrawerClose");
    if (!drawer) return;

    if (btn) btn.addEventListener("click", () => setAreaStatsDrawer());
    addCloseHandler(closeBtn, () => setAreaStatsDrawer(false));
    addSwipeClose(drawer, { direction: "left", onClose: () => setAreaStatsDrawer(false) });
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
    initLegendDrawer();
    initHysplitDrawer();
    initAerscreenDrawer();
    initAreaStatsDrawer();
    appendAllLayerHelpIcons();
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
setOnSetHysplitDrawer(setHysplitDrawer);
setOnSetAccordionCollapsed(setAccordionCollapsed);

// Make global for external module interaction (like ui-param-desc.js)
window.setDescDrawer = setDescDrawer;

// --- Sequential Keyboard Shortcuts (Key Tips) System ---
const KEY_TIPS_MAP = {
    "d": { id: "datePicker", label: "D" },    // Date (Date Picker)
    "q": { id: "AccordionToggle", label: "Q", fallbackId: "AccordionClose" }, // Layers (Query)
    "s": { id: "FigurePageToggle", label: "S" }, // Stats (Graph)
    "i": { id: "DescToggle", label: "I" },       // Information (Descriptions)
    "n": { id: "WFnewsToggle", label: "N" },     // News
    "p": { id: "MapPostToggle", label: "P" },    // Post (MapPost)
    "a": { id: "AiChatToggle", label: "A", fallbackId: "AiChatDrawerClose" },  // AiChat
    "c": { id: "MapBtnCapture", label: "C" },    // Capture
    "r": { id: "MapBtnReset", label: "R" },      // Reset All
    "t": { id: "MapBtnTutorial", label: "T" },   // Tutorial
    "l": { id: "LegendToggle", label: "L" },     // Legend
    "h": { id: "HysplitToggle", label: "H" },     // Hysplit
    "v": { id: "MapBtnAnimate", label: "V" },     // Timelapse/Video
    "w": { id: "MapBtnDraw", label: "W" }         // Draw Area Stats
};

let isKeyTipMode = false;

const injectKeyTipCSS = () => {
    if (document.getElementById("key-tip-style")) return;
    const style = document.createElement("style");
    style.id = "key-tip-style";
    style.textContent = `
        /* Overlay on buttons */
        .key-tip-badge {
            position: fixed;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(0.2rem);
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2.2rem;
            font-weight: bold;
            font-family: "Outfit", sans-serif;
            z-index: var(--z-highest);
            pointer-events: none;
            text-transform: uppercase;
            animation: keyTipOverlayIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            line-height: 1;
            border: 0.2rem solid rgba(255, 255, 255, 0.3);
            box-shadow: 0 0 1.5rem rgba(0,0,0,0.4);
        }

        /* Central Summary Modal */
        .key-tip-summary {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: var(--color-bg);
            backdrop-filter: blur(1.2rem);
            -webkit-backdrop-filter: blur(1.2rem);
            border: 0.1rem solid var(--card-shadow);
            border-radius: calc(var(--border-radius-0p8rem) * 2);
            padding: 3rem;
            z-index: calc(var(--z-highest) + 1);
            box-shadow: 0 2.5rem 5rem -1.2rem var(--card-shadow);
            color: var(--text-main);
            width: 45rem;
            max-width: 90vw;
            pointer-events: auto;
            animation: keyTipSummaryIn 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            font-family: "Outfit", sans-serif;
        }

        .key-tip-summary-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 2rem;
            border-bottom: 0.1rem solid var(--card-shadow);
            padding-bottom: 1rem;
        }

        .key-tip-summary-title {
            font-size: 1.8rem;
            font-weight: bold;
            letter-spacing: 0.1rem;
            color: var(--text-main);
            text-transform: uppercase;
        }

        .key-tip-summary-close {
            /* Standard styles for close button will be applied via class */
        }

        .key-tip-summary-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 1.2rem;
        }

        .key-tip-item {
            display: flex;
            align-items: center;
            gap: 1.2rem;
            padding: 0.8rem 1.2rem;
            background: var(--sidebar-widget-bg);
            border-radius: var(--border-radius-0p8rem);
            border: 0.1rem solid var(--text-soft);
        }

        .key-tip-key {
            background: var(--color-bg);
            color: var(--text-main);
            width: auto;
            min-width: 3.5rem;
            height: 3.2rem;
            padding: 0 1.2rem;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: var(--border-radius-0p8rem);
            font-weight: bold;
            font-size: 1.4rem;
            flex-shrink: 0;
            border: 0.1rem solid var(--text-soft);
        }

        .key-tip-desc {
            font-size: 1.4rem;
            font-weight: bold;
            color: var(--text-main);
            white-space: nowrap;
        }

        @keyframes keyTipOverlayIn {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
        }

        @keyframes keyTipSummaryIn {
            from { opacity: 0; transform: translate(-50%, -45%) scale(0.98); }
            to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
    `;
    document.head.appendChild(style);
};

const clearKeyTips = () => {
    document.querySelectorAll(".key-tip-badge, .key-tip-summary").forEach(el => el.remove());
    isKeyTipMode = false;
};

const showKeyTips = () => {
    clearKeyTips();
    injectKeyTipCSS();
    isKeyTipMode = true;

    // 1. Create Central Summary
    const summary = document.createElement("div");
    summary.className = "key-tip-summary";

    let gridHTML = `
        <div class="key-tip-summary-header">
            <div class="key-tip-summary-title">Keyboard Shortcuts</div>
            <button class="ui-btn-close" id="ShortcutModalClose">
                <svg width="20" height="20">
                    <use xlink:href="#icon-close" />
                </svg>
            </button>
        </div>
        <div class="key-tip-summary-grid">
    `;

    const displayNames = {
        "d": "Date Picker",
        "q": "Layers",
        "s": "Stats/Charts",
        "i": "Layer Descriptions",
        "n": "Wildfire News",
        "p": "MapPost",
        "a": "AI Chat",
        "c": "Map Capture",
        "r": "Reset All",
        "t": "Quick Start",
        "l": "Map Legend",
        "h": "HYSPLIT",
        "v": "Timelapse (Video)",
        "w": "Draw Area Stats"
    };

    Object.entries(KEY_TIPS_MAP).forEach(([key, cfg]) => {
        const desc = displayNames[key] || cfg.id;
        gridHTML += `
            <div class="key-tip-item">
                <div class="key-tip-key">Alt + ${cfg.label}</div>
                <div class="key-tip-desc">${desc}</div>
            </div>
        `;

        // 2. Create Overlays on actual elements
        let el = document.getElementById(cfg.id);
        if (!el || el.getClientRects().length === 0) {
            if (cfg.fallbackId) el = document.getElementById(cfg.fallbackId);
        }
        if (el && el.getClientRects().length > 0) {
            const rect = el.getBoundingClientRect();
            const badge = document.createElement("div");
            badge.className = "key-tip-badge";
            badge.textContent = cfg.label;
            const styles = window.getComputedStyle(el);
            badge.style.borderRadius = styles.borderRadius;
            badge.style.width = `${rect.width}px`;
            badge.style.height = `${rect.height}px`;
            badge.style.left = `${rect.left}px`;
            badge.style.top = `${rect.top}px`;
            document.body.appendChild(badge);
        }
    });

    gridHTML += `</div>`;
    summary.innerHTML = gridHTML;
    
    // Enable interaction for the summary (previously pointer-events: none)
    summary.style.pointerEvents = "auto";

    document.body.appendChild(summary);

    // Bind Close Event
    document.getElementById("ShortcutModalClose")?.addEventListener("click", (e) => {
        e.stopPropagation();
        clearKeyTips();
    });
};

const handleCommonShortcut = (key) => {
    switch (key) {
        case "s": setStatsDrawer(); break;
        case "n": setNewsDrawer(); break;
        case "p": setMapPostDrawer(); break;
        case "i": setDescDrawer(); break;
        case "q":
            const accordion = document.getElementById("AccordionPage");
            setAccordionCollapsed(!accordion?.classList.contains("collapsed"));
            break;
        case "a":
            document.getElementById("AiChatToggle")?.click();
            break;
        case "c":
            document.getElementById("MapBtnCapture")?.click();
            break;
        case "r":
            document.getElementById("MapBtnReset")?.click();
            break;
        case "t":
            document.getElementById("MapBtnTutorial")?.click();
            break;
        case "d":
            const dp = document.getElementById("datePicker");
            if (dp) {
                if (typeof dp.showPicker === "function") {
                    dp.showPicker();
                } else {
                    dp.focus();
                    dp.click();
                }
            }
            break;
        case "l":
            setLegendDrawer();
            break;
        case "h":
            setHysplitDrawer();
            break;
        case "v":
            document.getElementById("MapBtnAnimate")?.click();
            break;
        case "w":
            setAreaStatsDrawer();
            break;
    }
    clearKeyTips();
};

window.addEventListener("keydown", (e) => {
    const activeTag = document.activeElement?.tagName;
    const isTyping = activeTag === "INPUT" || activeTag === "TEXTAREA" || document.activeElement?.isContentEditable;

    if (isTyping) {
        clearKeyTips();
        return;
    }

    if (e.key === "Escape" && isKeyTipMode) {
        clearKeyTips();
        return;
    }

    if (isKeyTipMode) {
        const key = e.key.toLowerCase();
        if (KEY_TIPS_MAP[key]) {
            e.preventDefault();
            e.stopPropagation();
            handleCommonShortcut(key);
            return;
        }
        if (e.key !== "Alt") clearKeyTips();
    }

    // Original Alt+Key behavior (Checking altKey flag handles both, 
    // but sequential mode is now Left-Alt centric)
    if (e.altKey && !e.ctrlKey && !e.shiftKey) {
        const key = e.key.toLowerCase();
        if (KEY_TIPS_MAP[key]) {
            e.preventDefault();
            handleCommonShortcut(key);
        }
    }
});

window.addEventListener("mousedown", () => {
    if (isKeyTipMode) setTimeout(clearKeyTips, 100);
});

// --- Manual Shortcut Help Button ---
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("MapBtnShortcuts")?.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent mousedown from clearing it immediately
        if (isKeyTipMode) clearKeyTips();
        else showKeyTips();
    });
});

