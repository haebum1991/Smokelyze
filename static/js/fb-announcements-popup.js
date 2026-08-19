
/**
 * Smokelyze Latest Update / Announcement Popup
 * Fetches the latest announcement from Firestore (limit 1) and displays a modern [Announcement] modal on the map page.
 * Uses localStorage caching to ensure users only see a specific update once unless a new update is published.
 */

import * as fb from "./fb-init.js";
import { ESML, formatDate } from "./utils.js";

const STORAGE_KEY = "smokelyze_last_seen_announcement";

const {
    collection,
    query,
    orderBy,
    limit,
    getDocs
} = fb;

let latestAnnouncementCache = null;

/**
 * Injects required modal styling into document.head once
 */
function ensureModalStyles() {
    if (document.getElementById("UpdateModalStyles")) return;
    const style = document.createElement("style");
    style.id = "UpdateModalStyles";
    style.textContent = `
        .update-modal-overlay {
            position: fixed;
            top: var(--header-height-total);
            bottom: 0;
            width: 100vw;
            height: calc(100vh - var(--header-height-total) - var(--footer-height));
            height: calc(100dvh - var(--header-height-total) - var(--footer-height));
            background: rgba(0, 0, 0, 0.65);
            backdrop-filter: blur(0.6rem);
            -webkit-backdrop-filter: blur(0.6rem);
            z-index: var(--z-highest);
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 1rem;
            box-sizing: border-box;
            animation: updateFadeIn 0.25s ease-out;
        }

        .update-modal-card {
            background: var(--color-bg);
            border: 0.1rem solid var(--border-main);
            border-radius: var(--border-radius-1p2rem, 1.2rem);
            box-shadow: 0 1.5rem 4rem rgba(0, 0, 0, 0.6);
            width: 50%;
            height: 100%;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            animation: updateScaleUp 0.25s ease-out;
        }

        @media (max-width: 1024px) {
            .update-modal-card {
                width: 100%;
            }
        }

        .update-modal-header {
            padding: 1.6rem 2rem;
            background: var(--sidebar-widget-bg, var(--color-bg));
            border-bottom: 0.1rem solid var(--border-main);
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 1.5rem;
        }

        .update-modal-title {
            margin: 0;
            font-size: 1.8rem;
            font-weight: bold;
            color: var(--card-shadow);
            white-space: normal;
            word-break: break-word;
            line-height: 1.4;
            flex: 1;
        }

        .update-modal-meta {
            padding: 1rem 2rem 0.4rem 2rem;
            font-size: 1.3rem;
            color: var(--card-shadow);
        }

        .update-modal-body {
            padding: 1.2rem 2rem 2rem 2rem;
            font-size: 1.5rem;
            line-height: 1.65;
            color: var(--text-main);
            overflow-y: auto;
            flex: 1 1 auto;
            white-space: pre-wrap;
            word-break: break-word;
            scrollbar-width: thin;
        }

        .update-modal-footer {
            padding: 1.4rem 2rem;
            background: var(--sidebar-widget-bg, var(--color-bg));
            border-top: 0.1rem solid var(--border-main);
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 1rem;
        }

        .update-dismiss-label {
            display: flex;
            align-items: center;
            gap: 0.8rem;
            font-size: 1.3rem;
            color: var(--text-main);
            opacity: 0.85;
            cursor: pointer;
            user-select: none;
        }

        .update-dismiss-label input[type="checkbox"] {
            cursor: pointer;
            accent-color: var(--card-shadow, #007cff);
            width: 1.6rem;
            height: 1.6rem;
        }

        @keyframes updateFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        @keyframes updateScaleUp {
            from { transform: scale(0.95); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
}

/**
 * Creates and injects the modal DOM structure into document.body if not already present
 */
function ensureModalDOM() {
    ensureModalStyles();
    if (document.getElementById("UpdateModalOverlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "UpdateModalOverlay";
    overlay.className = "update-modal-overlay";
    overlay.style.display = "none";

    overlay.innerHTML = `
        <div class="update-modal-card" id="UpdateModalCard">
            <div class="update-modal-header">
                <h3 id="UpdateModalTitle" class="update-modal-title">Smokelyze Update</h3>
                <button class="ui-btn-close" id="UpdateModalClose">
                    <svg width="20" height="20">
                        <use xlink:href="#icon-close" />
                    </svg>  
                </button>
            </div>
            <div class="update-modal-meta" id="UpdateModalMeta">
                <!-- Injected via JS -->
            </div>
            <div class="update-modal-body cm-area-display" id="UpdateModalBody">
                <!-- Injected via JS -->
            </div>
            <div class="update-modal-footer">
                <label class="update-dismiss-label" for="UpdateDismissCheck">
                    <input type="checkbox" id="UpdateDismissCheck">
                    <span>Don't show this update again</span>
                </label>
                <button class="reply-btn-submit" id="UpdateBtnConfirm">Got it!</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Event Listeners
    const closeBtn = document.getElementById("UpdateModalClose");
    const confirmBtn = document.getElementById("UpdateBtnConfirm");
    const dismissCheck = document.getElementById("UpdateDismissCheck");

    const closeModal = () => {
        if (latestAnnouncementCache) {
            try {
                if (dismissCheck && dismissCheck.checked) {
                    // Save last seen ID so it won't auto-popup on next map visit
                    localStorage.setItem(STORAGE_KEY, latestAnnouncementCache.id);
                } else {
                    // User unchecked: remove from localStorage so it WILL popup again on next map visit
                    localStorage.removeItem(STORAGE_KEY);
                }
            } catch (e) {
                console.warn("Failed to update localStorage for announcement:", e);
            }
        }
        overlay.style.display = "none";
    };

    closeBtn?.addEventListener("click", closeModal);
    confirmBtn?.addEventListener("click", closeModal);

    // Keyboard accessibility: ESC key to close
    window.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && overlay.style.display !== "none") {
            closeModal();
        }
    });
}

