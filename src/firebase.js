// What's for Tea? uses the same Firebase project as Kcal Tracker, so the
// same accounts work in both apps. Its data lives in its own places:
//   tea/week        the shared week plan, settings and shopping ticks
//   tea/library     meals you've added and any new ingredients
//   teaImages/{id}  small compressed photos of imported meals
// See firestore.rules.txt for the rules these need.

import { initializeApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  updateProfile,
} from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCPpBWC7Nz-a7QiIA6iHGCrgKjiEKu88Ng",
  authDomain: "kcal-tracker-1adb3.firebaseapp.com",
  projectId: "kcal-tracker-1adb3",
  storageBucket: "kcal-tracker-1adb3.firebasestorage.app",
  messagingSenderId: "268027025012",
  appId: "1:268027025012:web:e2be0adca398d0d96ca321",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true });

export function signUp(email, password, displayName) {
  return createUserWithEmailAndPassword(auth, email, password).then((cred) => {
    if (displayName) return updateProfile(cred.user, { displayName }).then(() => cred);
    return cred;
  });
}
export const signIn = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const signInWithGoogle = () => signInWithPopup(auth, new GoogleAuthProvider());
export const signOutUser = () => signOut(auth);
export const watchAuth = (cb) => onAuthStateChanged(auth, cb);
