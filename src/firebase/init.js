// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from 'firebase/auth';
const firebaseToken = import.meta.env.VITE_FIREBASE_TOKEN;
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: firebaseToken,
  authDomain: "emparejados-85d5f.firebaseapp.com",
  projectId: "emparejados-85d5f",
  storageBucket: "emparejados-85d5f.firebasestorage.app",
  messagingSenderId: "921215015274",
  appId: "1:921215015274:web:59de125d4c64e5590aad13",
  measurementId: "G-DP2VTS95KC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore();
const analytics = getAnalytics(app);
const storage = getStorage(app);
const auth = getAuth();

// init firebase
export { app, db, storage, auth };