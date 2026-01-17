
import * as fb from "./fb-init.js";
import * as utils from "./utils.js";

const {
    auth, db, onAuthStateChanged, signInWithPopup, signOut, googleProvider,
    doc, setDoc, getDoc, collection, addDoc, serverTimestamp,
    query, where, getDocs, updateDoc, arrayUnion, arrayRemove, writeBatch
} = fb;

const unauthContainer = document.getElementById("ProfileBoxUnauthenticated");
const authContainer = document.getElementById("ProfileBoxAuthenticated");
const navAuthBtn = document.getElementById("NavBtnAuth");

const profileDrop = document.getElementById("ProfileDropdown");
const profileUserBtn = document.getElementById("ProfileBtnUser");
const profileProfileBtn = document.getElementById("ProfileBtnProfile");
const profileSettingsBtn = document.getElementById("ProfileBtnSettings");
const profileLogoutBtn = document.getElementById("ProfileBtnLogout");

const profileModal = document.getElementById("ProfilePage");
const profileCloseBtn = document.getElementById("ProfileBtnClose");
const profileSaveBtn = document.getElementById("ProfileBtnSave");
const profileMsg = document.getElementById("ProfileMessage");
const profileUidInput = document.getElementById("ProfileUID");
const profileCopyUidBtn = document.getElementById("ProfileBtnCopyUID");

const settingsModal = document.getElementById("SettingsPage");
const settingsCloseBtn = document.getElementById("SettingsBtnClose");

const authOverlay = document.getElementById("AuthOverlay");
const authLoginBtn = document.getElementById("AuthBtnLogin");
const authSkipBtn = document.getElementById("AuthBtnSkip");
const benefitsToggle = document.getElementById("AuthBtnBenefits");
const backToLoginBtn = document.getElementById("AuthBackToLogin");
const mainView = document.getElementById("AuthViewMain");
const benefitsView = document.getElementById("AuthViewBenefits");
const cardHeaderTitle = document.querySelector("#AuthOverlay .auth-card-header h3");

onAuthStateChanged(auth, async (user) => {

    if (user) {
        // UI Switch
        if (unauthContainer) unauthContainer.style.display = "none";
        if (authContainer) authContainer.style.display = "flex";
        sessionStorage.setItem("auth-last-state", "in");

        // Profile Button Update (Photo or Initial)
        if (profileUserBtn) {
            const currentPhoto = profileUserBtn.querySelector("img")?.src;
            if (user.photoURL) {
                if (currentPhoto !== user.photoURL) {
                    profileUserBtn.innerHTML = ""; // Clear existing
                    const img = document.createElement("img");
                    img.src = user.photoURL;
                    img.alt = "Profile";
                    img.referrerPolicy = "no-referrer"; // Helps with some CDN restrictions
                    Object.assign(img.style, { width: "100%", height: "100%", objectFit: "cover" });

                    // Handle 429 or other load errors
                    img.onerror = () => {
                        console.warn("Profile image load failed, falling back to initials");
                        profileUserBtn.innerHTML = "";
                        const avatarDiv = document.createElement("div");
                        avatarDiv.className = "profile-avatar";
                        avatarDiv.innerHTML = `<span style="font-size: 1.2rem; font-weight: bold;">${getInitials(user.displayName) || "U"}</span>`;
                        profileUserBtn.appendChild(avatarDiv);
                    };
                    profileUserBtn.appendChild(img);
                }
            } else {
                profileUserBtn.innerHTML = "";
                const avatarDiv = document.createElement("div");
                avatarDiv.className = "profile-avatar";
                avatarDiv.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
                profileUserBtn.appendChild(avatarDiv);
            }
        }

        await recordUserHistory(user);
    } else {
        // UI Switch
        if (unauthContainer) unauthContainer.style.display = "block";
        if (authContainer) authContainer.style.display = "none";
        sessionStorage.setItem("auth-last-state", "out");
    }

    // Map Overlay logic
    if (authOverlay) {
        authOverlay.style.display = (user || sessionStorage.getItem("auth-guest-dismissed")) ? "none" : "flex";
    }

    window.dispatchEvent(new CustomEvent("authStateChanged", { detail: { user } }));
});

