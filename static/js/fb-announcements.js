
import * as fb from "./fb-init.js";
import * as utils from "./utils.js";

// --- 1. Global State ---
const state = {
    currentUser: null,
    isAdmin: false,
    isEmailMode: false,
    editingDocId: null,
    viewingDocId: null,
    AnnouncementData: {},
    RecentIds: [],
    // Pagination state
    currentPage: 1,
    pageSize: 5,
    firstDoc: null,
    lastDoc: null,
    hasNext: false,
    isFirstPage: true,
    totalCount: 0,

    // Optimization: Cache and loading state
    pageCache: {},
    isLoading: false
};

const {
    collection, addDoc, query, orderBy, limit, limitToLast,
    startAfter, endBefore, getDocs, getCountFromServer,
    serverTimestamp, doc, getDoc, updateDoc, deleteDoc
} = fb;

const db = fb.db;
const auth = fb.auth;
const AnnouncementCol = collection(db, "smokelyze_announcements");

// --- 3. Database Logic ---
async function dbFetchNickname(uid) {
    try {
        const userSnap = await getDoc(doc(db, "smokelyze_users", uid));
        return userSnap.exists() ? userSnap.data().nickname : null;
    } catch (e) {
        console.warn("dbFetchNickname failed:", e);
        return null;
    }
}

async function dbSaveAnnouncement(id, data) {
    if (id) {
        if (!state.isAdmin) throw new Error("Unauthorized update attempt");
        const docRef = doc(AnnouncementCol, id);
        return await updateDoc(docRef, { ...data, timestamp: serverTimestamp() });
    } else {
        if (!state.isAdmin) throw new Error("Unauthorized post attempt");
        const docRef = await addDoc(AnnouncementCol, {
            ...data,
            createdAt: serverTimestamp(),
            timestamp: serverTimestamp()
        });
        return docRef;
    }
}

async function dbDeleteAnnouncement(id) {
    if (!state.isAdmin) {
        alert("Unauthorized: Only developers can delete announcements.");
        return;
    }
    if (!confirm("Are you sure you want to delete this announcement?")) return;

    try {
        await deleteDoc(doc(AnnouncementCol, id));
        if (state.viewingDocId === id) uiHideModal();
        loadPage(0);
    } catch (err) {
        console.error("Delete failed:", err);
        alert("Delete failed.");
    }
}

// --- 4. UI Logic ---
function uiShowModal(mode = "new", editData = null) {
    if (!state.isAdmin) {
        alert("Only developers can write announcements.");
        return;
    }

    const modalOverlay = document.getElementById("BoardModalOverlay");
    const titleText = document.getElementById("BoardModalTitle");
    const submitBtn = document.getElementById("BoardBtnSubmit");
    const formTitleLabel = document.querySelector("label[for='BoardFormTitle']");
    const formContentLabel = document.querySelector("label[for='BoardFormContent']");
    const testBtn = document.getElementById("BoardBtnTest");

    state.isEmailMode = (mode === "email");
    modalOverlay.style.display = "flex";
    if (testBtn) testBtn.style.display = state.isEmailMode ? "block" : "none";
    document.getElementById("BoardModalViewBody").style.display = "none";
    document.getElementById("BoardModalEditBody").style.display = "flex";

    if (state.isEmailMode) {
        state.editingDocId = null;
        document.getElementById("BoardFormTitle").value = "";
        document.getElementById("BoardFormContent").value = "";
        submitBtn.innerText = "Send Email";
        if (titleText) titleText.innerText = "Bulk Email Announcement";
        if (formTitleLabel) formTitleLabel.innerHTML = 'Email Subject <small id="BoardTitleCounter" style="float: right;">0/100</small>';
        if (formContentLabel) formContentLabel.innerHTML = 'Email Message <small id="BoardContentCounter" style="float: right;">0/2000</small>';
    } else if (editData) {
        state.editingDocId = editData.id;
        document.getElementById("BoardFormTitle").value = editData.title;
        document.getElementById("BoardFormContent").value = editData.text;
        submitBtn.innerText = "Update";
        if (titleText) titleText.innerText = "Edit Announcement";
        if (formTitleLabel) formTitleLabel.innerHTML = 'Title <small id="BoardTitleCounter" style="float: right;">0/100</small>';
        if (formContentLabel) formContentLabel.innerHTML = 'Content <small id="BoardContentCounter" style="float: right;">0/2000</small>';
    } else {
        state.editingDocId = null;
        document.getElementById("BoardFormTitle").value = "";
        document.getElementById("BoardFormContent").value = "";
        submitBtn.innerText = "Submit";
        if (titleText) titleText.innerText = "New Announcement";
        if (formTitleLabel) formTitleLabel.innerHTML = 'Title <small id="BoardTitleCounter" style="float: right;">0/100</small>';
        if (formContentLabel) formContentLabel.innerHTML = 'Content <small id="BoardContentCounter" style="float: right;">0/2000</small>';
    }
    document.getElementById("BoardFormTitle").focus();
    updateCounter("BoardFormTitle", "BoardTitleCounter", 100);
    updateCounter("BoardFormContent", "BoardContentCounter", 2000);
}