/**
 * Renders announcement data into the modal and displays it
 */
function displayAnnouncementModal(announcement) {
    ensureModalDOM();

    latestAnnouncementCache = announcement;
    const overlay = document.getElementById("UpdateModalOverlay");
    const titleEl = document.getElementById("UpdateModalTitle");
    const metaEl = document.getElementById("UpdateModalMeta");
    const bodyEl = document.getElementById("UpdateModalBody");
    const dismissCheck = document.getElementById("UpdateDismissCheck");

    if (!overlay || !titleEl || !metaEl || !bodyEl) return;

    titleEl.textContent = announcement.title || "Update Announcement";

    const createdVal = announcement.createdAt;
    const dateStr = createdVal ? formatDate(createdVal.toDate ? createdVal.toDate() : new Date(createdVal)) : "Just now";
    const authorStr = announcement.userName || "Developer";

    metaEl.innerHTML = `Posted by <b>${ESML(authorStr)}</b> • <span>${ESML(dateStr)}</span>`;
    bodyEl.textContent = announcement.text || "";

    // Default to true (checked) so clicking Got it dismisses future auto-popups for this announcement
    if (dismissCheck) {
        dismissCheck.checked = true;
    }

    overlay.style.display = "flex";
}

/**
 * Checks Firestore for the newest announcement and displays modal if unseen.
 * When forceShow is true and memory cache exists, displays modal instantly without network request.
 */
export async function checkLatestAnnouncement(forceShow = false) {
    // 1. Instant open from memory cache if already fetched
    if (forceShow && latestAnnouncementCache) {
        displayAnnouncementModal(latestAnnouncementCache);
        return;
    }

    if (!fb.db) return;

    try {
        const q = query(
            collection(fb.db, "smokelyze_announcements"),
            orderBy("createdAt", "desc"),
            limit(1)
        );

        const snap = await getDocs(q);
        if (snap.empty) return;

        const docSnap = snap.docs[0];
        const announcement = { id: docSnap.id, ...docSnap.data() };
        latestAnnouncementCache = announcement;

        const lastSeenId = localStorage.getItem(STORAGE_KEY);

        // Show popup if not seen yet, or if forced (e.g. user clicked [Announcement] button)
        if (forceShow || lastSeenId !== announcement.id) {
            displayAnnouncementModal(announcement);
        }
    } catch (err) {
        console.warn("[Announcement Popup] Check failed:", err);
    }
}

// Expose globally so users or UI buttons can trigger it anytime
window.showLatestAnnouncement = () => checkLatestAnnouncement(true);

function bindAnnouncementBtn() {
    const btn = document.getElementById("MapBtnAnnouncement");
    if (btn && !btn._bound) {
        btn._bound = true;
        btn.addEventListener("click", () => checkLatestAnnouncement(true));
    }
}

// Auto-run on map load after a gentle delay
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
        bindAnnouncementBtn();
        setTimeout(() => checkLatestAnnouncement(false), 1200);
    });
} else {
    bindAnnouncementBtn();
    setTimeout(() => checkLatestAnnouncement(false), 1200);
}

