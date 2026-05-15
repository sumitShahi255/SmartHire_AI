import { initializeApp } from "firebase/app";
import {getAuth, GoogleAuthProvider} from "firebase/auth"

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_APIKEY,
  authDomain: "smarthire-a6c1c.firebaseapp.com",
  projectId: "smarthire-a6c1c",
  storageBucket: "smarthire-a6c1c.firebasestorage.app",
  messagingSenderId: "1031641417737",
  appId: "1:1031641417737:web:5d2b3911c06a482e9c50d8"
};


const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const provider = new GoogleAuthProvider();

export {auth,provider};