function getInitials(name) {
    if (!name) return "";
    const parts = name.trim().split(" ").filter(function (p) {
        return p.length > 0;
    });

    if (parts.length === 1) {
        return parts[0].substring(0, 3).toUpperCase();
    }
    let initial = "";
    for (let i = 0; i < parts.length; i++) {
        initial += parts[i][0];
    }
    return initial.toUpperCase().substring(0, 5);
}

async function recordUserHistory(user) {
    try {
        const userRef = doc(db, "smokelyze_users", user.uid);

        // 1. 기존 유저 정보 조회 (닉네임 존재 여부 확인)
        const userSnap = await getDoc(userRef);
        let currentNickname = "";

        if (userSnap.exists()) {
            currentNickname = userSnap.data().nickname;
        }

        // 2. 닉네임이 없으면 이니셜로 생성
        if (!currentNickname) {
            currentNickname = getInitials(user.displayName);
        }

        // 3. 데이터 저장
        await setDoc(userRef, {
            displayName: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
            nickname: currentNickname,
            lastLogin: serverTimestamp()
        }, { merge: true });

        const logKey = `logged_${user.uid}_${new Date().toISOString().split("T")[0]}`;
        if (!sessionStorage.getItem(logKey)) {
            await addDoc(collection(db, "smokelyze_login_logs"), {
                uid: user.uid,
                email: user.email,
                loginAt: serverTimestamp(),
                userAgent: navigator.userAgent
            });
            sessionStorage.setItem(logKey, "true");
        }
    } catch (error) {
        console.error("Sync Error:", error);
    }
}

export async function doLogin() {
    try {
        // 즉시 팝업 호출 (앞에 await가 있으면 아이폰에서 차단됨)
        // await setPersistence(auth, browserLocalPersistence);
        // setPersistence, browserLocalPersistence를 fb-init.js에서 직접접호출..
        await signInWithPopup(auth, googleProvider);
    } catch (error) {
        console.error("Login Error:", error);
        if (error.code !== "auth/popup-closed-by-user" && error.code !== "auth/cancelled-popup-request") {
            alert("Login failed: " + error.message);
        }
    }
}

if (navAuthBtn) navAuthBtn.addEventListener("click", () => {
    utils.showAuthOverlay();
});

window.addEventListener("click", () => {
    if (profileDrop) profileDrop.classList.remove("show");
});

if (profileLogoutBtn) {
    profileLogoutBtn.addEventListener("click", async () => {
        if (confirm("Are you sure you want to logout?")) {
            await signOut(auth);
            sessionStorage.removeItem("auth-guest-dismissed");
        }
    });
}

// Profiles Modal
if (profileProfileBtn) {
    profileProfileBtn.addEventListener("click", async () => {
        const user = auth.currentUser;
        if (!user) return;

        if (profileModal) profileModal.style.display = "flex";
        if (profileMsg) profileMsg.innerText = "";

        const nameEl = document.getElementById("ProfileName");
        const emailEl = document.getElementById("ProfileEmails");
        if (nameEl) nameEl.value = user.displayName || "";
        if (emailEl) emailEl.value = user.email || "";
        if (profileUidInput) profileUidInput.value = user.uid;

        try {
            const snap = await getDoc(doc(db, "smokelyze_users", user.uid));
            if (snap.exists()) {
                const data = snap.data();
                const nickEl = document.getElementById("ProfileNickname");
                const affilEl = document.getElementById("ProfileAffiliation");
                if (nickEl) nickEl.value = data.nickname || "";
                if (affilEl) affilEl.value = data.affiliation || "";
            }
        } catch (e) { console.error("Fetch Profiles Err:", e); }
    });
}

if (profileCopyUidBtn) {
    profileCopyUidBtn.addEventListener("click", () => {
        const uidVal = profileUidInput?.value;
        if (!uidVal) return;
        navigator.clipboard.writeText(uidVal).then(() => {
            const originalText = profileCopyUidBtn.innerText;
            profileCopyUidBtn.innerText = "Copied!";
            setTimeout(() => { profileCopyUidBtn.innerText = originalText; }, 2000);
        }).catch(err => {
            console.error("Copy failed:", err);
            alert("Copy failed. Please copy manually.");
        });
    });
}

