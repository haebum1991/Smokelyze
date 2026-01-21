
import * as fb from "./fb-init.js";
import * as utils from "./utils.js";
import { map } from "./map-init.js";
import { setMapPostDrawer } from "./ui-toggles.js";
import { initUIPulsingIcons } from "./layers-icon.js";
import { updateAuthButton } from "./signin.js";
import { resetLoadedSources, updateAllActiveSources, showErrorToast } from "./loader.js";

// --- 1. Global State (Prefix: state) ---
const state = {
    unsubscribeDate: null,
    unsubscribeRecent: null,
    unsubscribeRecentReplies: null,
    pendingLngLat: null,
    currentUser: null,
    editingDocId: null,
    viewingDocId: null,
    lastLoadedDate: null,
    MapPostData: {},
    RecentIds: [],
    MarkerIds: new Set(),
    previewMarker: null,
    isMapPostMode: false,
    dbRefs: {}
};

const db = fb.db;
const auth = fb.auth;

const {
    collection, addDoc, onSnapshot, query, where, orderBy, limit,
    serverTimestamp, googleProvider, signInWithPopup, signOut,
    onAuthStateChanged, doc, getDoc, updateDoc, deleteDoc, writeBatch,
    arrayUnion, arrayRemove
} = fb;

const MapPostCol = collection(db, "smokelyze_MapPost");
state.dbRefs = {
    db,
    MapPostCol,
    doc,
    getDoc,
    updateDoc,
    deleteDoc,
    writeBatch,
    serverTimestamp,
    addDoc
};

// --- 3. Database Logic (Prefix: db) ---

async function dbFetchNickname(uid) {
    try {
        const userSnap = await getDoc(doc(db, "smokelyze_users", uid));
        return userSnap.exists() ? userSnap.data().nickname : null;
    } catch (e) {
        console.warn("dbFetchNickname failed:", e);
        return null;
    }
}

async function dbSaveMapPost(id, data) {
    if (id) {
        // Security: Author verification for updates
        const existing = state.MapPostData[id];
        if (existing && state.currentUser && existing.uid !== state.currentUser.uid) {
            throw new Error("Unauthorized update attempt");
        }
        const docRef = fb.doc(MapPostCol, id);
        return await fb.updateDoc(docRef, { ...data, timestamp: fb.serverTimestamp() });
    } else {
        const docRef = await fb.addDoc(MapPostCol, { ...data, createdAt: fb.serverTimestamp(), timestamp: fb.serverTimestamp() });
        if (data.type === "MapPost") {
            await fb.updateDoc(docRef, { rootId: docRef.id });
        }
        return docRef;
    }
}

async function dbDeleteMapPost(id) {
    const data = state.MapPostData[id];
    if (!data) return;

    // Security: Author verification
    if (!state.currentUser || data.uid !== state.currentUser.uid) {
        alert("Unauthorized: Only the author can delete this.");
        return;
    }

    const batch = fb.writeBatch(db);

    if (data.type === "MapPost") {
        // 1. Root MapPost Deletion: FULL RECURSIVE DELETE
        const itemsToProcess = [];
        const collectRecursive = (targetId) => {
            const targetData = state.MapPostData[targetId];
            if (!targetData) return;
            itemsToProcess.push({ id: targetId, data: targetData });
            Object.entries(state.MapPostData).forEach(([rid, rd]) => {
                if (rd.type === "reply") {
                    if (rd.parentId === targetId) collectRecursive(rid);
                    else if (targetData.type === "MapPost" && rd.rootId === targetId && !rd.parentId) collectRecursive(rid);
                }
            });
        };
        collectRecursive(id);
        itemsToProcess.forEach(item => {
            const deletedDocRef = fb.doc(db, "smokelyze_MapPost_deleted", item.id);
            batch.set(deletedDocRef, { ...item.data, deletedAt: fb.serverTimestamp(), originalDocId: item.id });
            batch.delete(fb.doc(MapPostCol, item.id));
        });
    } else {
        // 2. Reply Deletion: SOFT DELETE (Keep stub for thread context)
        const deletedArchiveRef = fb.doc(db, "smokelyze_MapPost_deleted", id);
        batch.set(deletedArchiveRef, { ...data, deletedAt: fb.serverTimestamp(), originalDocId: id });

        const liveDocRef = fb.doc(MapPostCol, id);
        batch.update(liveDocRef, {
            isDeleted: true,
            text: "This comment has been deleted.",
            timestamp: fb.serverTimestamp()
        });
    }

    return await batch.commit();
}

