export const FIREBASE_DB_URL =
  "https://for-mae-default-rtdb.asia-southeast1.firebasedatabase.app";

export const QUESTION_CATEGORIES = [
  "General Information",
  "Verbal Ability",
  "Analytical Ability",
  "Numerical Ability",
] as const;

export type QuestionCategory = (typeof QUESTION_CATEGORIES)[number];

export const CATEGORY_KEYS: Record<QuestionCategory, string> = {
  "General Information": "general_information",
  "Verbal Ability": "verbal_ability",
  "Analytical Ability": "analytical_ability",
  "Numerical Ability": "numerical_ability",
};

export const ALL_CATEGORIES = "All Categories" as const;

export type QuestionFilter = QuestionCategory | typeof ALL_CATEGORIES;
