// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA0qg8CoaF6PNjoMUiEi2cmDQKUUf6cWyo",
  authDomain: "competition-registrations.firebaseapp.com",
  projectId: "competition-registrations",
  storageBucket: "competition-registrations.firebasestorage.app",
  messagingSenderId: "177936972499",
  appId: "1:177936972499:web:d7fac53729c4262154b226",
  measurementId: "G-D2RXH34ECW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// Analytics initialized but not used in current implementation
// eslint-disable-next-line no-unused-vars
const analytics = getAnalytics(app);

// Initialize Firestore
export const db = getFirestore(app);

export default app;