// Settings Modal
if (profileSettingsBtn) {
    profileSettingsBtn.addEventListener("click", async () => {
        const user = auth.currentUser;
        if (!user) return;

        if (settingsModal) settingsModal.style.display = "flex";

        try {
            const snap = await getDoc(doc(db, "smokelyze_users", user.uid));
            if (snap.exists()) {
                renderGroupList(snap.data().mygroup || []);
            }
        } catch (e) { console.error("Fetch Settings Err:", e); }
    });
}

if (settingsCloseBtn) settingsCloseBtn.addEventListener("click", () => {
    if (settingsModal) settingsModal.style.display = "none";
});

// --- Group Management ---
const groupListEl = document.getElementById("SettingsGroupList");
const groupInputEl = document.getElementById("SettingsGroupInput");
const groupAddBtn = document.getElementById("SettingsGroupAdd");

function renderGroupList(group) {
    if (!groupListEl) return;
    groupListEl.innerHTML = "";
    if (!group || group.length === 0) {
        groupListEl.innerHTML = `<li style="padding: 0.5rem; text-align: center; color: var(--text-main);">No group members yet.</li>`;
        return;
    }
    group.forEach(member => {
        const li = document.createElement("li");
        li.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; border-bottom: 1px solid var(--border-color);";

        const span = document.createElement("span");
        span.textContent = `${member.email} (${member.nickname || "No Nickname"})`;

        const btn = document.createElement("button");
        btn.className = "group-remove-btn";
        btn.style.cssText = "font-size: 2.4rem; color: red; border: none; background: none; cursor: pointer;";
        btn.innerHTML = "&times;"; // Safe static symbol
        btn.addEventListener("click", () => removeGroupMember(member));

        li.appendChild(span);
        li.appendChild(btn);
        groupListEl.appendChild(li);
    });
}

// --- [Internal Helper] Sync Access for Group Members ---
async function syncGroupAccess(targetUid, action = "add") {
    const user = auth.currentUser;
    const postsRef = collection(db, "smokelyze_MapPost");

    // 1. My docs (Posts & Replies I authored)
    const qMyDocs = query(postsRef, where("uid", "==", user.uid));
    const myDocsSnap = await getDocs(qMyDocs);

    let batch = writeBatch(db);
    const myPostIds = [];
    let opCount = 0;
    const viewerOp = (action === "add") ? arrayUnion(targetUid) : arrayRemove(targetUid);

    myDocsSnap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.type === "MapPost") myPostIds.push(docSnap.id);

        if (data.viewers && Array.isArray(data.viewers) && !data.viewers.includes("public")) {
            batch.update(docSnap.ref, { viewers: viewerOp });
            opCount++;
        }
    });

    if (opCount > 0) {
        await batch.commit();
        batch = writeBatch(db);
        opCount = 0;
    }

    // 2. Others replies on my posts
    if (myPostIds.length > 0) {
        for (let i = 0; i < myPostIds.length; i += 30) {
            const chunk = myPostIds.slice(i, i + 30);
            const qReplies = query(postsRef, where("rootId", "in", chunk));
            const repliesSnap = await getDocs(qReplies);

            for (const rSnap of repliesSnap.docs) {
                const rData = rSnap.data();
                if (rData.uid === user.uid) continue; // Handled in Step 1

                if (rData.viewers && Array.isArray(rData.viewers) && !rData.viewers.includes("public")) {
                    try {
                        // Update individually to handle potential permission issues per-document
                        await updateDoc(rSnap.ref, { viewers: viewerOp });
                    } catch (e) {
                        console.warn(`Sync access failed for ${rSnap.id}:`, e.message);
                    }
                }
            }
        }
    }
}

