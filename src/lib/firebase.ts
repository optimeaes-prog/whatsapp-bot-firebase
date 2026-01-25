import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCUp1ZUmkZnCXhTF0H5NbtDqZgZLJSe7nU",
  authDomain: "real-estate-idealista-bot.firebaseapp.com",
  projectId: "real-estate-idealista-bot",
  storageBucket: "real-estate-idealista-bot.firebasestorage.app",
  messagingSenderId: "886555215384",
  appId: "1:886555215384:web:9a0bbad782d57e2a92a56d",
  measurementId: "G-7JTKQSCGPH"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Connect to the specific Firestore database
export const db = getFirestore(app, "realestate-whatsapp-bot");

// Initialize Analytics only in browser
let analytics = null;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}
export { analytics };