async function dbToggleLikeMapPost(id) {
    if (!state.currentUser) {
        utils.showAuthOverlay();
        return;
    }
    const data = state.MapPostData[id];
    if (!data) return;
    const isLiked = (data.likes || []).includes(state.currentUser.uid);
    const docRef = fb.doc(MapPostCol, id);
    try {
        if (isLiked) {
            await fb.updateDoc(docRef, { likes: fb.arrayRemove(state.currentUser.uid) });
        } else {
            await fb.updateDoc(docRef, { likes: fb.arrayUnion(state.currentUser.uid) });
        }
        const rootId = (data.type === "MapPost") ? id : data.rootId;
        renderMapPostDetail(rootId);
    } catch (err) { console.error("Like toggle failed:", err); }
}

// --- 4. Map Logic (Prefix: map) ---
function mapUpdateGeoJSON() {
    if (!map) return;
    const features = state.RecentIds
        .map(id => {
            const data = state.MapPostData[id];
            if (!data || data.type !== "MapPost" || !data.lon || !data.lat) return null;
            return {
                type: "Feature",
                geometry: { type: "Point", coordinates: [data.lon, data.lat] },
                properties: { ...data, docId: id }
            };
        })
        .filter(f => f !== null);

    const source = map.getSource("MapPost");
    if (source) {
        source.setData({ type: "FeatureCollection", features });
    }
}

// --- 5. UI Logic (Prefix: ui) ---
function renderLikeButton(id, likes, isSmall = false) {
    const likesArr = likes || [];
    const isLiked = state.currentUser && likesArr.includes(state.currentUser.uid);
    const count = likesArr.length;
    const size = isSmall ? 16 : 24;
    const iconSize = isSmall ? "1.6rem" : "2.4rem";
    const boxClass = isSmall ? "reply-like-btn" : "post-like-box";

    // Inline styles for small/big version
    const boxStyle = isSmall
        ? "background: none; border: none; padding: 0; margin-right: 1.5rem; display: flex; align-items: center; cursor: pointer; color: var(--text-soft);"
        : "text-align: center; cursor: pointer; min-width: 40px;";

    const svgFill = isLiked ? "#e74c3c" : "none";
    const svgStroke = isLiked ? "#e74c3c" : "currentColor";
    const svgStrokeWidth = isLiked ? "0" : "2";

    const svgHtml = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="${svgFill}" stroke="${svgStroke}" stroke-width="${svgStrokeWidth}"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;

    if (isSmall) {
        return `
            <button class="${boxClass}" data-id="${utils.ESML(id)}" style="${boxStyle}">
                <span style="display: flex; align-items: center; margin-right: 0.3rem;">${svgHtml}</span>
                <span style="font-size: 1.2rem;">${count}</span>
            </button>
        `;
    } else {
        return `
            <div class="${boxClass}" data-id="${utils.ESML(id)}" style="${boxStyle}">
                <div class="post-like-icon" style="font-size: ${iconSize}; line-height: 1;">${svgHtml}</div>
                <div class="post-like-count" style="font-size: 1.2rem; color: var(--text-soft);">${count}</div>
            </div>
        `;
    }
}

function uiShowModal(editData = null) {
    
    if (!state.currentUser) {
        utils.showAuthOverlay();
        return;
    }
    
    uiHideContextMenu();

    if (!editData && state.pendingLngLat) {
        if (state.previewMarker) state.previewMarker.remove();
        const el = document.createElement("div");
        el.className = "MapPost-pointer-preview";
        el.innerHTML = `<svg viewBox="0 0 24 24" width="40" height="40"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="#ff4d4d" stroke="white" stroke-width="1.5"/><circle cx="12" cy="10" r="3" fill="white"/></svg>`;
        state.previewMarker = new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat(state.pendingLngLat).addTo(map);
    }

    const modalOverlay = document.getElementById("MapPostModalOverlay");
    const titleText = document.getElementById("MapPostModalTitle");
    const submitBtn = document.getElementById("MapPostBtnSubmit");

    modalOverlay.style.display = "flex";
    document.getElementById("MapPostModalViewBody").style.display = "none";
    document.getElementById("MapPostModalEditBody").style.display = "flex";

    if (editData) {
        state.editingDocId = editData.id;
        document.getElementById("MapPostFormTitle").value = editData.title;
        document.getElementById("MapPostFormContent").value = editData.text;

        // Set Visibility Radio
        const viewers = editData.viewers || ["public"];
        let visValue = "public";
        if (!viewers.includes("public")) {
            visValue = viewers.length > 1 ? "group" : "private";
        }
        const radio = document.querySelector(`input[name="MapPostVisibility"][value="${visValue}"]`);
        if (radio) radio.checked = true;

        submitBtn.innerText = "Update";
        if (titleText) titleText.innerText = "Edit MapPost";
    } else {
        state.editingDocId = null;
        document.getElementById("MapPostFormTitle").value = "";
        document.getElementById("MapPostFormContent").value = "";

        // Default to Public
        const radio = document.querySelector(`input[name="MapPostVisibility"][value="public"]`);
        if (radio) radio.checked = true;

        submitBtn.innerText = "Submit";
        if (titleText) titleText.innerText = "New MapPost";
    }
    document.getElementById("MapPostFormTitle").focus();
}

