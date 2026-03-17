
/**
 * MapPost Event Handlers
 * Separated from fb-MapPost.js for better maintainability
 * 
 * This module handles all click events for MapPost functionality
 * using a registry pattern for better performance and maintainability.
 */

import * as utils from "./utils.js";
import { setMapPostDrawer } from "./ui-toggles.js";
import { showErrorToast } from "./loader.js";
import { map } from "./map-init.js";

// Note: These will be injected from fb-MapPost.js to avoid circular dependencies
let state = null;
let dbFetchNickname = null;
let dbSaveMapPost = null;
let dbToggleLikeMapPost = null;
let clickOnDelete = null;
let renderMapPostDetail = null;
let uiShowModal = null;
let uiHideModal = null;
let handleMapPostModeToggle = null;
let resetLoadedSources = null;
let updateAllActiveSources = null;

/**
 * Initialize handlers with dependencies from fb-MapPost.js
 * This avoids circular dependency issues
 */
export function initHandlers(deps) {
    state = deps.state;
    dbFetchNickname = deps.dbFetchNickname;
    dbSaveMapPost = deps.dbSaveMapPost;
    dbToggleLikeMapPost = deps.dbToggleLikeMapPost;
    clickOnDelete = deps.clickOnDelete;
    renderMapPostDetail = deps.renderMapPostDetail;
    uiShowModal = deps.uiShowModal;
    uiHideModal = deps.uiHideModal;
    handleMapPostModeToggle = deps.handleMapPostModeToggle;
    resetLoadedSources = deps.resetLoadedSources;
    updateAllActiveSources = deps.updateAllActiveSources;
}

// ============================================
// Event Handler Registry
// ============================================

export const CLICK_HANDLERS = {
    // List Actions
    "clickOnLocation": handleLocationClick,
    "clickOnAddFromDrawer": handleAddFromDrawer,
    "clickOnShowDetail": handleShowDetail,

    // Modal Actions
    "reply-btn-edit-detail": handleEditDetail,
    "reply-btn-delete-detail": handleDeleteDetail,

    // Like Actions
    "post-like-box": handlePostLike,
    "reply-like-btn": handleReplyLike,

    // Reply UI Actions
    "reply-btn-reply": handleReplyOpen,
    "reply-btn-cancel": handleReplyCancel,
    "reply-btn-submit": handleReplySubmit,

    // Inline Reply Actions
    "reply-btn-edit": handleInlineEdit,
    "reply-btn-cancel-inline": handleInlineCancel,
    "reply-btn-submit-inline": handleInlineSubmit,
    "reply-btn-delete": handleInlineDelete,

    // Map Restore
    "MapPost-btn-restore": handleMapRestore
};

// ============================================
// Handler Functions
// ============================================

function handleLocationClick(element) {
    const { id, lon, lat } = element.dataset;

    // Ensure the MapPost layer is ON before moving
    const toggle = document.getElementById("layer-MapPost");
    let toggleWasOff = false;
    if (toggle && !toggle.checked) {
        toggleWasOff = true;
        toggle.checked = true;
        // Trigger the change manually since we set .checked via JS
        toggle.dispatchEvent(new Event("change", { bubbles: true }));
    }

    const targetCoords = [parseFloat(lon), parseFloat(lat)];
    const targetProps = { ...state.MapPostData[id], docId: id };

    if (toggleWasOff) {
        // Wait for the debounced update (200ms) to finish map refresh
        setTimeout(() => {
            utils.highlightLocation(targetCoords, targetProps, "MapPost");
        }, 300);
    } else {
        utils.highlightLocation(targetCoords, targetProps, "MapPost");
    }
}

function handleAddFromDrawer(element) {
    if (!state.currentUser) {
        utils.showAuthOverlay();
        return;
    }

    if (window.innerWidth <= 1024 && setMapPostDrawer) {
        setMapPostDrawer(false);
    }
    handleMapPostModeToggle(true);
}

function handleShowDetail(element) {
    const id = element.dataset.id;
    renderMapPostDetail(id);
}