async function addGroupMember() {
    if (!groupInputEl) return;
    const targetUidInput = groupInputEl.value.trim();
    if (!targetUidInput) return;

    const user = auth.currentUser;
    if (!user) return;

    groupAddBtn.disabled = true;
    groupAddBtn.innerText = "...";

    try {
        if (targetUidInput === user.uid) {
            alert("You cannot add yourself.");
            return;
        }

        const userRef = doc(db, "smokelyze_users", targetUidInput);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            alert("User not found with ID: " + targetUidInput);
            return;
        }

        const data = userSnap.data();
        const targetUser = { uid: userSnap.id, nickname: data.nickname, email: data.email };

        const myRef = doc(db, "smokelyze_users", user.uid);
        await updateDoc(myRef, { mygroup: arrayUnion(targetUser) });

        await syncGroupAccess(targetUser.uid, "add");

        groupInputEl.value = "";
        const snap = await getDoc(myRef);
        if (snap.exists()) renderGroupList(snap.data().mygroup || []);

    } catch (err) {
        console.error("Add Group Err:", err);
        alert("Failed to add member: " + err.message);
    } finally {
        groupAddBtn.disabled = false;
        groupAddBtn.innerText = "Add";
    }
}

async function removeGroupMember(member) {
    if (!confirm(`Remove ${member.email} from your group?`)) return;

    const user = auth.currentUser;
    if (!user) return;

    try {
        const myRef = doc(db, "smokelyze_users", user.uid);
        await updateDoc(myRef, { mygroup: arrayRemove(member) });

        await syncGroupAccess(member.uid, "remove");

        const snap = await getDoc(myRef);
        if (snap.exists()) renderGroupList(snap.data().mygroup || []);
    } catch (err) {
        console.error("Remove failed:", err);
        alert("Remove failed: " + err.message);
    }
}

if (groupAddBtn) groupAddBtn.addEventListener("click", addGroupMember);

if (profileCloseBtn) profileCloseBtn.addEventListener("click", () => {
    if (profileModal) profileModal.style.display = "none";
});

if (profileSaveBtn) {
    profileSaveBtn.addEventListener("click", async () => {
        const user = auth.currentUser;
        if (!user) return;

        const nickEl = document.getElementById("ProfileNickname");
        const affilEl = document.getElementById("ProfileAffiliation");
        const nick = nickEl ? nickEl.value.trim() : "";
        const affil = affilEl ? affilEl.value.trim() : "";

        profileSaveBtn.disabled = true;
        profileSaveBtn.innerText = "Saving...";

        try {
            await updateDoc(doc(db, "smokelyze_users", user.uid), {
                nickname: nick,
                affiliation: affil,
                updatedAt: serverTimestamp()
            });

            if (profileMsg) {
                profileMsg.innerText = "Successfully updated!";
                profileMsg.className = "profile-message success";
            }
            setTimeout(() => { if (profileModal) profileModal.style.display = "none"; }, 1500);
        } catch (e) {
            console.error("Save Err:", e);
            if (profileMsg) {
                profileMsg.innerText = "Error: " + e.message;
                profileMsg.className = "profile-message error";
            }
        } finally {
            profileSaveBtn.disabled = false;
            profileSaveBtn.innerText = "Save Changes";
        }
    });
}

// Auth Overlay Toggles
if (authLoginBtn) authLoginBtn.addEventListener("click", doLogin);
if (authSkipBtn) authSkipBtn.addEventListener("click", () => {
    if (authOverlay) authOverlay.style.display = "none";
    sessionStorage.setItem("auth-guest-dismissed", "true");
});
if (benefitsToggle && mainView && benefitsView) {
    benefitsToggle.addEventListener("click", () => {
        mainView.style.display = "none";
        benefitsView.style.display = "block";
        if (cardHeaderTitle) cardHeaderTitle.innerText = "Member Benefits";
    });
}
if (backToLoginBtn && mainView && benefitsView) {
    backToLoginBtn.addEventListener("click", () => {
        mainView.style.display = "block";
        benefitsView.style.display = "none";
        if (cardHeaderTitle) cardHeaderTitle.innerText = "Login Required";
    });
}

// Idle Timeout
let idleTimer;
const IDLE_TIMEOUT = 60 * 60 * 1000;
function resetIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    if (auth.currentUser) {
        idleTimer = setTimeout(async () => {
            await signOut(auth);
            sessionStorage.removeItem("auth-guest-dismissed");
            alert("Logged out due to inactivity.");
        }, IDLE_TIMEOUT);
    }
}
["mousemove", "keydown", "mousedown", "touchstart", "scroll"].forEach(e => window.addEventListener(e, resetIdleTimer, true));
resetIdleTimer();