function uiHideModal() {
    document.getElementById("BoardModalOverlay").style.display = "none";
    state.viewingDocId = null;
    state.editingDocId = null;
}

function updateCounter(inputId, counterId, max) {
    const input = document.getElementById(inputId);
    const counter = document.getElementById(counterId);
    if (input && counter) {
        const len = input.value.length;
        counter.textContent = `${len}/${max}`;
        counter.style.color = len > max ? "var(--btn-minus)" : "var(--text-main)";
    }
}

// --- 5. Rendering Logic ---
function renderAnnouncementList() {
    const listContainer = document.getElementById("BoardList");
    if (!listContainer) return;

    const announcements = state.RecentIds.map(id => ({ id, ...state.AnnouncementData[id] }));
    const pageInfo = document.getElementById("BoardPageInfo");
    const paginationContainer = document.getElementById("BoardPagination");
    const prevBtn = document.getElementById("BoardBtnPrev");
    const nextBtn = document.getElementById("BoardBtnNext");

    if (pageInfo) {
        const totalPages = Math.ceil(state.totalCount / state.pageSize) || 1;
        pageInfo.textContent = `Page ${state.currentPage} of ${totalPages}`;
        pageInfo.style.visibility = "visible";
    }

    if (announcements.length === 0) {
        listContainer.innerHTML = '<div class="board-loading">No announcements found yet.</div>';
        if (paginationContainer) paginationContainer.style.display = "flex";
        return;
    }

    let html = "";
    announcements.forEach(a => {
        const createdVal = a.createdAt;
        const dateStr = createdVal ? utils.formatDate(createdVal.toDate ? createdVal.toDate() : new Date(createdVal)) : "Just now";
        html += `
            <div class="board-post-card" data-id="${a.id}" style="cursor: pointer;">
                <div class="board-post-title">${utils.ESML(a.title)}</div>
                <div class="board-post-meta">Posted: ${utils.ESML(dateStr)}</div>
            </div>
        `;
    });
    listContainer.innerHTML = html;

    if (paginationContainer) paginationContainer.style.display = "flex";
    if (prevBtn) prevBtn.style.visibility = state.currentPage > 1 ? "visible" : "hidden";
    if (nextBtn) nextBtn.style.visibility = state.hasNext ? "visible" : "hidden";
}

function renderAnnouncementDetail(id) {
    const a = state.AnnouncementData[id];
    if (!a) return;

    state.viewingDocId = id;
    const viewBody = document.getElementById("BoardModalViewBody");
    const createdDate = a.createdAt ? utils.formatDate(a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt)) : "Just now";
    const updatedDate = a.timestamp ? utils.formatDate(a.timestamp.toDate ? a.timestamp.toDate() : new Date(a.timestamp)) : "Just now";

    viewBody.innerHTML = `
        <div class="MapPost-modal-body" style="overflow-y: auto;">
            <div style="margin-bottom: 2rem;">
                <h2 style="margin: 0; font-size: 2.4rem; color: var(--card-shadow);">${utils.ESML(a.title)}</h2>
                <div style="font-size: 1.4rem; color: var(--text-main); opacity: 0.7; margin-top: 0.5rem;">
                    Posted: ${utils.ESML(createdDate)} | Updated: ${utils.ESML(updatedDate)}
                </div>
            </div>
            <div class="cm-area-display" style="white-space: pre-wrap; margin-bottom: 3rem;">${utils.ESML(a.text)}</div>
            
            ${state.isAdmin ? `
                <div class="reply-btn-wrapper" style="border-top: 0.1rem solid var(--border-color); padding-top: 2rem;">
                    <button class="reply-btn-edit-detail" data-id="${id}">Edit</button>
                    <button class="reply-btn-delete-detail" data-id="${id}">Delete</button>
                </div>
            ` : ""}
        </div>
    `;

    document.getElementById("BoardModalOverlay").style.display = "flex";
    document.getElementById("BoardModalEditBody").style.display = "none";
    viewBody.style.display = "block";

    const titleText = document.getElementById("BoardModalTitle");
    if (titleText) titleText.textContent = "Announcement Detail";
}

