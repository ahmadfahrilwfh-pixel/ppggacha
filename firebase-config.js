// firebase-config.js - Firebase Modular SDK Configuration for Dolan Bareng RW 5
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  onSnapshot, 
  updateDoc, 
  deleteDoc,
  doc, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

// Real Firebase Credentials
export const firebaseConfig = {
  apiKey: "AIzaSyD6mkNryCbWt5b1znG_5YeuAQ4CTw8W4xU",
  authDomain: "dorpricerw5.firebaseapp.com",
  projectId: "dorpricerw5",
  storageBucket: "dorpricerw5.firebasestorage.app",
  messagingSenderId: "734080726913",
  appId: "1:734080726913:web:724d96d917858ad7b89a80",
  measurementId: "G-K0RYK7QGXB"
};

const isConfigured = true; // Set to true since we have valid credentials now
let db = null;
let app = null;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  console.log("🔥 Firebase connected to dorpricerw5 successfully.");
} catch (err) {
  console.warn("⚠️ Firebase init warning:", err);
}

export { 
  db, 
  isConfigured,
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  onSnapshot, 
  updateDoc, 
  deleteDoc,
  doc, 
  serverTimestamp 
};
