
import { fetchGeminiChat, clearAiChatHistory } from "./ai-api.js";
import { marked } from "https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js";
import { auth } from "./fb-init.js";
import { showAuthOverlay } from "./utils.js";

// DOM Elements
const aiToggleBtn = document.getElementById("AiChatToggle");
const aiDrawer = document.getElementById("AiChatDrawer");
const aiDrawerCloseBtn = document.getElementById("AiChatDrawerClose");
const aiChatList = document.getElementById("AiChatList");
const aiChatInput = document.getElementById("AiChatInput");
const aiChatSubmitBtn = document.getElementById("AiChatSubmitBtn");

export function initAiChat() {
    if (!aiToggleBtn || !aiDrawer) return;

    // Build the initial state
    resetToWelcome();
    
    // Toggle Drawer Open/Close
    aiToggleBtn.addEventListener("click", () => {
    
        // Check Login Status First
        if (!auth.currentUser) {
            showAuthOverlay();
            return;
        }

        // Since we are using accordion-page, it uses "collapsed" class
        const isCurrentlyClosed = aiDrawer.classList.contains("collapsed");

        if (isCurrentlyClosed) {
            // Close the main Layer accordion if open on mobile to avoid overlap
            if (window.innerWidth <= 1024) {
                const layerAccordion = document.getElementById("AccordionPage");
                if (layerAccordion && !layerAccordion.classList.contains("collapsed")) {
                    document.getElementById("AccordionToggle")?.click();
                }
            }

            aiDrawer.classList.remove("collapsed");
            aiToggleBtn.classList.add("active");
            scrollToBottom();

            // Check API Key
            if (!localStorage.getItem("smokelyze_gemini_key")) {
                appendSystemMessage("API Key is not set yet. Please enter your key in [Profiles] > [Settings] > [Google Gemini API]. You can use it immediately after registration!");
            }
        } else {
            closeDrawer();
        }
    });

    const mainAccordionToggle = document.getElementById("AccordionToggle");
    if (mainAccordionToggle) {
        mainAccordionToggle.addEventListener("click", () => {
            if (window.innerWidth <= 1024) {
                if (!aiDrawer.classList.contains("collapsed")) closeDrawer();
            }
        });
    }

    aiDrawerCloseBtn.addEventListener("click", closeDrawer);
    
    const chatBtnClear = document.getElementById("AiChatClearBtn");
    if (chatBtnClear) {
        chatBtnClear.addEventListener("click", () => {
            if (confirm("Are you sure you want to clear the entire chat history?")) {
                resetToWelcome();
            }
        });
    }
    
    aiChatSubmitBtn.addEventListener("click", handleChatSubmit);
    aiChatInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleChatSubmit();
        }
    });

    // Make it draggable
    makeDraggable(aiDrawer, aiDrawer.querySelector(".accordion-header"));
}

function makeDraggable(el, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

    // Mouse events
    handle.onmousedown = dragMouseDown;

    // Touch events for mobile
    handle.ontouchstart = dragTouchStart;

    function dragMouseDown(e) {
        if (window.innerWidth <= 1024) return;
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        if (window.innerWidth <= 1024) return;
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        el.style.top = (el.offsetTop - pos2) + "px";
        el.style.left = (el.offsetLeft - pos1) + "px";
        el.style.right = "auto";
    }

    function dragTouchStart(e) {
        if (window.innerWidth <= 1024) return;
        pos3 = e.touches[0].clientX;
        pos4 = e.touches[0].clientY;
        document.ontouchend = closeDragElement;
        document.ontouchmove = elementTouchDrag;
    }

    function elementTouchDrag(e) {
        if (window.innerWidth <= 1024) return;
        pos1 = pos3 - e.touches[0].clientX;
        pos2 = pos4 - e.touches[0].clientY;
        pos3 = e.touches[0].clientX;
        pos4 = e.touches[0].clientY;
        el.style.top = (el.offsetTop - pos2) + "px";
        el.style.left = (el.offsetLeft - pos1) + "px";
        el.style.right = "auto";
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
        document.ontouchend = null;
        document.ontouchmove = null;
    }
}

function closeDrawer() {
    aiDrawer.classList.add("collapsed");
    aiToggleBtn.classList.remove("active");
}

