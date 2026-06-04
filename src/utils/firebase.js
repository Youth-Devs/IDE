import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBJy-hyVkVuNH-kYnpgBgYOm7nHAXBsuNA",
  authDomain: "youthdevside.firebaseapp.com",
  projectId: "youthdevside",
  storageBucket: "youthdevside.firebasestorage.app",
  messagingSenderId: "1042385148804",
  appId: "1:1042385148804:web:b2100d4e758898046e5bd1",
  measurementId: "G-DLP2BQ9YQT"
};

// 🔍 CRITICAL RUNTIME CHECK: Log key status directly to your browser's inspect console
if (typeof window !== 'undefined') {
  console.log("=== FIREBASE ENV VALIDATION ===");
  console.log("API Key Present:", !!firebaseConfig.apiKey);
  console.log("Project ID:", firebaseConfig.projectId);
  if (!firebaseConfig.apiKey) {
    console.error("CRITICAL: Next.js cannot read NEXT_PUBLIC_FIREBASE_API_KEY. Check your .env.local placement!");
  }
}

let app;
let auth;
let db;
let googleProvider;

try {
  // Gracefully handle server-side compilation vs client-side hot reload states
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  googleProvider = new GoogleAuthProvider();
} catch (error) {
  console.error("Firebase initialization failed violently:", error.message);
}

export { auth, db, googleProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut };