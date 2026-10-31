import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDFf2LU2Rabyfp9TMijtnwN4sFtLNysvNc",
  authDomain: "student-evaluation-67ffb.firebaseapp.com",
  projectId: "student-evaluation-67ffb",
  storageBucket: "student-evaluation-67ffb.firebasestorage.app",
  messagingSenderId: "1030618164131",
  appId: "1:1030618164131:web:0af7e4988b35aac62e4816",
  measurementId: "G-4VLMTMKXW4"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

window.db = db;
window.getDoc = getDoc;
window.setDoc = setDoc;
window.doc = doc;

console.log("Firebase Loaded OK");
console.log(window.doc);
console.log(window.getDoc);
console.log(window.setDoc);
