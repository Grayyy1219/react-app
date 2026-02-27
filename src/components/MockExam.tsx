import { useEffect, useMemo, useState } from "react";
import "../css/mock-exam.css";
import {
  CATEGORY_KEYS,
  FIREBASE_DB_URL,
  QUESTION_CATEGORIES,
  type QuestionCategory,
} from "../constants/questions";
import { saveMockExamRecord, toUserKey } from "../firebase";

type QuestionItem = {
  id: string;
  question: string;
  category: QuestionCategory;
  options: string[];
  correctIndex: number;
  hint: string;
};

type FirebaseQuestion = {
  question?: string;
  options?: string[];
  correctIndex?: number;
  hint?: string;
};

type MockExamProps = {
  userEmail: string | null;
};

const normalizeQuestions = (
  category: QuestionCategory,
  payload: Record<string, FirebaseQuestion> | null,
): QuestionItem[] => {
  if (!payload) {
    return [];
  }

  return Object.entries(payload)
    .map(([id, value]) => {
      const options = value.options;
      const correctIndex = value.correctIndex;
      const hasValidOptions =
        Array.isArray(options) && options.length > 0 && options.every(Boolean);
      const hasValidCorrectIndex =
        typeof correctIndex === "number" &&
        correctIndex >= 0 &&
        hasValidOptions &&
        correctIndex < options.length;

      if (!value.question || !hasValidOptions || !hasValidCorrectIndex) {
        return null;
      }

      return {
        id,
        question: value.question,
        category,
        options,
        correctIndex,
        hint: value.hint?.trim() ?? "",
      } satisfies QuestionItem;
    })
    .filter((item): item is QuestionItem => item !== null);
};

const getShuffledQuestions = (questions: QuestionItem[]) => {
  const cloned = [...questions];

  for (let index = cloned.length - 1; index > 0; index -= 1) {
    const targetIndex = Math.floor(Math.random() * (index + 1));
    [cloned[index], cloned[targetIndex]] = [cloned[targetIndex], cloned[index]];
  }

  return cloned;
};

