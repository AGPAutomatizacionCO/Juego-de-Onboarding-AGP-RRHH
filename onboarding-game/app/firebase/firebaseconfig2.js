// app/firebase/firebaseconfig2.js
// ✅ Config central de Firebase (Auth, Firestore, Storage)

import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAMNI9nhutztO4DI2wPGUCnqr0GEuydN7k",
  authDomain: "onboardinggame-4d012.firebaseapp.com",
  projectId: "onboardinggame-4d012",
  storageBucket: "onboardinggame-4d012.appspot.com",
  messagingSenderId: "301710865791",
  appId: "1:301710865791:web:771887c2d958cf47e3964a",
};

// Evita re-inicializar
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// Servicios
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
