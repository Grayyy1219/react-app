import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyD9iANgGXG8sfryA5qwVacmscyyNLCHlok",
  authDomain: "for-mae.firebaseapp.com",
  databaseURL:
    "https://for-mae-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "for-mae",
  storageBucket: "for-mae.firebasestorage.app",
  messagingSenderId: "391845822528",
  appId: "1:391845822528:web:da9842ed1038666cfd5fa5",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export type UserRole = "admin" | "regular";

export type StoredUser = {
  email: string;
  password: string;
  role: UserRole;
};

const emailToKey = (email: string) =>
  email.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");

export const saveUserCredentials = async (user: StoredUser) => {
  const userKey = emailToKey(user.email);
  await set(ref(db, `users/${userKey}`), user);
};

export const getUserCredentials = async (email: string) => {
  const userKey = emailToKey(email);
  const snapshot = await get(ref(db, `users/${userKey}`));

  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.val() as StoredUser;
};
