
/**
 * ui-tutorial.js — Smokelyze Map Quick Start Tour
 * Powered by Driver.js for reliable element highlighting & popovers.
 */

/* ================================================================
   STEP DEFINITIONS
   ================================================================ */
const TUTORIAL_STEPS = [
    {
        element: "#map",
        popover: {
            title: '<span class="map-tut-pop-icon-box"><svg class="map-tut-pop-icon"><use xlink:href="#icon-map"/></svg></span> Interactive Map',
            description: "This is your main workspace — an interactive map showing wildfire smoke and air-quality data across North America. Explore layers, navigate time, and check stats using the controls below.",
            side: "over",
            align: "center",
        },
        padding: { top: 10, left: 10, bottom: 65, right: 10 }, // Include buttons at bottom
    },
    {
        element: ".toolbar-date-page",
        popover: {
            title: '<span class="map-tut-pop-icon-box"><svg class="map-tut-pop-icon"><use xlink:href="#icon-calendar"/></svg></span> Navigate Through Time',
            description: "Pick any date using the date picker, then tap the ±d / ±m / ±y buttons to step forward or backward in time. The map updates instantly.",
            side: "bottom",
            align: "start",
        },
    },
    {
        element: "#AccordionToggle",
        popover: {
            title: '<span class="map-tut-pop-icon-box"><svg class="map-tut-pop-icon"><use xlink:href="#icon-layers"/></svg></span> Toggle Map Layers',
            description: "Open the Layers panel to turn data layers on or off. Choose from NIFC, Satellite, AirNow, and Published & Latest analysis datasets.",
            side: "left",
            align: "start",
        },
    },
    {
        element: "#AiChatToggle",
        popover: {
            title: '<span class="map-tut-pop-icon-box"><svg class="map-tut-pop-icon"><use xlink:href="#icon-chat"/></svg></span> AI Assistant (Beta)',
            description: "Got questions? Chat with our AI assistant about wildfire smoke, air quality, or anything on the map. It understands the data you're looking at! (This feature is currently under further development.)",
            side: "left",
            align: "start",
        },
    },
    {
        element: "#HysplitToggle",
        popover: {
            title: '<span class="map-tut-pop-icon-box"><svg class="map-tut-pop-icon"><use xlink:href="#icon-hysplit"/></svg></span> HYSPLIT Simulation',
            description: "Run custom HYSPLIT models from any point on the map. You can view, manage, and even download your simulation history directly from this drawer.",
            side: "right",
            align: "start",
        },
    },
    {
        element: "#WFnewsToggle",
        popover: {
            title: '<span class="map-tut-pop-icon-box"><canvas class="ui-pulsing-icon" data-type="news" width="24" height="24"></canvas></span> Wildfire News',
            description: "Stay updated with real-time wildfire news from across the region. Open this drawer to browse articles and see their locations on the map.",
            side: "right",
            align: "start",
        },
    },
    {
        element: "#MapPostToggle",
        popover: {
            title: '<span class="map-tut-pop-icon-box"><canvas class="ui-pulsing-icon" data-type="alert" width="24" height="24"></canvas></span> Community MapPost',
            description: "Share your own observations or read reports from other users. MapPost allows the community to pin real-time updates directly on the map.",
            side: "right",
            align: "start",
        },
    },
    {
        element: "#LegendToggle",
        popover: {
            title: '<span class="map-tut-pop-icon-box"><svg class="map-tut-pop-icon"><use xlink:href="#icon-legend"/></svg></span> Map Legend',
            description: "View the color scales and categories for all active layers. This dynamic legend updates automatically as you toggle different data on the map.",
            side: "right",
            align: "start",
        },
    },
    {
        element: ".maplibregl-ctrl-bottom-left",
        popover: {
            title: '<span class="map-tut-pop-icon-box"><svg class="map-tut-pop-icon"><use xlink:href="#icon-compass"/></svg></span> Map Navigation',
            description: "Use these controls to instantly reset the map to its default zoom level or find your current location on the map.",
            side: "top",
            align: "start",
        },
    },
    {
        element: "#FigurePageToggle",
        popover: {
            title: '<span class="map-tut-pop-icon-box"><svg class="map-tut-pop-icon"><use xlink:href="#icon-stats"/></svg></span> Stats & Charts Panel',
            description: "Click this button to open the Statistics panel. View daily and annual data tables, bar charts, scatter plots, and so on, for any selected region.",
            side: "top",
            align: "start",
        },
        padding: 20,
    },
    {
        element: "#MapBtnCapture",
        popover: {
            title: '<span class="map-tut-pop-icon-box"><svg class="map-tut-pop-icon"><use xlink:href="#icon-camera"/></svg></span> Snapshot Tool',
            description: "Click here to capture a snapshot of the current map state to save or share (this feature is not available on mobile).",
            side: "top",
            align: "start",
        },
    },
    {
        element: "#MapBtnAnimate",
        popover: {
            title: '<span class="map-tut-pop-icon-box"><svg class="map-tut-pop-icon"><use xlink:href="#icon-video"/></svg></span> Timelapse GIF',
            description: "Create a customized timelapse animation by selecting a date range. You can choose between Hourly or Daily steps to visualize smoke patterns over time.",
            side: "top",
            align: "start",
        },
    },
    {
        element: "#MapBtnReset",
        popover: {
            title: '<span class="map-tut-pop-icon-box"><svg class="map-tut-pop-icon"><use xlink:href="#icon-refresh"/></svg></span> Reset All',
            description: "Instantly jump back to the default map view and zoom level if you ever get lost or want a fresh start. All active layers will be unchecked and cleared.",
            side: "top",
            align: "end",
        },
        padding: 20,
    },
    {
        element: "#DescToggle",
        popover: {
            title: '<span class="map-tut-pop-icon-box"><svg class="map-tut-pop-icon"><use xlink:href="#icon-desc"/></svg></span> Layer Descriptions',
            description: "Curious about what a layer means? Open this panel to read detailed scientific descriptions of each data layer and dataset.",
            side: "top",
            align: "end",
        },
        padding: 20,
    }
];