function uiHideModal() {
    document.getElementById("MapPostModalOverlay").style.display = "none";
    state.viewingDocId = null;
    if (state.previewMarker) {
        state.previewMarker.remove();
        state.previewMarker = null;
    }
}

function uiShowContextMenu(x, y, lngLat) {
    const ctxMenu = document.getElementById("MapPostContextMenu");
    state.pendingLngLat = lngLat;
    ctxMenu.style.left = x + "px";
    ctxMenu.style.top = y + "px";
    ctxMenu.style.display = "block";
}

function uiHideContextMenu() {
    const ctxMenu = document.getElementById("MapPostContextMenu");
    if (ctxMenu) ctxMenu.style.display = "none";
}


// --- 6. Rendering Logic (Prefix: render) ---

function renderMapPostDetail(id) {
    const p = state.MapPostData[id];
    if (!p) return;

    state.viewingDocId = id;
    const viewBody = document.getElementById("MapPostModalViewBody");
    const isAuthor = state.currentUser && state.currentUser.uid === p.uid;
    const firstPosted = p.createdAt ? utils.formatDate(p.createdAt.toDate ? p.createdAt.toDate() : new Date(p.createdAt)) : "Just now";
    const updatedAt = p.timestamp ? utils.formatDate(p.timestamp.toDate ? p.timestamp.toDate() : new Date(p.timestamp)) : "Just now";

    const allReplies = Object.entries(state.MapPostData)
        .filter(([rid, rd]) => rd.type === "reply" && rd.rootId === id)
        .map(([rid, rd]) => ({ id: rid, ...rd }));

    const buildReplyTree = (pId) => {
        const isRoot = (pId === id);
        return allReplies
            .filter(r => (r.parentId === pId || (!r.parentId && isRoot)))
            .sort((a, b) => {
                const timeA = a.createdAt?.toDate?.() || a.createdAt || 0;
                const timeB = b.createdAt?.toDate?.() || b.createdAt || 0;
                return isRoot ? (timeB - timeA) : (timeA - timeB);
            });
    };

    const topLevelReplies = buildReplyTree(id);

    viewBody.innerHTML = `
                <div class="MapPost-modal-body" style="overflow-y: auto;">
                                        
                    ${isAuthor ? `
                        <div class="reply-btn-wrapper">
                            <button class="reply-btn-edit-detail" data-id="${utils.ESML(id)}">Edit</button>
                            <button class="reply-btn-delete-detail" data-id="${utils.ESML(id)}">Delete</button>
                        </div>
                    ` : ""}
                    
                    ${p.mapState ? `
                        <button class="MapPost-btn-restore" data-id="${utils.ESML(id)}">Get map condition (Date, Zoom, Layers)</button>
                    ` : ""}

                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem;">
                        <div style="flex: 1;">
                            <h2 style="margin: 0; font-size: 2.2rem; color: var(--card-shadow);">${utils.ESML(p.title || "No Title")}</h2>
                        </div>
                        <div style="display: flex; align-items: center; gap: 1.5rem;">
                            ${renderLikeButton(id, p.likes, false)}
                        </div>
                    </div>
                    
                    <div style="font-size: 1.4rem; color: var(--text-main); opacity: 0.7;">
                        Author: <strong>${utils.ESML(p.userName || "Anonymous")}</strong> | Target date: <strong>${utils.ESML(p.date)}</strong> 
                        ${p.dataSource ? ` | Dataset: <strong>${utils.ESML(p.dataSource)}</strong>` : ""}
                        <br>Posted: ${utils.ESML(firstPosted)} | Updated: ${utils.ESML(updatedAt)}
                    </div>
                    
                    <div class="cm-area-display">${utils.ESML(p.text)}</div>
                    <div class="reply-section">
                        <div class="reply-section-start">
                          Replies (${allReplies.length})
                          <button class="reply-btn-reply" data-id="${utils.ESML(id)}">Reply</button>
                        </div>
                        <div class="reply-text-container" id="ReplyTextContainer-${utils.ESML(id)}" style="display: none;">
                            <textarea class="reply-text-typing" placeholder="Write a reply..."></textarea>
                            <div class="reply-btn-wrapper-edit">
                                <button class="reply-btn-submit" data-root="${utils.ESML(id)}" data-parent="${utils.ESML(id)}">Submit</button>
                                <button class="reply-btn-cancel">Cancel</button>
                            </div>
                        </div>
                        ${topLevelReplies.map(r => renderReplyItem(r, allReplies, id)).join("")}
                    </div>
                </div>
            `;

    document.getElementById("MapPostModalOverlay").style.display = "flex";
    document.getElementById("MapPostModalEditBody").style.display = "none";
    viewBody.style.display = "block";
    
    // Update buttons using auth utility
    const restoreBtn = viewBody.querySelector(".MapPost-btn-restore");
    if (restoreBtn) updateAuthButton(restoreBtn, state.currentUser, "Get map condition (Date, Zoom, Layers)");

    viewBody.querySelectorAll(".reply-btn-reply").forEach(btn => {
        updateAuthButton(btn, state.currentUser, "Reply");
    });
    viewBody.querySelectorAll(".reply-btn-submit").forEach(btn => {
        updateAuthButton(btn, state.currentUser, "Submit");
    });
    
    const titleText = document.getElementById("MapPostModalTitle");
    if (titleText) titleText.textContent = "MapPost detail";
}

