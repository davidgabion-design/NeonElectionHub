// firebase-config.js
const firebaseConfig = {
  apiKey: "AIzaSyBNuIYfcsi2NWkK1Ua4Tnycaf_qM3oix1s",
  authDomain: "neon-voting-app.firebaseapp.com",
  projectId: "neon-voting-app",
  storageBucket: "neon-voting-app.firebasestorage.app",
  messagingSenderId: "406871836482",
  appId: "1:406871836482:web:b25063cd3829cd3dc6aadb",
  measurementId: "G-VGW2Z3FR8M"
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = firebaseConfig;
}