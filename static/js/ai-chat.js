
import { fetchGeminiChat, clearAiChatHistory } from "./ai-api.js";
import { marked } from "https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js";
import { auth } from "./fb-init.js";
import { showAuthOverlay } from "./utils.js";
import { addSwipeClose } from "./ui-toggles.js";
import { regionStats } from "./layers-state.js";

// Expose regionStats for AI tools to access summary data
window.getRegionStats = () => regionStats;

// DOM Elements
const aiToggleBtn = document.getElementById("AiChatToggle");
const aiDrawer = document.getElementById("AiChatDrawer");
const aiDrawerCloseBtn = document.getElementById("AiChatDrawerClose");
const aiChatList = document.getElementById("AiChatList");
const aiChatInput = document.getElementById("AiChatInput");
const aiChatSubmitBtn = document.getElementById("AiChatSubmitBtn");

let hasShownKeyWarning = false;
  
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

            // Check API Key - Only show once per session to avoid annoyance
            if (!localStorage.getItem("smokelyze_gemini_key") && !hasShownKeyWarning) {
                appendSystemMessage("API Key is not set yet. Please enter your key in [Profiles] > [Settings] > [Google Gemini API]. You can use it immediately after registration!");
                hasShownKeyWarning = true;
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
    
    // Add Swipe to close for mobile
    addSwipeClose(aiDrawer, {
        direction: "down",
        onClose: closeDrawer
    });
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
    aiChatList.innerHTML += `<div id="${loadingId}" class="AiChat-msg AiChat-ai" style="color:var(--text-soft);">...Analyzing...</div>`;
    scrollToBottom();

    // Context Generation
    const dashboardContext = generateContext();

    try {
        const aiResponse = await fetchGeminiChat(dashboardContext, text);
        document.getElementById(loadingId)?.remove();

        const aiResponseText = aiResponse.text;
        const usage = aiResponse.usage;

        appendMessage("ai", aiResponseText, usage);
    } catch (err) {
        document.getElementById(loadingId)?.remove();
        appendSystemMessage("An error occurred: " + err.message);
    }
}


function appendMessage(role, text, usage = null) {
    const div = document.createElement("div");
    div.className = `AiChat-msg AiChat-${role}`;

    // Create Content Container
    const content = document.createElement("div");

    // Parse Markdown for AI answers
    if (role === "ai" && typeof marked !== "undefined") {
        const rawHTML = marked.parse(text);
        const parser = new DOMParser();
        const htmlDoc = parser.parseFromString(rawHTML, "text/html");
        content.innerHTML = htmlDoc.body.innerHTML;
    } else {
        content.innerText = text;
    }
    div.appendChild(content);

    // Append Token Usage Info if available
    if (usage) {
        const usageDiv = document.createElement("div");
        usageDiv.style = "font-size: 1.2rem; color: var(--text-main); border-top: 1px solid var(--card-shadow); margin-top: 0.8rem; padding-top: 0.4rem; font-family: monospace; opacity: 0.8;";
        usageDiv.innerText = `In:${usage.promptTokenCount} | Out:${usage.candidatesTokenCount} | Tot:${usage.totalTokenCount}`;
        div.appendChild(usageDiv);
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
    container.className = "AiChat-suggestions";

    suggestions.forEach(text => {
        const chip = document.createElement("button");
        chip.className = "AiChat-suggestion-chip";
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
        "Go the date to 2021-05-10.",
        "Set the date to 2023-06-10, and turn on the HMS smoke layer.",
        "show the PM2.5 results for the GAM-v1 model on 2023-06-08, and which site had the lowest?",
        "Show the SMO results for the GAM-v2 model on 2024-08-15, and which site had the highest?"
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

    // 0. Current Real-world Time (Local)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const localToday = `${year}-${month}-${day}`;

    contextLines.push(`Current Local Time: ${now.toLocaleString()}`);
    contextLines.push(`Today's Local Date: ${localToday}`);

    // 1. Date (Dashboard View Date)
    const datePicker = document.getElementById("datePicker");
    if (datePicker && datePicker.value) {
        contextLines.push(`View Date (Map Active Date): ${datePicker.value}`);
    }

    // 2. Published Dataset Model
    const dsSelect = document.getElementById("MapDataSelect");
    if (dsSelect) {
        const val = dsSelect.value;
        const text = dsSelect.options[dsSelect.selectedIndex]?.text || "Unknown";
        contextLines.push(`Active Model: ID="${val}", Label="${text}"`);
    }

    // 3. Simple list of visible checkboxes
    const activeLayers = [];
    document.querySelectorAll(".accordion-page input[type='checkbox']").forEach(cb => {
        if (cb.checked && cb.parentElement.style.display !== "none") {
            const labelText = cb.parentElement.innerText.trim() || cb.id;
            activeLayers.push(`${cb.id} ("${labelText}")`);
        }
    });
    if (activeLayers.length > 0) {
        contextLines.push(`Active Layers: ${activeLayers.join(", ")}`);
    } else {
        contextLines.push(`Active Layers: None`);
    }

    // AI Mapping Hint: Helps AI correlate display IDs to internal source names
    contextLines.push(`[System Note] Model ID "gam-v2" maps to source "gam_v2". If a layer like "layer-smo-gam-v2" is active, it means "gam-v2" data is present.`);

    return contextLines.join("\n");
}

// Auto init if directly included
document.addEventListener("DOMContentLoaded", initAiChat);