function renderReplyItem(r, allReplies, rootId) {
    const isAuthor = state.currentUser && state.currentUser.uid === r.uid;
    const isDeleted = r.isDeleted === true;
    const timeStr = r.timestamp?.toDate ? utils.formatDate(r.timestamp.toDate()) : "Just now";
    const safeId = utils.ESML(r.id);
    const children = allReplies
        .filter(child => child.parentId === r.id)
        .sort((a, b) => (a.createdAt?.toDate?.() || a.createdAt || 0) - (b.createdAt?.toDate?.() || b.createdAt || 0));

    return `
                <div class="reply-item" id="ReplyItem-${safeId}" style="${isDeleted ? "opacity: 0.6;" : ""}">
                    <div class="reply-item-header">
                        <div class="reply-item-author">
                            ${`Re: ${utils.ESML(r.userName || "Anonymous")}`} [${utils.ESML(timeStr)}]
                        </div>
                        ${renderLikeButton(r.id, r.likes, true)}
                    </div>
                    <div id="ReplyItemBody-${safeId}">
                        <div class="cm-area-display" style="${isDeleted ? "font-style: italic;" : ""}">
                            ${isDeleted ? "This comment has been deleted." : utils.ESML(r.text)}
                        </div>
                        ${!isDeleted ? `
                        <div class="cm-area-edit" style="display:none;">
                            <textarea class="cm-text-typing">${utils.ESML(r.text)}</textarea>
                        </div>
                        ` : ""}
                    </div>
                    
                    <div class="reply-btn-wrapper-view">
                        ${!isDeleted ? `<button class="reply-btn-reply" data-id="${safeId}">Reply</button>` : ""}
                        ${(isAuthor && !isDeleted) ? `
                        <button class="reply-btn-edit" data-id="${safeId}">Edit</button>
                        <button class="reply-btn-delete" data-id="${safeId}">Delete</button>
                        ` : ""}
                    </div>
                    ${(isAuthor && !isDeleted) ? `
                        <div class="reply-btn-wrapper-edit" style="display:none;">
                            <button class="reply-btn-submit-inline" data-id="${safeId}">Submit</button>
                            <button class="reply-btn-cancel-inline" data-id="${safeId}">Cancel</button>
                        </div>
                    ` : ""} 
                        
                    ${!isDeleted ? `
                    <div class="reply-text-container" id="ReplyTextContainer-${safeId}" style="display:none;">
                        <textarea class="reply-text-typing" placeholder="Write a reply..."></textarea>
                        <div class="reply-btn-wrapper">
                            <button class="reply-btn-submit" data-root="${utils.ESML(rootId)}" data-parent="${safeId}">Submit</button>
                            <button class="reply-btn-cancel">Cancel</button>
                        </div>
                    </div>
                    ` : ""}

                    <div class="reply-nested-container" style="margin-left: 2rem;">
                        ${children.map(child => renderReplyItem(child, allReplies, rootId)).join("")}
                    </div>
                </div>
            `;
}

