import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDYkZ-g_v9ACg_s_ytSZJlEeihagVlW9zc",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "bdian-5de88.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "bdian-5de88",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "bdian-5de88.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "534438943952",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:534438943952:web:a88ff9628a3175be5b12d5",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-TZKY77Q7DZ",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
