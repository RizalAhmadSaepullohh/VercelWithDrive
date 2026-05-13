import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, initializeFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Konfigurasi standar Firebase Console
// Tambahkan kredensial ini ke file .env.local atau Vercel Environment Variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSy_GANTI_DENGAN_API_KEY_ANDA",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "ispeak-project.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "ispeak-project",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "ispeak-project.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:1234567890:web:abcdef123456"
};

// Mencegah duplikasi inisialisasi pada mode hot-reload Next.js
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Menerapkan perbaikan gRPC stream write error untuk lingkungan Server/Node.js Next.js
// dengan memaksakan mode Long Polling (HTTP/1.1 REST) alih-alih gRPC HTTP/2 streaming
let db;
try {
  db = initializeFirestore(app, {
    experimentalForceLongPolling: true
  });
} catch (e) {
  // Fallback aman jika instans Firestore sudah terdaftar sebelumnya di memori dev server
  db = getFirestore(app);
}

const storage = getStorage(app);

export { app, db, storage };