const MockExam = ({ userEmail }: MockExamProps) => {
  const [allQuestions, setAllQuestions] = useState<QuestionItem[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<QuestionCategory[]>([
    QUESTION_CATEGORIES[0],
  ]);
  const [questionCount, setQuestionCount] = useState(10);
  const [examQuestions, setExamQuestions] = useState<QuestionItem[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingResult, setIsSavingResult] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchQuestions = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const questionRequests = QUESTION_CATEGORIES.map(async (category) => {
          const response = await fetch(
            `${FIREBASE_DB_URL}/questions/${CATEGORY_KEYS[category]}.json`,
          );

          if (!response.ok) {
            throw new Error(`Failed to fetch ${category}`);
          }

          const data = (await response.json()) as Record<
            string,
            FirebaseQuestion
          > | null;
          return normalizeQuestions(category, data);
        });

        const responses = await Promise.all(questionRequests);
        setAllQuestions(responses.flat());
      } catch (fetchError) {
        console.error("Failed to load questions", fetchError);
        setError("Unable to load questions right now.");
      } finally {
        setIsLoading(false);
      }
    };

    void fetchQuestions();
  }, []);

  const availableQuestions = useMemo(
    () =>
      allQuestions.filter((question) =>
        selectedCategories.includes(question.category),
      ),
    [allQuestions, selectedCategories],
  );

  const canStartExam =
    selectedCategories.length > 0 &&
    questionCount > 0 &&
    availableQuestions.length >= questionCount;

  const maxQuestionCount = Math.max(availableQuestions.length, 1);

  const score = useMemo(
    () =>
      examQuestions.reduce((total, question) => {
        const selectedAnswer = answers[question.id];
        return selectedAnswer === question.correctIndex ? total + 1 : total;
      }, 0),
    [answers, examQuestions],
  );

  const answeredCount = Object.keys(answers).length;
  const completionRate =
    examQuestions.length > 0
      ? Math.round((answeredCount / examQuestions.length) * 100)
      : 0;
  const scorePercentage =
    examQuestions.length > 0 ? Math.round((score / examQuestions.length) * 100) : 0;
  const incorrectCount = Math.max(examQuestions.length - score, 0);
  const resultStatus =
    scorePercentage >= 80
      ? "Excellent"
      : scorePercentage >= 60
        ? "Good"
        : "Needs Improvement";

  const toggleCategory = (category: QuestionCategory) => {
    setSelectedCategories((previous) => {
      if (previous.includes(category)) {
        return previous.filter((item) => item !== category);
      }

      return [...previous, category];
    });
  };

  const startExam = () => {
    const normalizedQuestionCount = Math.min(Math.max(questionCount, 1), maxQuestionCount);
    const selectedQuestions = getShuffledQuestions(availableQuestions).slice(
      0,
      normalizedQuestionCount,
    );

    setExamQuestions(selectedQuestions);
    setAnswers({});
    setIsSubmitted(false);
  };

  const submitExam = async () => {
    if (!userEmail) {
      return;
    }

    setIsSavingResult(true);

    try {
      await saveMockExamRecord(toUserKey(userEmail), {
        totalQuestions: examQuestions.length,
        score,
        selectedCategories,
        submittedAt: new Date().toISOString(),
        questions: examQuestions.map((question) => ({
          id: question.id,
          question: question.question,
          category: question.category,
          options: question.options,
          correctIndex: question.correctIndex,
          selectedIndex: answers[question.id],
        })),
      });
      setIsSubmitted(true);
    } catch (submitError) {
      console.error("Failed to save mock exam history", submitError);
      setError("Unable to save your result. Please try again.");
    } finally {
      setIsSavingResult(false);
    }
  };

  if (!userEmail) {
    return (
      <div className="mock-exam-page">
        <div className="mock-exam-card">
          <h2>Login Required</h2>
          <p>Please login first to create a mock exam and save your score.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mock-exam-page">
      <div className="mock-exam-card">
        <h2>Mock Exam Builder</h2>
        <p>Select categories and the number of questions, then start your timed-style practice.</p>

        {isLoading && <p>Loading question bank...</p>}
        {!isLoading && error && <p className="mock-exam-error">{error}</p>}

        {!isLoading && (
          <>
            <div className="mock-exam-categories" role="group" aria-label="Categories">
              {QUESTION_CATEGORIES.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={`mock-exam-chip ${selectedCategories.includes(category) ? "active" : ""}`}
                  onClick={() => toggleCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>

            <label className="mock-exam-field" htmlFor="question-count">
              Number of questions
              <input
                id="question-count"
                type="number"
                min={1}
                max={maxQuestionCount}
                value={questionCount}
                onChange={(event) => {
                  const nextValue = Number(event.target.value);

                  if (Number.isNaN(nextValue)) {
                    setQuestionCount(1);
                    return;
                  }

                  setQuestionCount(Math.min(Math.max(Math.trunc(nextValue), 1), maxQuestionCount));
                }}
              />
            </label>

            <div className="mock-exam-stats" aria-live="polite">
              <span className="mock-exam-stat-item">
                <strong>Available</strong>
                {availableQuestions.length}
              </span>
              <span className="mock-exam-stat-item">
                <strong>Selected</strong>
                {questionCount}
              </span>
              <span className="mock-exam-stat-item">
                <strong>Categories</strong>
                {selectedCategories.length}
              </span>
            </div>

            <button
              type="button"
              className="mock-exam-primary-btn"
              onClick={startExam}
              disabled={!canStartExam}
            >
              Start Mock Exam
            </button>
          </>
        )}
      </div>

      {examQuestions.length > 0 && (
        <div className="mock-exam-form-card">
          <div className="mock-exam-form-header">
            <h3>Mock Exam Questions</h3>
            <span className="mock-exam-progress-pill">
              {answeredCount}/{examQuestions.length} answered
            </span>
          </div>
          <p className="mock-exam-helptext">Answer all questions and submit to save your result.</p>
          <div className="mock-exam-progress-track" aria-label="Exam progress">
            <span
              className="mock-exam-progress-fill"
              style={{ width: `${completionRate}%` }}
            />
          </div>
          {examQuestions.map((question, index) => (
            <section key={question.id} className="mock-exam-question-block">
              <p className="mock-exam-question-title">
                {index + 1}. {question.question}
              </p>
              <p className="mock-exam-question-category">{question.category}</p>
              <div className="mock-exam-options">
                {question.options.map((option, optionIndex) => (
                  <label
                    key={`${question.id}-${optionIndex}`}
                    className={`mock-exam-option ${
                      isSubmitted && optionIndex === question.correctIndex
                        ? "mock-exam-option-correct"
                        : ""
                    } ${
                      isSubmitted &&
                      answers[question.id] === optionIndex &&
                      optionIndex !== question.correctIndex
                        ? "mock-exam-option-wrong"
                        : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name={`question-${question.id}`}
                      checked={answers[question.id] === optionIndex}
                      onChange={() =>
                        setAnswers((previous) => ({
                          ...previous,
                          [question.id]: optionIndex,
                        }))
                      }
                      disabled={isSubmitted}
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>

              {isSubmitted && (
                <div className="mock-exam-review-note">
                  {answers[question.id] === question.correctIndex ? (
                    <p className="mock-exam-feedback-correct">
                      ✅ Correct answer: {question.options[question.correctIndex]}
                    </p>
                  ) : (
                    <>
                      <p className="mock-exam-feedback-wrong">
                        ❌ Wrong answer. Correct answer: {question.options[question.correctIndex]}
                      </p>
                      {question.hint && (
                        <p className="mock-exam-feedback-hint">Hint: {question.hint}</p>
                      )}
                    </>
                  )}
                </div>
              )}
            </section>
          ))}

          {!isSubmitted ? (
            <button
              type="button"
              className="mock-exam-primary-btn"
              disabled={Object.keys(answers).length !== examQuestions.length || isSavingResult}
              onClick={() => void submitExam()}
            >
              {isSavingResult ? "Submitting..." : "Submit Exam"}
            </button>
          ) : (
            <div className="mock-exam-result">
              <div className="mock-exam-result-header">
                <h4>Exam Result Summary</h4>
                <span className="mock-exam-result-status">{resultStatus}</span>
              </div>

              <p className="mock-exam-result-score">
                {score} / {examQuestions.length} <span>({scorePercentage}%)</span>
              </p>

              <div className="mock-exam-result-metrics">
                <span>
                  <strong>Correct</strong>
                  {score}
                </span>
                <span>
                  <strong>Incorrect</strong>
                  {incorrectCount}
                </span>
                <span>
                  <strong>Categories</strong>
                  {selectedCategories.length}
                </span>
              </div>

              <p className="mock-exam-result-note">
                Your exam has been saved in the history tab.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MockExam;
