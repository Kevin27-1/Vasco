import { initializeApp, getApps, getApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyA5WJHrDEo4KVZbg2GT00M_Astt5K5AD4M",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "vasco-214ce.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "vasco-214ce",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "vasco-214ce.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "641229866512",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:641229866512:web:c4e15526874b87439c2c95",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-M7YS9WX9R3"
}

export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp()
export const db = getFirestore(app)
