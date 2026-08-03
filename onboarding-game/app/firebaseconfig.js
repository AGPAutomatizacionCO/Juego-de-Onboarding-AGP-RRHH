// Importa Firebase App y Firestore
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// 🔥 Tu configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAMNI9nhutztO4DI2wPGUCnqr0GEuydN7k",
  authDomain: "onboardinggame-4d012.firebaseapp.com",
  projectId: "onboardinggame-4d012",
  storageBucket: "onboardinggame-4d012.appspot.com",
  messagingSenderId: "301710865791",
  appId: "1:301710865791:web:771887c2d958cf47e3964a",
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Exportar Firestore para usar en la app
export const db = getFirestore(app);
