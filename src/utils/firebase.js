import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAc8IHuFWYob1dyrgVdzt690_7AauWY_Ic",
  authDomain: "eastbaytutoring-f903a.firebaseapp.com",
  projectId: "eastbaytutoring-f903a",
  storageBucket: "eastbaytutoring-f903a.appspot.com",
  messagingSenderId: "165245822592",
  appId: "1:165245822592:web:0c86829224a8543d0de865",
  measurementId: "G-LF34GQTSHQ"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app); 