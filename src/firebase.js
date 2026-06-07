// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDi3t09RvJDX9lzGIjvRI4mdGHi_EHFFxM",
  authDomain: "chile-predictor.firebaseapp.com",
  projectId: "chile-predictor",
  storageBucket: "chile-predictor.firebasestorage.app",
  messagingSenderId: "171056044227",
  appId: "1:171056044227:web:239592597e8c0556352a76"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();