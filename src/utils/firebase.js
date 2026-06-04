import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_MEASUREMENT_ID
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