import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA9SaGQBKp3jgscOgbBxjJg4-JFNyh-kGY",
  authDomain: "sprintora-cda3a.firebaseapp.com",
  projectId: "sprintora-cda3a",
  storageBucket: "sprintora-cda3a.firebasestorage.app",
  messagingSenderId: "899682200014",
  appId: "1:899682200014:web:b17ba0bb68da29ec9d639f",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
