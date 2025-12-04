// firebase-config.js - Environment aware config
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyBNuIYfcsi2NWkK1Ua4Tnycaf_qM3oix1s",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "neon-voting-app.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "neon-voting-app",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "neon-voting-app.firebasestorage.app",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "406871836482",
  appId: process.env.FIREBASE_APP_ID || "1:406871836482:web:b25063cd3829cd3dc6aadb",
  measurementId: process.env.FIREBASE_MEASUREMENT_ID || "G-VGW2Z3FR8M"
};

// Export for use in script.js
window.firebaseConfig = firebaseConfig;