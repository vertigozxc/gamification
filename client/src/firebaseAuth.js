import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const requiredKeys = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID"
];

const missingKeys = requiredKeys.filter((key) => !import.meta.env[key]);

let auth = null;
let googleProvider = null;
let firebaseInitError = "";

if (missingKeys.length > 0) {
  firebaseInitError = `Missing Firebase env vars: ${missingKeys.join(", ")}.`;
} else {
  try {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: "select_account" });
  } catch (error) {
    firebaseInitError = error?.message || "Firebase initialization failed.";
  }
}

export { auth, googleProvider, firebaseInitError };