async function handleChatSubmit() {
    const text = aiChatInput.value.trim();
    if (!text) return;

    // Check key again
    if (!localStorage.getItem("smokelyze_gemini_key")) {
        appendSystemMessage("API Key is not set yet. Please enter your key in [Profiles] > [Settings] > [Google Gemini API].");
        return;
    }

    // Append visually immediately
    appendMessage("user", text);
    aiChatInput.value = "";

    // Create loading element
    const loadingId = "loader-" + Date.now();
    aiChatList.innerHTML += `<div id="${loadingId}" class="chat-msg chat-ai" style="color:var(--text-soft);">...Analyzing...</div>`;
    scrollToBottom();

    // Context Generation
    const context = generateContext();
    const systemPrompt = `You are the **Chief Atmospheric Scientist and Data Analysis Expert** for the Smokelyze platform.
Your role is to provide deep, professional insights and infer causal relationships in the atmospheric environment based on the provided data, rather than just reciting numbers.

Current dashboard state:
===
[Current Dashboard Context]
${context}
===

**Operating Principles:**
1. **Autonomous Reasoning:** When users ask about causes, future outlooks, or meteorological backgrounds, combine evidence from extracted data (Facts) with your vast atmospheric/environmental knowledge to provide logical inferences. Explain specific mechanisms (e.g., "Smoke particles likely reacted photochemically with NOx, leading to increased ozone concentrations") instead of just saying "the data says so."
2. **Proactive Tool Use:** If you need more information for context (e.g., comparing different fields for correlation), use multiple tools in sequence to reach the best conclusion.
3. **Professionalism:** Use Markdown for better readability and maintain a professional, trustworthy, and polite tone.
**Variable Glossary & Data Instructions (Global Definitions):**

- **Live Updates**:
  - **WF News**: Wildfire news from Google News. UTC based, updated every 6 hrs. Article assigned to representative state locations with jitter.
  - **WF Incident Locations (NIFC)**: Precise coordinates for active fires. Includes discovery time, name, cause, and area (acres). Every 6 hrs.
  **Full Variable & Dataset Glossary (Chief Scientist Reference):**

- **1. Live Updates (Real-time)**:
  - **WF News**: Wildfire news from Google News. UTC based, updated every 6 hrs. Assigned to state locations with jitter.
  - **WF Incident Locations (NIFC)**: Verified fire occurrences (NIFC WFIGS/IRWIN). Includes discovery coordinates, name, cause, and area (acres). Updated every 6 hrs.
  - **MapPost**: Community insights, pinned onto specific coordinates with titles/content.

- **2. AirNow (Observations)**:
  - **Obs MDA8**: Max Daily 8-hour average ozone (ppb). Primary health standard metric. (1-day delay)
  - **Obs PM2.5**: 24-hour averaged fine particulate matter (ug/m3). (1-day delay)
  - **Obs O3/PM2.5/NO2 (Hourly)**: Real-time concentrations from RSIG server for tracking active plumes. (1-2 hr delay)

- **3. Satellite Data**:
  - **HMS-smoke**: NOAA-HMS satellite plumes showing areas of overhead smoke.
  - **HMS-fire**: NOAA-HMS fire hotspots with FRP (Fire Radiative Power in MW). Spatially aggregated at 0.001 deg.
  - **MODIS burned area (MCD64A1)**: Historical monthly fire footprints at 500m resolution.

- **4. Research/Published Models**:
  - **UW GAM-v2**: Apr-Oct (2019-2024), US wide. Most recent version using HMS & PM2.5 to predict baseline O3.
  - **UW GAM-v1**: May-Sep (2018-2023), CONUS.
  - **UW Smoke PM2.5**: Full year (2019-2024), health impact focus.
  - **EPA EMBER**: Screening-level modeling of 2023 ozone fire impacts.

- **5. Detailed Variable Definitions**:
  - **Obs MDA8/PM2.5**: Measured values at AQS monitoring sites.
  - **Pred MDA8**: Model-predicted O3 concentration WITHOUT wildfire smoke (Baseline).
  - **SMO (Smoke O3)**: Smoke-attributable ozone portion. (Obs - Pred) only on smoke days.
  - **Residual**: (Obs - Pred) for all days. Positive = enhancement.
  - **Quant residual/PM2.5**: Percentile status based on non-smoke distributions. 
  - **PM2.5-crit**: Threshold (Median + 1.0 MAD or 0.5 MAD) to classify "smoke-impacted" conditions.
  - **TMAX / SRAD**: Max Temp and Solar Flux (meteorological drivers).
  - **Smoke day (SMD)**: Classified by [HMS overhead plume] AND [Surface PM2.5 > PM2.5-crit].
  - **SMO > 97.5th**: Extreme smoke O3 impact (Residual exceeds 97.5th percentile of non-smoke days).
  - **Exc. day (Exceedance)**: O3 > 70 ppb or PM2.5 > 9 ug/m3. Analyze if SMO/Smoke PM2.5 was the cause.
  - **EDM versions**: Experimental Data-driven Model versions for comparative analysis.

**Technical Guidelines:**
- **Coordinate Precision:** When mentioning coordinates (Latitude, Longitude) in your response, always format them to **at least 3 decimal places** (e.g., 47.606, -122.332).
- When using \`move_to_location\` after analysis, always pass the entire "properties" object from \`extract_map_data\` for proper tooltip display.`;

    try {
        const aiResponse = await fetchGeminiChat(systemPrompt, text);
        document.getElementById(loadingId)?.remove();

        const aiResponseText = aiResponse.text;

        appendMessage("ai", aiResponseText);
    } catch (err) {
        document.getElementById(loadingId)?.remove();
        appendSystemMessage("An error occurred: " + err.message);
    }
}