/* ================================================================
   TUTORIAL CLASS
   ================================================================ */
export class MapTutorial {
    constructor() {
        this.isActive = false;
        this._welcomeEl = null;
        this._finishEl = null;
        this._driver = null;
    }

    /* ---------- PUBLIC API ---------- */
    /** Start the full tutorial (Welcome → Driver.js Tour → Finish) */
    start() {
        if (this.isActive) return;
        this.isActive = true;
        this._showWelcome();
    }


    /* ---------- PHASE 1: WELCOME ---------- */

    _showWelcome() {
        document.body.classList.add("map-tut-active");
        const el = document.createElement("div");
        el.className = "map-tut-overlay";
        el.innerHTML = `
      <div class="map-tut-overlay-title">Smokelyze Map Quick Start</div>
      <div class="map-tut-overlay-sub">
        Explore wildfire smoke data, air quality observations, <br>
        and research-grade datasets <br>
        - all on one interactive map -
      </div>
      <button class="map-tut-overlay-btn" id="TutWelcomeStart">
        Get Started Tour →
      </button>
      <button class="map-tut-overlay-skip" id="TutWelcomeSkip">
        Maybe later
      </button>
    `;
        document.body.appendChild(el);
        this._welcomeEl = el;

        el.querySelector("#TutWelcomeStart").addEventListener("click", () => {
            // Reset map view and close all drawers for a clean start
            document.getElementById("MapBtnReset")?.click();
            this._closeAllDrawers();
            this._hideWelcome(() => this._startDriverTour());
        });

        el.querySelector("#TutWelcomeSkip").addEventListener("click", () => {
            this._hideWelcome(() => {
                this.isActive = false;
                this._markComplete();
            });
        });
    }

    _hideWelcome(cb) {
        if (!this._welcomeEl) return cb?.();
        this._welcomeEl.classList.add("map-tut-fade-out");
        this._welcomeEl.addEventListener("animationend", () => {
            this._welcomeEl.remove();
            this._welcomeEl = null;
            // Note: map-tut-active stays until cleanup or finish
            cb?.();
        }, { once: true });
    }


    /* ---------- PHASE 2: DRIVER.JS TOUR ---------- */

    _startDriverTour() {
        const self = this;
        const isMobile = window.innerWidth <= 1024;
        const filteredSteps = TUTORIAL_STEPS.filter(step => {
            if (isMobile && (step.element === "#MapBtnCapture" || step.element === "#MapBtnAnimate")) return false;
            return true;
        });

        this._driver = window.driver.js.driver({
            showProgress: false,
            animate: true,
            smoothScroll: false,
            overlayColor: "rgba(0, 0, 0, 0.65)",
            stagePadding: 10,
            stageRadius: 8,
            allowClose: true,
            overlayClickAction: "none",
            allowKeyboardControl: false,
            popoverClass: "driver-popover-dark",
            showButtons: ["next", "previous", "close"],
            nextBtnText: "Next →",
            prevBtnText: "← Back",
            doneBtnText: "Finish ✓",
            steps: filteredSteps,
            onDestroyStarted: () => {
                // Check if tour was finished (on last step) or closed early
                if (self._driver && !self._driver.hasNextStep()) {
                    self._driver.destroy();
                    self._showFinish();
                } else {
                    self._driver.destroy();
                    self.isActive = false;
                    self._markComplete();
                }
            },
        });

        this._driver.drive();
    }