function handleEditDetail(element) {
    const id = element.dataset.id;
    const data = state.MapPostData[id];
    if (data) {
        uiShowModal({ id, ...data });
    }
}

async function handleDeleteDetail(element) {
    const id = element.dataset.id;
    return clickOnDelete(id);
}

function handlePostLike(element) {
    const id = element.dataset.id;
    return dbToggleLikeMapPost(id);
}

function handleReplyLike(element) {
    const id = element.dataset.id;
    return dbToggleLikeMapPost(id);
}

function handleReplyOpen(element) {
    if (!state.currentUser) {
        utils.showAuthOverlay();
        return;
    }

    const id = element.dataset.id;
    const container = document.getElementById(`ReplyTextContainer-${id}`);

    if (container) {
        container.style.display = "block";
        const textarea = container.querySelector("textarea");
        if (textarea) {
            textarea.focus();
            // Update counter for reply textarea
            const counter = textarea.parentElement.querySelector(".reply-counter");
            if (counter) {
                const len = textarea.value.length;
                const max = 2000;
                counter.textContent = `${len}/${max}`;
                counter.style.color = len > max ? "var(--btn-minus)" : "var(--text-main)";
            }
        }
        element.style.display = "none";
    }
}

function handleReplyCancel(element) {
    const container = element.closest(".reply-text-container");
    if (!container) return;
    container.style.display = "none";

    const rootId = container.id.replace("ReplyTextContainer-", "");
    const openBtn = document.querySelector(`.reply-btn-reply[data-id="${rootId}"]`);
    if (openBtn) openBtn.style.display = "block";
}

async function handleReplySubmit(element) {
    if (!state.currentUser) {
        utils.showAuthOverlay();
        return;
    }

    const rootId = element.dataset.root;
    const parentId = element.dataset.parent;
    const container = document.getElementById(`ReplyTextContainer-${parentId}`);

    if (!container) return;

    const textarea = container.querySelector("textarea");
    if (!textarea) return;

    const text = textarea.value;
    if (!text.trim()) {
        return alert("Enter a reply.");
    }

    // Validation
    if (text.length > 2000) {
        return alert(`Reply is too long (${text.length}/2000 characters). Please shorten it.`);
    }

    element.disabled = true;
    element.innerText = "...";

    try {
        let userName = state.currentUser.displayName;
        const nickname = await dbFetchNickname(state.currentUser.uid);
        if (nickname) userName = nickname;

        const rootMapPost = state.MapPostData[rootId];
        const viewers = (rootMapPost && rootMapPost.viewers) ? rootMapPost.viewers : ["public"];

        await dbSaveMapPost(null, {
            title: "",
            text,
            type: "reply",
            rootId,
            parentId,
            date: rootMapPost ? rootMapPost.date : "",
            lon: rootMapPost ? rootMapPost.lon : 0,
            lat: rootMapPost ? rootMapPost.lat : 0,
            uid: state.currentUser.uid,
            userName: userName || "Anonymous",
            viewers
        });
    } catch (err) {
        alert("Reply failed.");
    } finally {
        element.disabled = false;
        element.innerText = "Submit";
    }
}

function handleInlineEdit(element) {
    const rid = element.dataset.id;
    const body = document.getElementById(`ReplyItemBody-${rid}`);

    if (body) {
        const display = body.querySelector(".cm-area-display");
        const edit = body.querySelector(".cm-area-edit");

        if (display) display.style.display = "none";
        if (edit) {
            edit.style.display = "block";
            const textarea = edit.querySelector("textarea");
            if (textarea) {
                // Update counter for inline edit textarea
                const counter = textarea.parentElement.querySelector(".reply-counter");
                if (counter) {
                    const len = textarea.value.length;
                    const max = 2000;
                    counter.textContent = `${len}/${max}`;
                    counter.style.color = len > max ? "var(--btn-minus)" : "var(--text-main)";
                }
            }
        }
    }

    const item = document.getElementById(`ReplyItem-${rid}`);
    if (item) {
        const viewWrapper = item.querySelector(".reply-btn-wrapper-view");
        if (viewWrapper) viewWrapper.style.display = "none";

        const editWrapper = item.querySelector(".reply-btn-wrapper-edit");
        if (editWrapper) editWrapper.style.display = "flex";
    }
}

