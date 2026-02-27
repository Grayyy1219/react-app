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
};

type FirebaseQuestion = {
  question?: string;
  options?: string[];
  correctIndex?: number;
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

  const score = useMemo(
    () =>
      examQuestions.reduce((total, question) => {
        const selectedAnswer = answers[question.id];
        return selectedAnswer === question.correctIndex ? total + 1 : total;
      }, 0),
    [answers, examQuestions],
  );

  const toggleCategory = (category: QuestionCategory) => {
    setSelectedCategories((previous) => {
      if (previous.includes(category)) {
        return previous.filter((item) => item !== category);
      }

      return [...previous, category];
    });
  };

  const startExam = () => {
    const selectedQuestions = getShuffledQuestions(availableQuestions).slice(
      0,
      questionCount,
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
        <p>Select categories and number of questions before starting your exam.</p>

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
                max={availableQuestions.length || 1}
                value={questionCount}
                onChange={(event) => setQuestionCount(Number(event.target.value))}
              />
            </label>

            <p className="mock-exam-helptext">
              Available questions for selected categories: {availableQuestions.length}
            </p>

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
          <h3>Mock Exam Questions</h3>
          {examQuestions.map((question, index) => (
            <section key={question.id} className="mock-exam-question-block">
              <p className="mock-exam-question-title">
                {index + 1}. {question.question}
              </p>
              <p className="mock-exam-question-category">{question.category}</p>
              <div className="mock-exam-options">
                {question.options.map((option, optionIndex) => (
                  <label key={`${question.id}-${optionIndex}`} className="mock-exam-option">
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
              <h4>
                Your score: {score} / {examQuestions.length}
              </h4>
              <p>Your exam has been saved in the history tab.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MockExam;
