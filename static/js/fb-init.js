
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getFirestore, collection, addDoc, setDoc, getDoc, getDocs, onSnapshot, query, where, orderBy, limit, serverTimestamp, doc, updateDoc, deleteDoc, writeBatch, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";

// 어차피 fb는 서버내 rule에 통제되므로 key를 노출시켜도 상관이 없다.
// 이 방식 아니면 아이폰에서는 즉각적 반응을 안함...
const fbConfig = {
    apiKey: "AIzaSyCepAjKyOcMqnrtTe7F7IlRciMA7ijLayE",
    authDomain: "pmo3smoketool.firebaseapp.com",
    projectId: "pmo3smoketool",
    storageBucket: "pmo3smoketool.firebasestorage.app",
    messagingSenderId: "1068523865415",
    appId: "1:1068523865415:web:f7a4a74163e5b3c573f862",
    measurementId: "G-W74NK6JE80"
};
const app = initializeApp(fbConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
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
    onSnapshot,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp,
    doc,
    updateDoc,
    deleteDoc,
    writeBatch,
    arrayUnion,
    arrayRemove,
    signInWithPopup,
    signOut,
    onAuthStateChanged
};

