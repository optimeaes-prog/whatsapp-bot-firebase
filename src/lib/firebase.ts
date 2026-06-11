import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCUp1ZUmkZnCXhTF0H5NbtDqZgZLJSe7nU",
  authDomain: "proplead.io",
  projectId: "real-estate-idealista-bot",
  storageBucket: "real-estate-idealista-bot.firebasestorage.app",
  messagingSenderId: "886555215384",
  appId: "1:886555215384:web:9a0bbad782d57e2a92a56d",
  measurementId: "G-7JTKQSCGPH"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, "realestate-whatsapp-bot");
export const storage = getStorage(app);