function appendMessage(role, text) {
    const div = document.createElement("div");
    div.className = `chat-msg chat-${role}`;

    // Parse Markdown for AI answers
    if (role === "ai" && typeof marked !== "undefined") {
        const rawHTML = marked.parse(text);
        // Using DOMParser as a basic sanity check
        const parser = new DOMParser();
        const htmlDoc = parser.parseFromString(rawHTML, "text/html");
        div.innerHTML = htmlDoc.body.innerHTML;
    } else {
        div.innerText = text;
    }

    aiChatList.appendChild(div);
    scrollToBottom();
}

function appendSystemMessage(text) {
    const div = document.createElement("div");
    div.style = "text-align:center; color: var(--text-main); font-size: 1.3rem; margin: 1rem 0;";
    div.innerText = text;
    aiChatList.appendChild(div);
    scrollToBottom();
}

function appendSuggestions(suggestions) {
    const container = document.createElement("div");
    container.className = "chat-suggestions";

    suggestions.forEach(text => {
        const chip = document.createElement("button");
        chip.className = "suggestion-chip";
        chip.innerText = text;
        chip.onclick = () => {
            aiChatInput.value = text;
            handleChatSubmit();
            // Remove suggestions after first interaction
            container.remove();
        };
        container.appendChild(chip);
    });

    aiChatList.appendChild(container);
    scrollToBottom();
}

function resetToWelcome() {
    // Clear Core Data
    clearAiChatHistory();

    // Clear UI
    aiChatList.innerHTML = "";

    // Append Welcome
    appendSystemMessage("Welcome to Smokelyze Ai assistant. Ask anything about air quality analysis or how to use the platform!");
    appendSuggestions([
        "Explain what SMO (Smoke O3) means.",
        "How can I identify a [Smoke day]?",
        "Show SMO results for GAM-v2 data on June 8, 2023, and which site had the highest?"
    ]);

    scrollToBottom();
}

function scrollToBottom() {
    setTimeout(() => {
        aiChatList.scrollTop = aiChatList.scrollHeight;
    }, 50);
}

// ----------------------------------------------------
// UI State Context Generator
// ----------------------------------------------------
function generateContext() {
    const contextLines = [];

    // 0. Current Real-world Time
    const now = new Date();
    contextLines.push(`Current Real-world Time: ${now.toLocaleString()}`);

    // 1. Date (Dashboard View Date)
    const datePicker = document.getElementById("datePicker");
    if (datePicker && datePicker.value) {
        contextLines.push(`View Date: ${datePicker.value}`);
    }

    // 2. Published Dataset Model
    const dsSelect = document.getElementById("MapDataSelect");
    if (dsSelect) {
        const option = dsSelect.options[dsSelect.selectedIndex];
        if (option) contextLines.push(`Active Model: ${option.text}`);
    }

    // 3. Simple list of visible checkboxes
    const activeLayers = [];
    document.querySelectorAll(".accordion-page input[type='checkbox']").forEach(cb => {
        if (cb.checked) {
            // Find its label text gently
            const labelText = cb.parentElement.innerText.trim() || cb.id;
            activeLayers.push(labelText.replace(/\n/g, "").substring(0, 30));
        }
    });
    if (activeLayers.length > 0) {
        contextLines.push(`Active Layers: ${activeLayers.join(", ")}`);
    }

    return contextLines.join("\
");
}

// Auto init if directly included
document.addEventListener("DOMContentLoaded", initAiChat);