// --- 6. Event Listeners ---
async function clickOnSubmit() {
    const titleInput = document.getElementById("BoardFormTitle");
    const contentInput = document.getElementById("BoardFormContent");
    const title = titleInput.value.trim();
    const text = contentInput.value;

    if (!title || !text.trim()) return alert("Please enter both title and content.");

    const submitBtn = document.getElementById("BoardBtnSubmit");
    submitBtn.disabled = true;
    submitBtn.innerText = "Processing...";

    try {
        const nickname = await dbFetchNickname(state.currentUser.uid);
        const docData = {
            title,
            text,
            uid: state.currentUser.uid,
            userName: nickname || state.currentUser.displayName || "Developer"
        };

        if (state.editingDocId) await dbSaveAnnouncement(state.editingDocId, docData);
        else await dbSaveAnnouncement(null, docData);
        
        uiHideModal();
        await fetchTotalCount();
        if (!state.editingDocId) loadPage(0, true);
        else loadPage(0);
    } catch (err) {
        console.error("Save failed:", err);
        alert("Failed to process Announcement: " + err.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = state.editingDocId ? "Update" : "Submit";
    }
}

// --- 8. Email Utilities ---
function wrapEmailTemplate(subject, bodyText) {
    const formattedBody = bodyText.replace(/\n/g, "<br>");
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #444444; margin: 0; padding: 0; background-color: #f8f9fa; }
            .container { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1); border: 1px solid #eef2f5; }
            .header { background-color: #2c3e50; padding: 40px 30px; text-align: center; color: #ffffff; }
            .header h1 { font-size: 24px; margin: 0; font-weight: 300; letter-spacing: 8px; color: #ffffff; text-transform: uppercase; }
            .header p { font-size: 13px; margin: 8px 0 0; color: #bdc3c7; letter-spacing: 2px; }
            .content { padding: 50px 40px; }
            .content h2 { font-size: 22px; color: #2c3e50; margin-top: 0; border-bottom: 2px solid #f1f3f5; padding-bottom: 20px; font-weight: 600; }
            .formatted-body { font-size: 16px; color: #555555; line-height: 1.8; margin-top: 25px; }
            .footer { background-color: #f8f9fa; padding: 25px; text-align: center; font-size: 11px; color: #95a5a6; border-top: 1px solid #f1f3f5; }
            .footer p { margin: 6px 0; }
            .btn { display: inline-block; padding: 14px 32px; background-color: #3498db; color: #ffffff !important; text-decoration: none; border-radius: 6px; margin-top: 30px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 10px rgba(52, 152, 219, 0.3); }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>SMOKELYZE</h1>
                <p>Advanced Spatiotemporal Analytics for Wildfire Smoke & Air Quality</p>
            </div>
            <div class="content">
                <div class="formatted-body">
                    ${formattedBody}
                </div>
                <div style="text-align: center;">
                    <a href="https://smokelyze.org/" class="btn">Visit Smokelyze</a>
                </div>
            </div>
            <div class="footer">
                <p>© 2026 Smokelyze Project. All rights reserved.</p>
                <p>This is an official announcement from the Smokelyze Team.</p>
                <p><a href="https://smokelyze.org/" style="color: #3498db; text-decoration: none;">smokelyze.netlify.app</a></p>
            </div>
        </div>
    </body>
    </html>
    `;
}

async function sendBulkEmail() {
    const subject = document.getElementById("BoardFormTitle").value.trim();
    const bodyText = document.getElementById("BoardFormContent").value;
    if (!subject || !bodyText.trim()) return alert("Please enter subject and message.");
    if (!confirm("Are you sure you want to send this bulk email to ALL registered users?")) return;

    const submitBtn = document.getElementById("BoardBtnSubmit");
    submitBtn.disabled = true;
    submitBtn.innerText = "Sending via Go Engine...";

    try {
        const idToken = await auth.currentUser.getIdToken();
        const finalSubject = "[Smokelyze] " + subject;
        const htmlBody = wrapEmailTemplate(finalSubject, bodyText);

        // 4. Call Go API - backend will now fetch recipients itself for bulk mode
        const response = await fetch("/api/email/send_bulk_email", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${idToken}`
            },
            body: JSON.stringify({
                subject: finalSubject,
                body: htmlBody,
                isBulk: true // Signal the backend to fetch all users
            })
        });

        const result = await response.json();
        if (result.status === "success") {
            alert(`Bulk email sent successfully to ${result.sent} users via Go Engine!`);
            uiHideModal();
        } else throw new Error(result.message || "Go Engine Error.");
    } catch (err) {
        console.error("Bulk email failed:", err);
        alert("Failed to send bulk email: " + err.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = "Send Email";
    }
}

async function sendTestEmail() {
    const subject = document.getElementById("BoardFormTitle").value.trim();
    const bodyText = document.getElementById("BoardFormContent").value;
    if (!subject || !bodyText.trim()) return alert("Please enter subject and message.");

    const email = state.currentUser?.email;
    if (!email) return alert("Error: User email not found. Are you logged in?");

    const testBtn = document.getElementById("BoardBtnTest");
    testBtn.disabled = true;
    testBtn.innerText = "Sending Test...";

    try {
        const finalSubject = "[Smokelyze] " + subject;
        const htmlBody = wrapEmailTemplate(finalSubject, bodyText);
        const idToken = await auth.currentUser.getIdToken();

        const response = await fetch("/api/email/send_bulk_email", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${idToken}`
            },
            body: JSON.stringify({ subject: finalSubject, body: htmlBody, recipients: [email] })
        });

        const result = await response.json();
        if (result.status === "success") alert(`✅ Test email sent to: ${email} via Go Engine!`);
        else throw new Error(result.message || "Go Engine Error.");
    } catch (err) {
        console.error("Test email failed:", err);
        alert("❌ Failed to send test email: " + err.message);
    } finally {
        testBtn.disabled = false;
        testBtn.innerText = "Send Test to Self";
    }
}

function bindEventsAnnouncements() {
    const writeBtn = document.getElementById("BoardBtnWrite");
    if (writeBtn) writeBtn.addEventListener("click", () => uiShowModal("new"));

    const emailBtn = document.getElementById("BoardBtnEmail");
    if (emailBtn) emailBtn.addEventListener("click", () => uiShowModal("email"));

    const testBtn = document.getElementById("BoardBtnTest");
    if (testBtn) testBtn.onclick = () => sendTestEmail();

    const closeModalBtn = document.getElementById("BoardModalClose");
    if (closeModalBtn) closeModalBtn.addEventListener("click", uiHideModal);

    const cancelBtn = document.getElementById("BoardBtnCancel");
    if (cancelBtn) cancelBtn.addEventListener("click", () => uiHideModal());

    const submitBtn = document.getElementById("BoardBtnSubmit");
    if (submitBtn) submitBtn.addEventListener("click", (e) => {
        e.preventDefault();
        if (state.isEmailMode) sendBulkEmail();
        else clickOnSubmit();
    });

    const listContainer = document.getElementById("BoardList");
    if (listContainer) {
        listContainer.addEventListener("click", (e) => {
            const id = e.target.getAttribute("data-id") || e.target.closest("[data-id]")?.getAttribute("data-id");
            if (id) renderAnnouncementDetail(id);
        });
    }

    const viewBody = document.getElementById("BoardModalViewBody");
    if (viewBody) {
        viewBody.addEventListener("click", (e) => {
            const id = e.target.getAttribute("data-id");
            if (!id) return;
            if (e.target.classList.contains("reply-btn-edit-detail")) {
                uiShowModal("edit", { id, ...state.AnnouncementData[id] });
            } else if (e.target.classList.contains("reply-btn-delete-detail")) {
                dbDeleteAnnouncement(id);
            }
        });
    }

    const titleIn = document.getElementById("BoardFormTitle");
    if (titleIn) titleIn.addEventListener("input", () => updateCounter("BoardFormTitle", "BoardTitleCounter", 100));

    const contentIn = document.getElementById("BoardFormContent");
    if (contentIn) contentIn.addEventListener("input", () => updateCounter("BoardFormContent", "BoardContentCounter", 2000));

    const prevBtn = document.getElementById("BoardBtnPrev");
    if (prevBtn) prevBtn.addEventListener("click", () => loadPage(-1));

    const nextBtn = document.getElementById("BoardBtnNext");
    if (nextBtn) nextBtn.addEventListener("click", () => loadPage(1));
}

// --- 7. Pagination Logic ---
async function fetchTotalCount() {
    try {
        const snapshot = await getCountFromServer(AnnouncementCol);
        state.totalCount = snapshot.data().count;
    } catch (e) {
        console.warn("fetchTotalCount failed:", e);
    }
}

async function loadPage(direction, forceHome = false) {
    if (state.isLoading) return;
    if (forceHome) {
        state.currentPage = 1;
        state.firstDoc = null;
        state.lastDoc = null;
        state.pageCache = {};
    }

    const targetPage = state.currentPage + direction;
    if (direction !== 0 && state.pageCache[targetPage]) {
        state.currentPage = targetPage;
        state.RecentIds = state.pageCache[targetPage].ids;
        state.hasNext = state.pageCache[targetPage].hasNext;
        renderAnnouncementList();
        return;
    }

    state.isLoading = true;
    try {
        let q;
        if (direction === 1 && state.lastDoc) {
            q = query(AnnouncementCol, orderBy("createdAt", "desc"), startAfter(state.lastDoc), limit(state.pageSize + 1));
        } else if (direction === -1 && state.firstDoc) {
            q = query(AnnouncementCol, orderBy("createdAt", "desc"), endBefore(state.firstDoc), limitToLast(state.pageSize));
        } else {
            q = query(AnnouncementCol, orderBy("createdAt", "desc"), limit(state.pageSize + 1));
            state.currentPage = 1;
        }

        const snapshot = await getDocs(q);
        const docs = snapshot.docs;
        if (docs.length === 0 && state.currentPage > 1) {
            state.isLoading = false;
            return loadPage(-1);
        }

        if (direction >= 0) {
            state.hasNext = docs.length > state.pageSize;
            if (state.hasNext) docs.pop();
        } else state.hasNext = true;

        state.RecentIds = [];
        docs.forEach(d => {
            const id = d.id;
            state.AnnouncementData[id] = d.data();
            state.RecentIds.push(id);
        });

        state.pageCache[targetPage] = { ids: state.RecentIds, hasNext: state.hasNext };
        state.firstDoc = docs[0] || null;
        state.lastDoc = docs[docs.length - 1] || null;
        if (direction !== 0) state.currentPage = targetPage;
        renderAnnouncementList();
    } catch (e) {
        console.error("loadPage failed:", e);
    } finally {
        state.isLoading = false;
    }
}

// --- 8. Initialization ---
fb.onAuthStateChanged(fb.auth, async (user) => {
    state.currentUser = user;
    state.isAdmin = false;
    if (user) {
        try {
            const userSnap = await getDoc(doc(db, "smokelyze_users", user.uid));
            if (userSnap.exists()) {
                const data = userSnap.data();
                state.isAdmin = (data.role === "admin" || data.userRole === "admin" || data.isAdmin === true);
            }
        } catch (e) { console.warn("Failed to fetch user role:", e); }
    }
    const writeBtn = document.getElementById("BoardBtnWrite");
    const emailBtn = document.getElementById("BoardBtnEmail");
    if (writeBtn) writeBtn.style.display = state.isAdmin ? "block" : "none";
    if (emailBtn) emailBtn.style.display = state.isAdmin ? "block" : "none";
});

bindEventsAnnouncements();

(async () => {
    try {
        await fetchTotalCount();
        await loadPage(0);
    } catch (e) { console.error("Init failed:", e); }
})();