function handleInlineCancel(element) {
    const rid = element.dataset.id;
    const body = document.getElementById(`ReplyItemBody-${rid}`);

    if (body) {
        const display = body.querySelector(".cm-area-display");
        const edit = body.querySelector(".cm-area-edit");

        if (display) display.style.display = "block";
        if (edit) edit.style.display = "none";
    }

    const item = document.getElementById(`ReplyItem-${rid}`);
    if (item) {
        const viewWrapper = item.querySelector(".reply-btn-wrapper-view");
        if (viewWrapper) viewWrapper.style.display = "flex";

        const editWrapper = item.querySelector(".reply-btn-wrapper-edit");
        if (editWrapper) editWrapper.style.display = "none";
    }
}

async function handleInlineSubmit(element) {
    const rid = element.dataset.id;
    const body = document.getElementById(`ReplyItemBody-${rid}`);

    if (!body) return;

    const textarea = body.querySelector(".cm-text-typing");
    if (!textarea) return;

    const text = textarea.value;
    if (!text.trim()) {
        return alert("Text cannot be empty.");
    }

    // Validation
    if (text.length > 2000) {
        return alert(`Reply is too long (${text.length}/2000 characters). Please shorten it.`);
    }

    element.disabled = true;

    try {
        await dbSaveMapPost(rid, { text });
    } catch (err) {
        alert("Update failed.");
    } finally {
        element.disabled = false;
    }
}

function handleInlineDelete(element) {
    const id = element.dataset.id;
    return clickOnDelete(id);
}

async function handleMapRestore(element) {
    if (!state.currentUser) {
        utils.showAuthOverlay();
        return;
    }

    const rid = element.dataset.id;
    const data = state.MapPostData[rid];

    if (!data || !data.mapState) return;

    const ms = data.mapState;

    // 1. Move map
    if (ms.center) {
        map.flyTo({
            center: ms.center,
            zoom: ms.zoom || map.getZoom(),
            essential: true
        });
    }

    let dateChanged = false;
    let layersChanged = false;

    // 2. Change Date
    const dp = document.getElementById("datePicker");
    if (dp && ms.date && dp.value !== ms.date) {
        dp.value = ms.date;
        dateChanged = true;
    }

    // 3. Restore Layers
    if (ms.layers) {
        document.querySelectorAll("input[type=checkbox][id^='layer-']").forEach(cb => {
            const shouldBeChecked = ms.layers.includes(cb.id);
            if (cb.checked !== shouldBeChecked) {
                cb.checked = shouldBeChecked;
                layersChanged = true;
            }
        });
    }

    // 4. Restore Data Source
    const dsSelect = document.getElementById("MapDataSelect");
    if (dsSelect) {
        const targetDS = ms.dataSource || "gam-v2";
        if (dsSelect.value !== targetDS) {
            dsSelect.value = targetDS;
            layersChanged = true;
        }
    }

    if (dateChanged || layersChanged) {
        if (dateChanged && resetLoadedSources) {
            resetLoadedSources();
        }
        if (updateAllActiveSources) {
            updateAllActiveSources();
        }
    }

    if (showErrorToast) {
        showErrorToast("Map condition restored!", "info");
    }

    if (window.innerWidth <= 1024 && typeof setMapPostDrawer === "function") {
        setMapPostDrawer(false);
    }

    uiHideModal();
}

// ============================================
// Main Event Dispatcher
// ============================================

export function setupClickHandlers() {
    document.body.addEventListener("click", async (e) => {
        const target = e.target;

        // Fast path: Check all registered handlers
        for (const [selector, handler] of Object.entries(CLICK_HANDLERS)) {
            const element = target.closest(`.${selector}`);
            if (element) {
                return handler(element, e);
            }
        }
    });
}