    /* ---------- PHASE 3: FINISH CELEBRATION ---------- */

    _showFinish() {
        const el = document.createElement("div");
        el.className = "map-tut-overlay";
        el.innerHTML = `
      <div class="map-tut-overlay-title">You're All Set!</div>
      <div class="map-tut-overlay-sub">
        Explore the map, toggle layers, and discover wildfire smoke patterns.
        You can restart this tour anytime from the Quick Start button.
      </div>
      <button class="map-tut-overlay-btn" id="TutFinishClose">
        Start Exploring →
      </button>
    `;
        document.body.appendChild(el);
        this._finishEl = el;

        el.querySelector("#TutFinishClose").addEventListener("click", () => {
            el.classList.add("map-tut-fade-out");
            el.addEventListener("animationend", () => {
                el.remove();
                this._finishEl = null;
                this.isActive = false;
                this._markComplete();
            }, { once: true });
        });
    }

    _markComplete() {
        document.body.classList.remove("map-tut-active");
        try {
            localStorage.setItem("smokelyze_tutorial_done", "1");
        } catch (e) {
            // Ignore storage errors
        }
    }

    static hasCompleted() {
        try {
            return localStorage.getItem("smokelyze_tutorial_done") === "1";
        } catch (e) {
            return false;
        }
    }

    static resetCompletion() {
        try {
            localStorage.removeItem("smokelyze_tutorial_done");
        } catch (e) {
            // Ignore
        }
    }

    /** Force-close all known drawers and panels to ensure a clean UI */
    _closeAllDrawers() {
        // 1. Layers Accordion
        const accordionPage = document.getElementById("AccordionPage");
        const accordionToggle = document.getElementById("AccordionToggle");
        if (accordionPage) accordionPage.classList.add("collapsed");
        if (accordionToggle) accordionToggle.style.display = "flex";

        // 2. Stats Drawer
        const statsDrawer = document.getElementById("FigurePageDrawer");
        const statsToggle = document.getElementById("FigurePageToggle");
        if (statsDrawer) statsDrawer.classList.remove("open");
        if (statsToggle) statsToggle.classList.remove("active");
        document.body.classList.remove("FigurePage-drawer-open");

        // 3. AI Chat Drawer
        const aiDrawer = document.getElementById("AiChatDrawer");
        const aiToggle = document.getElementById("AiChatToggle");
        if (aiDrawer) aiDrawer.classList.add("collapsed");
        if (aiToggle) aiToggle.classList.remove("active");

        // 4. Description Drawer
        const descDrawer = document.getElementById("DescDrawer");
        const descToggle = document.getElementById("DescToggle");
        if (descDrawer) descDrawer.classList.remove("open");
        if (descToggle) descToggle.classList.remove("active");

        // 5. News Drawer
        const newsDrawer = document.getElementById("WFnewsDrawer");
        const newsToggle = document.getElementById("WFnewsToggle");
        if (newsDrawer) newsDrawer.classList.remove("open");
        if (newsToggle) newsToggle.classList.remove("active");
        document.body.classList.remove("WFnews-drawer-open");

        // 6. MapPost Drawer
        const mapPostDrawer = document.getElementById("MapPostDrawer");
        const mapPostToggle = document.getElementById("MapPostToggle");
        if (mapPostDrawer) mapPostDrawer.classList.remove("open");
        if (mapPostToggle) mapPostToggle.classList.remove("active");
        document.body.classList.remove("MapPost-drawer-open");
        
        // 7. HYSPLIT Drawer
        const hysplitDrawer = document.getElementById("HysplitDrawer");
        const hysplitToggle = document.getElementById("HysplitToggle");
        if (hysplitDrawer) hysplitDrawer.classList.remove("open");
        if (hysplitToggle) hysplitToggle.classList.remove("active");
        document.body.classList.remove("Hysplit-drawer-open");

        // Ensure no leftover drawer-width property
        document.documentElement.style.removeProperty("--FigurePage-drawer-width");
    }
}


/* ================================================================
   AUTO-INIT
   ================================================================ */
// Create the global instance
window._mapTutorial = new MapTutorial();

function initTutorial() {
    const btn = document.getElementById("MapBtnTutorial");
    if (btn) btn.onclick = () => window._mapTutorial.start();

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("tutorial") === "true") {
        MapTutorial.resetCompletion();
        setTimeout(() => window._mapTutorial.start(), 1000);
    } else if (!MapTutorial.hasCompleted()) {
        setTimeout(() => window._mapTutorial.start(), 1500);
    }
}

setTimeout(initTutorial, 500);