function renderMapPostList() {
    const listContainer = document.getElementById("MapPostDrawerList");
    const titleEl = document.getElementById("MapPostDrawerTitle");
    const toggleBtn = document.getElementById("MapPostToggle");
    if (!listContainer || !titleEl) return;

    // Use the globally fetched RecentIds
    const recentPosts = state.RecentIds
        .map(id => ({ id, ...state.MapPostData[id] }))
        .filter(p => p.type === "MapPost");

    const totalCount = recentPosts.length;
    titleEl.textContent = `Recent MapPosts (${totalCount})`;

    if (toggleBtn) {
        toggleBtn.innerHTML = `
                    <canvas class="ui-pulsing-icon" data-type="alert" width="35" height="35" style="margin-bottom:0.4rem;"></canvas>
                    <br>(${totalCount})
                `;
        if (initUIPulsingIcons) initUIPulsingIcons();
    }

    let html = `
                <button class="MapPost-item-link clickOnAddFromDrawer" style="width: max-content; margin: 0 auto; display: block;">
                     +MapPost
                </button>
                <div style="font-size: 1.4rem; color: var(--text-strong);">
                    The 20 most recent posts are displayed.
                <hr class="MapPost-item-hr">
                </div>
            `;

    if (totalCount === 0) {
        html += '<div style="padding: 3rem; text-align: center; color: var(--text-main); font-size: 1.6rem;">No MapPosts found yet.</div>';
    } else {
        recentPosts.forEach(c => {
            const summary = c.text.length > 50 ? c.text.substring(0, 50) + "..." : c.text;
            const repliesCount = Object.values(state.MapPostData).filter(rd => rd.type === "reply" && rd.rootId === c.id).length;
            const createdVal = c.createdAt;
            const firstPosted = createdVal ? utils.formatDate(typeof createdVal.toDate === "function" ? createdVal.toDate() : new Date(createdVal)) : "Just now";

            html += `
                        <div class="MapPost-item clickOnShowDetail" style="cursor: pointer;" data-id="${c.id}">
                            <div class="MapPost-item-title" style="font-size: 1.5rem;">${utils.ESML(c.title || "No Title")}</div>
                            <div class="MapPost-item-meta" style="font-size: 1.2rem;">
                                Author: ${utils.ESML(c.userName || "Anonymous")} | Target date: ${utils.ESML(c.date)} 
                                ${c.dataSource ? `<br>Dataset: ${utils.ESML(c.dataSource)}` : ""}
                                <br>Posted: ${utils.ESML(firstPosted)}
                            </div>
                            <hr class="MapPost-item-hr">
                            <div style="display: flex; justify-content: flex-end; align-items: center; gap: 1rem; margin-top: 1rem;">
                                <div style="display: flex; align-items: center; gap: 1rem; color: var(--text-main); font-size: 1.4rem; font-weight: bold;">
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
                                    <span>${repliesCount}</span>
                                    <button class="MapPost-item-link clickOnLocation" data-id="${c.id}" data-lon="${c.lon}" data-lat="${c.lat}">Location</button>
                                    <button class="MapPost-item-link" style="margin-left: 0.4rem;">Read</button>
                                </div>
                            </div>
                        </div>
                    `;
        });
    }
    
    listContainer.innerHTML = html;
    
    // Update Add button using auth utility
    const addBtn = listContainer.querySelector(".clickOnAddFromDrawer");
    if (addBtn) updateAuthButton(addBtn, state.currentUser, "+MapPost");
}

// --- 7. Event Handling (Prefix: clickOn) ---

