import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDvYJh6NIa3fPjmf86DVDWpsEFLNVOkCVg",
  authDomain: "gestionrq.firebaseapp.com",
  projectId: "gestionrq",
  storageBucket: "gestionrq.firebasestorage.app",
  messagingSenderId: "425560638428",
  appId: "1:425560638428:web:0ff52e50d92fa047c44519",
  measurementId: "G-E5YHFWW71L"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app; 
