import { initializeApp } from "firebase/app";
import { getDatabase, get, ref, runTransaction, set } from "firebase/database";

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

type QuestionStat = {
  correct: number;
  wrong: number;
};

const normalizeQuestionStats = (payload: unknown): Record<string, QuestionStat> => {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  return Object.entries(payload as Record<string, Partial<QuestionStat>>).reduce(
    (result, [questionId, stat]) => {
      const correct = Number(stat.correct ?? 0);
      const wrong = Number(stat.wrong ?? 0);

      result[questionId] = {
        correct: Number.isFinite(correct) ? correct : 0,
        wrong: Number.isFinite(wrong) ? wrong : 0,
      };

      return result;
    },
    {} as Record<string, QuestionStat>,
  );
};

export const toUserKey = (email: string) => emailToKey(email);

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

export const getGeneralQuestionStats = async () => {
  const snapshot = await get(ref(db, "questionStats/general"));

  if (!snapshot.exists()) {
    return {} as Record<string, QuestionStat>;
  }

  return normalizeQuestionStats(snapshot.val());
};

export const getUserQuestionStats = async (userKey: string) => {
  const snapshot = await get(ref(db, `questionStats/users/${userKey}`));

  if (!snapshot.exists()) {
    return {} as Record<string, QuestionStat>;
  }

  return normalizeQuestionStats(snapshot.val());
};

export const saveQuestionAttempt = async (
  questionId: string,
  answeredCorrectly: boolean,
  userKey?: string | null,
) => {
  const field = answeredCorrectly ? "correct" : "wrong";

  await runTransaction(ref(db, `questionStats/general/${questionId}/${field}`), (currentValue) => {
    const current = Number(currentValue ?? 0);
    return Number.isFinite(current) ? current + 1 : 1;
  });

  if (!userKey) {
    return;
  }

  await runTransaction(
    ref(db, `questionStats/users/${userKey}/${questionId}/${field}`),
    (currentValue) => {
      const current = Number(currentValue ?? 0);
      return Number.isFinite(current) ? current + 1 : 1;
    },
  );
};