async function clickOnSubmitMain() {
    const titleInput = document.getElementById("MapPostFormTitle");
    const contentInput = document.getElementById("MapPostFormContent");

    const title = titleInput.value.trim();
    const text = contentInput.value.trim();
    const date = document.getElementById("datePicker").value;
    let dataSource = document.getElementById("MapDataSelect")?.value || "";

    const publishedLayers = document.querySelectorAll("#MapCheckboxPublished input[type='checkbox']");
    const anyPublishedChecked = Array.from(publishedLayers).some(cb => cb.checked);
    if (!anyPublishedChecked) {
        dataSource = "";
    }

    if (!title || !text) return alert("Please enter both title and content.");

    // Read Visibility
    const visRadio = document.querySelector('input[name="MapPostVisibility"]:checked');
    const visibility = visRadio ? visRadio.value : "public";

    const submitBtn = document.getElementById("MapPostBtnSubmit");
    submitBtn.disabled = true;
    submitBtn.innerText = "Processing...";

    try {
        if (!state.currentUser) throw new Error("Null User");

        let userName = state.currentUser.displayName;
        const nickname = await dbFetchNickname(state.currentUser.uid);
        if (nickname) userName = nickname;

        // Determine Viewers Array based on Visibility
        let viewers = ["public"];
        if (visibility === "private") {
            viewers = [state.currentUser.uid];
        } else if (visibility === "group") {
            // Fetch my group
            const userSnap = await getDoc(doc(db, "smokelyze_users", state.currentUser.uid));
            const mygroup = userSnap.exists() ? (userSnap.data().mygroup || []) : [];
            // Extract UIDs and include self
            const groupUids = mygroup.map(m => m.uid).filter(u => u);
            viewers = [state.currentUser.uid, ...groupUids];
        }

        if (state.editingDocId) {
            const original = state.MapPostData[state.editingDocId];
            const isReply = original?.type === "reply";
            const updateData = { title: isReply ? "" : title, text };

            if (!isReply) {
                const newViewers = viewers;
                const oldViewers = original.viewers || [];
                const visibilityChanged = JSON.stringify(newViewers) !== JSON.stringify(oldViewers);

                if (visibilityChanged) {
                    // BATCH UPDATE: Update post and ALL its replies
                    const batch = writeBatch(db);
                    const docRef = doc(MapPostCol, state.editingDocId);
                    batch.update(docRef, { ...updateData, viewers: newViewers, timestamp: serverTimestamp() });

                    // Find and update all associated replies in the global cache
                    Object.entries(state.MapPostData).forEach(([rid, rd]) => {
                        if (rd.type === "reply" && rd.rootId === state.editingDocId) {
                            batch.update(doc(MapPostCol, rid), { viewers: newViewers, timestamp: serverTimestamp() });
                        }
                    });
                    await batch.commit();
                } else {
                    await dbSaveMapPost(state.editingDocId, updateData);
                }
            } else {
                await dbSaveMapPost(state.editingDocId, updateData);
            }
            renderMapPostDetail(isReply ? original.rootId : state.editingDocId);
        } else {
            if (!state.pendingLngLat) throw new Error("No location selected");

            // Get map state
            const activeLayers = Array.from(document.querySelectorAll("input[type=checkbox][id^='layer-']"))
                .filter(cb => cb.checked || cb.id === "layer-MapPost")
                .map(cb => cb.id);

            const center = map.getCenter();
            const currentMapState = {
                zoom: map.getZoom(),
                center: { lng: center.lng, lat: center.lat },
                layers: activeLayers,
                date: date,
                dataSource: dataSource
            };

            const docData = {
                title, text, type: "MapPost", date,
                lon: state.pendingLngLat.lng, lat: state.pendingLngLat.lat,
                uid: state.currentUser.uid, userName: userName || "Anonymous",
                mapState: currentMapState,
                dataSource: dataSource,
                viewers: viewers
            };

            const docRef = await dbSaveMapPost(null, docData);

            // Auto-check MapPost checkbox if not already checked
            const layerCb = document.getElementById("layer-MapPost");
            if (layerCb && !layerCb.checked) {
                layerCb.checked = true;
                layerCb.dispatchEvent(new Event("change"));
            }

            state.viewingDocId = docRef.id;
            document.getElementById("MapPostModalTitle").innerText = "MapPost Detail";
            document.getElementById("MapPostModalEditBody").style.display = "none";
            document.getElementById("MapPostModalViewBody").style.display = "block";
            renderMapPostDetail(docRef.id);
        }
    } catch (err) {
        console.error("Save failed details:", err);
        alert("Failed to process MapPost: " + err.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = state.editingDocId ? "Update" : "Submit";
    }
}

async function clickOnDelete(id) {
    if (!confirm("Are you sure you want to delete this?")) return;
    try {
        await dbDeleteMapPost(id);
        if (state.viewingDocId === id) uiHideModal();
    } catch (err) {
        console.error("Delete failed:", err);
        alert("Delete failed.");
    }
}

function handleMapPostModeToggle(force) {
    state.isMapPostMode = (force !== undefined) ? force : !state.isMapPostMode;
    const mapEl = document.getElementById("map");
    if (state.isMapPostMode) {
        mapEl.classList.add("MapPost-mode-cursor");
        if (showErrorToast) showErrorToast("MapPost Mode: Click on the map to add a MapPost.", "info");
    } else {
        mapEl.classList.remove("MapPost-mode-cursor");
    }
}

// --- 8. Listeners Binding ---

map.on("click", (e) => {

    if (state.isMapPostMode) {
        state.pendingLngLat = e.lngLat;
        uiShowModal();
        handleMapPostModeToggle(false);
    }
    uiHideContextMenu();
});

map.on("contextmenu", (e) => {
    e.preventDefault();
    uiShowContextMenu(e.originalEvent.clientX, e.originalEvent.clientY, e.lngLat);
});

document.body.addEventListener("click", async (e) => {
    const target = e.target;

    // List actions
    if (target.closest(".clickOnLocation")) {
        const b = target.closest(".clickOnLocation");
        utils.highlightLocation([parseFloat(b.dataset.lon), parseFloat(b.dataset.lat)], { ...state.MapPostData[b.dataset.id], docId: b.dataset.id }, "MapPost");
        return;
    }
    if (target.closest(".clickOnAddFromDrawer")) {

        if (!state.currentUser) {
            utils.showAuthOverlay();
            return;
        }

        if (window.innerWidth <= 1024 && setMapPostDrawer) setMapPostDrawer(false);
        handleMapPostModeToggle(true);
        return;
    }
    if (target.closest(".clickOnShowDetail")) {
        if (target.closest(".clickOnLocation")) return;
        renderMapPostDetail(target.closest(".clickOnShowDetail").dataset.id);
        return;
    }

    // Modal Main actions
    if (target.closest(".reply-btn-edit-detail")) {
        const id = target.closest(".reply-btn-edit-detail").dataset.id;
        const data = state.MapPostData[id];
        if (data) uiShowModal({ id, ...data });
        return;
    }
    if (target.closest(".reply-btn-delete-detail")) return clickOnDelete(target.closest(".reply-btn-delete-detail").dataset.id);

    // Like actions
    if (target.closest(".post-like-box")) {
        const id = target.closest(".post-like-box").dataset.id;
        return dbToggleLikeMapPost(id);
    }
    if (target.closest(".reply-like-btn")) {
        const id = target.closest(".reply-like-btn").dataset.id;
        return dbToggleLikeMapPost(id);
    }

    // Reply UI actions
    if (target.closest(".reply-btn-reply")) {
        if (!state.currentUser) {
            utils.showAuthOverlay();
            return;
        }
        const id = target.closest(".reply-btn-reply").dataset.id;
        const container = document.getElementById(`ReplyTextContainer-${id}`);
        if (container) {
            container.style.display = "block";
            const ta = container.querySelector("textarea");
            if (ta) ta.focus();
            target.closest(".reply-btn-reply").style.display = "none";
        }
        return;
    }
    if (target.closest(".reply-btn-cancel")) {
        const container = target.closest(".reply-text-container");
        container.style.display = "none";
        const rootId = container.id.replace("ReplyTextContainer-", "");
        const openBtn = document.querySelector(`.reply-btn-reply[data-id="${rootId}"]`);
        if (openBtn) openBtn.style.display = "block";
        return;
    }
    if (target.closest(".reply-btn-submit")) {
        if (!state.currentUser) {
            utils.showAuthOverlay();
            return;
        }
        const btn = target.closest(".reply-btn-submit");
        const rootId = btn.dataset.root;
        const parentId = btn.dataset.parent;
        const container = document.getElementById(`ReplyTextContainer-${parentId}`);
        if (!container) return;
        const textarea = container.querySelector("textarea");
        if (!textarea) return;
        const text = textarea.value.trim();
        if (!text) return alert("Enter a reply.");

        btn.disabled = true; btn.innerText = "...";
        try {
            let userName = state.currentUser.displayName;
            const nickname = await dbFetchNickname(state.currentUser.uid);
            if (nickname) userName = nickname;
            const rootMapPost = state.MapPostData[rootId];
            // IMPORTANT: Reply must have the same viewers as parent to be accessible under security rules
            const viewers = (rootMapPost && rootMapPost.viewers) ? rootMapPost.viewers : ["public"];

            await dbSaveMapPost(null, {
                title: "", text, type: "reply", rootId, parentId,
                date: rootMapPost ? rootMapPost.date : "",
                lon: rootMapPost ? rootMapPost.lon : 0,
                lat: rootMapPost ? rootMapPost.lat : 0,
                uid: state.currentUser.uid,
                userName: userName || "Anonymous",
                viewers
            });
        } catch (err) { alert("Reply failed."); }
        finally { btn.disabled = false; btn.innerText = "Submit"; }
        return;
    }

    // Inline Reply actions
    if (target.closest(".reply-btn-edit")) {
        const rid = target.closest(".reply-btn-edit").dataset.id;
        const body = document.getElementById(`ReplyItemBody-${rid}`);
        if (body) {
            const display = body.querySelector(".cm-area-display");
            const edit = body.querySelector(".cm-area-edit");
            if (display) display.style.display = "none";
            if (edit) edit.style.display = "block";
        }
        const item = document.getElementById(`ReplyItem-${rid}`);
        if (item) {
            const viewWrapper = item.querySelector(".reply-btn-wrapper-view");
            if (viewWrapper) viewWrapper.style.display = "none";
            const editWrapper = item.querySelector(".reply-btn-wrapper-edit");
            if (editWrapper) editWrapper.style.display = "flex";
        }
        return;
    }
    if (target.closest(".reply-btn-cancel-inline")) {
        const rid = target.closest(".reply-btn-cancel-inline").dataset.id;
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
        return;
    }
    if (target.closest(".reply-btn-submit-inline")) {
        const rid = target.closest(".reply-btn-submit-inline").dataset.id;
        const body = document.getElementById(`ReplyItemBody-${rid}`);
        if (!body) return;
        const textarea = body.querySelector(".cm-text-typing");
        if (!textarea) return;
        const text = textarea.value.trim();
        if (!text) return alert("Text cannot be empty.");
        target.closest(".reply-btn-submit-inline").disabled = true;
        try { await dbSaveMapPost(rid, { text }); }
        catch (err) { alert("Update failed."); }
        finally { target.closest(".reply-btn-submit-inline").disabled = false; }
        return;
    }
    if (target.closest(".reply-btn-delete")) {
        return clickOnDelete(target.closest(".reply-btn-delete").dataset.id);
    }

    // Restore Map Condition
    if (target.closest(".MapPost-btn-restore")) {
        if (!state.currentUser) {
            utils.showAuthOverlay();
            return;
        }
        const rid = target.closest(".MapPost-btn-restore").dataset.id;
        const data = state.MapPostData[rid];
        if (data && data.mapState) {
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
                    layersChanged = true; // Changing data source means layers need re-evaluation
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

            if (showErrorToast) showErrorToast("Map condition restored!", "info");

            if (window.innerWidth <= 1024 && typeof setMapPostDrawer === "function") {
                setMapPostDrawer(false);
            }

            // Close the modal to show the map immediately
            uiHideModal();
        }
    }
});

// Fixed element listeners
const writeBtn = document.getElementById("MapPostBtnWrite");
if (writeBtn) writeBtn.addEventListener("click", () => uiShowModal());

const closeCtxBtn = document.getElementById("MapPostBtnClose");
if (closeCtxBtn) closeCtxBtn.addEventListener("click", uiHideContextMenu);

const submitMainBtn = document.getElementById("MapPostBtnSubmit");
if (submitMainBtn) submitMainBtn.addEventListener("click", (e) => { e.preventDefault(); clickOnSubmitMain(); });

const cancelMainBtn = document.getElementById("MapPostBtnCancel");
if (cancelMainBtn) cancelMainBtn.addEventListener("click", () => state.editingDocId ? renderMapPostDetail(state.editingDocId) : uiHideModal());

const closeModalBtn = document.getElementById("MapPostModalClose");
if (closeModalBtn) closeModalBtn.addEventListener("click", uiHideModal);

const overlay = document.getElementById("MapPostModalOverlay");
// 창 밖에 마우스 클릭시 자동으로 닫히는 기능 (비활성화)
// if (overlay) overlay.addEventListener("click", (e) => { if (e.target.id === "MapPostModalOverlay") uiHideModal(); });


// --- 9. Firestore Snapshot ---
function startRecentPostsListener() {
    if (state.unsubscribeRecent) state.unsubscribeRecent();

    // Core Logic: Server-side filtering
    const viewerFilter = ["public"];
    if (state.currentUser) viewerFilter.push(state.currentUser.uid);

    const q = query(MapPostCol,
        where("type", "==", "MapPost"),
        where("viewers", "array-contains-any", viewerFilter),
        orderBy("createdAt", "desc"),
        limit(20)
    );

    state.unsubscribeRecent = onSnapshot(q, (snapshot) => {
        const ids = [];
        snapshot.forEach(doc => {
            const id = doc.id;
            const data = doc.data();
            if (data.userEmail) delete data.userEmail;
            state.MapPostData[id] = data; // Cache it
            ids.push(id);
        });

        state.RecentIds = ids;
        mapUpdateGeoJSON();

        // Also fetch all replies for these specific top 20 MapPosts
        if (state.unsubscribeRecentReplies) state.unsubscribeRecentReplies();
        if (ids.length > 0) {
            // Security: Added viewers filter to match rules and avoid Permission Denied
            const rq = query(MapPostCol,
                where("type", "==", "reply"),
                where("rootId", "in", ids),
                where("viewers", "array-contains-any", viewerFilter)
            );
            state.unsubscribeRecentReplies = onSnapshot(rq, (replySnap) => {
                replySnap.docChanges().forEach(change => {
                    const rid = change.doc.id;
                    const rdata = change.doc.data();
                    if (change.type === "removed") {
                        delete state.MapPostData[rid];
                    } else {
                        if (rdata.userEmail) delete rdata.userEmail;
                        state.MapPostData[rid] = rdata;
                    }
                });
                renderMapPostList();
                if (state.viewingDocId) renderMapPostDetail(state.viewingDocId);
            });
        } else {
            renderMapPostList();
        }
    });
}


// --- 10. External Auth & Date Interaction ---

// --- 11. Final Initialization ---
state.currentUser = auth.currentUser;
onAuthStateChanged(auth, (user) => {
    const oldUid = state.currentUser ? state.currentUser.uid : null;
    state.currentUser = user;
    const newUid = user ? user.uid : null;

    // Re-render to update edit/delete button visibility
    renderMapPostList();
    if (state.viewingDocId) renderMapPostDetail(state.viewingDocId);
    
    // Update global write/submit buttons
    updateAuthButton("MapPostBtnWrite", user, "Write");
    updateAuthButton("MapPostBtnSubmit", user, state.editingDocId ? "Update" : "Submit");
    
    // Important: Re-start listener if user changed (login/logout) 
    if (oldUid !== newUid) {
        startRecentPostsListener();
    }
});

startRecentPostsListener();

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startRecentPostsListener);
else startRecentPostsListener();

export {
    renderMapPostDetail as showMapPostDetail,
    renderMapPostList as updateMapPostList,
    handleMapPostModeToggle
};

