import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBpG0jinIwaHgF2h1oOA45xyG0bs0kOSos",
  authDomain: "life-rpg-83c0a.firebaseapp.com",
  projectId: "life-rpg-83c0a",
  appId: "1:381152713640:web:4afcec9538a39acf0d1b9d",
  storageBucket: "life-rpg-83c0a.firebasestorage.app",
  messagingSenderId: "381152713640"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export { auth, googleProvider };
