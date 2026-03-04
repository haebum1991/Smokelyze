
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getFirestore, collection, addDoc, setDoc, getDoc, getDocs, getCountFromServer, onSnapshot, query, where, orderBy, limit, limitToLast, startAfter, startAt, endBefore, serverTimestamp, doc, updateDoc, deleteDoc, writeBatch, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { getAnalytics, logEvent } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-analytics.js";

// 어차피 fb는 서버내 rule에 통제되므로 key를 노출시켜도 상관이 없다.
// 이 방식 아니면 아이폰에서는 즉각적 반응을 안함...
const fbConfig = {
    apiKey: "AIzaSyAAQJpMU75J8ZPtB2e3Qx-YJoPQ8AOObVM",
    authDomain: "pmo3smoketool.firebaseapp.com",
    projectId: "pmo3smoketool",
    storageBucket: "pmo3smoketool.firebasestorage.app",
    messagingSenderId: "1068523865415",
    appId: "1:1068523865415:web:55cec0c9057ef07573f862",
    measurementId: "G-GXTFTTVL5B"
};

const app = initializeApp(fbConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const analytics = getAnalytics(app);

setPersistence(auth, browserLocalPersistence).catch(err => console.error("Persistence error:", err));
export const googleProvider = new GoogleAuthProvider();
// 항상 계정 선택 화면 표시 (아이폰 포함)
googleProvider.setCustomParameters({
    prompt: "select_account"
});

export {
    collection,
    addDoc,
    setDoc,
    getDoc,
    getDocs,
    getCountFromServer,
    onSnapshot,
    query,
    where,
    orderBy,
    limit,
    limitToLast,
    startAfter,
    startAt,
    endBefore,
    serverTimestamp,
    doc,
    updateDoc,
    deleteDoc,
    writeBatch,
    arrayUnion,
    arrayRemove,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    logEvent
};

