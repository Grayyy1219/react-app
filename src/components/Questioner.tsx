import { useEffect, useMemo, useRef, useState } from "react";
import "../css/questioner.css";
import {
  ALL_CATEGORIES,
  CATEGORY_KEYS,
  FIREBASE_DB_URL,
  QUESTION_CATEGORIES,
  type QuestionCategory,
  type QuestionFilter,
} from "../constants/questions";

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

const FEEDBACK_DELAY_MS = 1200;

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
      const hasValidOptions = Array.isArray(options) && options.length > 0 && options.every(Boolean);
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

const getQuestionWeight = (questionId: string, masteryByQuestion: Record<string, number>) => {
  const mastery = masteryByQuestion[questionId] ?? 0;

  if (mastery >= 0) {
    return 1 / (1 + mastery);
  }

  return 1 + Math.abs(mastery) * 1.5;
};

const getWeightedRandomQuestion = (
  questions: QuestionItem[],
  masteryByQuestion: Record<string, number>,
  excludedQuestionId?: string,
) => {
  if (questions.length === 0) {
    return null;
  }

  const pool =
    excludedQuestionId && questions.length > 1
      ? questions.filter((question) => question.id !== excludedQuestionId)
      : questions;

  if (pool.length === 0) {
    return null;
  }

  const weightedPool = pool.map((question) => ({
    question,
    weight: getQuestionWeight(question.id, masteryByQuestion),
  }));

  const totalWeight = weightedPool.reduce((sum, item) => sum + item.weight, 0);
  let randomPoint = Math.random() * totalWeight;

  for (const item of weightedPool) {
    randomPoint -= item.weight;
    if (randomPoint <= 0) {
      return item.question;
    }
  }

  return weightedPool[weightedPool.length - 1].question;
};

const Questioner = () => {
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<QuestionFilter>(ALL_CATEGORIES);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionItem | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [masteryByQuestion, setMasteryByQuestion] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const answerTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const fetchQuestions = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const responses = await Promise.all(
          QUESTION_CATEGORIES.map(async (category) => {
            const response = await fetch(
              `${FIREBASE_DB_URL}/questions/${CATEGORY_KEYS[category]}.json`,
            );

            if (!response.ok) {
              throw new Error(`Failed to fetch ${category}`);
            }

            const data = (await response.json()) as Record<string, FirebaseQuestion> | null;
            return normalizeQuestions(category, data);
          }),
        );

        setQuestions(responses.flat());
      } catch (fetchError) {
        console.error("Failed to load questions", fetchError);
        setError("Unable to load questions right now.");
      } finally {
        setIsLoading(false);
      }
    };

    void fetchQuestions();
  }, []);

  useEffect(() => {
    return () => {
      if (answerTimeoutRef.current) {
        window.clearTimeout(answerTimeoutRef.current);
      }
    };
  }, []);

  const filteredQuestions = useMemo(() => {
    if (activeFilter === ALL_CATEGORIES) {
      return questions;
    }

    return questions.filter((question) => question.category === activeFilter);
  }, [activeFilter, questions]);

  const moveToNextQuestion = (
    pool: QuestionItem[],
    masteryMap: Record<string, number>,
    excludedQuestionId?: string,
  ) => {
    setCurrentQuestion(getWeightedRandomQuestion(pool, masteryMap, excludedQuestionId));
    setSelectedIndex(null);
  };

  useEffect(() => {
    moveToNextQuestion(filteredQuestions, masteryByQuestion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredQuestions]);

  const showAnotherQuestion = (filter: QuestionFilter) => {
    if (answerTimeoutRef.current) {
      window.clearTimeout(answerTimeoutRef.current);
    }

    setActiveFilter(filter);

    const pool =
      filter === ALL_CATEGORIES
        ? questions
        : questions.filter((question) => question.category === filter);

    moveToNextQuestion(pool, masteryByQuestion, currentQuestion?.id);
  };

  const handleAnswerSelect = (index: number) => {
    if (!currentQuestion || selectedIndex !== null) {
      return;
    }

    if (answerTimeoutRef.current) {
      window.clearTimeout(answerTimeoutRef.current);
    }

    setSelectedIndex(index);

    const answeredCorrectly = index === currentQuestion.correctIndex;

    setMasteryByQuestion((previous) => {
      const nextValue = (previous[currentQuestion.id] ?? 0) + (answeredCorrectly ? 1 : -1);
      const nextMap = { ...previous, [currentQuestion.id]: nextValue };

      answerTimeoutRef.current = window.setTimeout(() => {
        moveToNextQuestion(filteredQuestions, nextMap, currentQuestion.id);
      }, FEEDBACK_DELAY_MS);

      return nextMap;
    });
  };

  const isAnswered = selectedIndex !== null && currentQuestion !== null;
  const isCorrectSelection =
    isAnswered && selectedIndex !== null && selectedIndex === currentQuestion.correctIndex;

  const getChoiceClassName = (index: number) => {
    if (!isAnswered || !currentQuestion) {
      return "";
    }

    if (index === currentQuestion.correctIndex) {
      return "choice-correct";
    }

    if (index === selectedIndex) {
      return "choice-wrong";
    }

    return "choice-muted";
  };

  return (
    <div className="quiz-container">
      <div className="category-bar" role="group" aria-label="Question categories">
        <button
          className={`category-btn ${activeFilter === ALL_CATEGORIES ? "active" : ""}`}
          onClick={() => showAnotherQuestion(ALL_CATEGORIES)}
        >
          {ALL_CATEGORIES}
        </button>
        {QUESTION_CATEGORIES.map((category) => (
          <button
            key={category}
            className={`category-btn ${activeFilter === category ? "active" : ""}`}
            onClick={() => showAnotherQuestion(category)}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="question-box">
        {isLoading && "Loading question..."}
        {!isLoading && error && error}
        {!isLoading && !error && !currentQuestion && "No questions found for this category."}
        {!isLoading && !error && currentQuestion && currentQuestion.question}
      </div>

      {isAnswered && currentQuestion && (
        <div className={`answer-feedback ${isCorrectSelection ? "success" : "error"}`}>
          {isCorrectSelection
            ? "✅ Correct answer! Showing less of this question over time."
            : `❌ Wrong answer. Correct answer: ${currentQuestion.options[currentQuestion.correctIndex]}. You'll see this more often for practice.`}
        </div>
      )}

      <div className="choices">
        {currentQuestion?.options.map((option, index) => (
          <button
            key={`${currentQuestion.id}-${index}`}
            type="button"
            className={`choice ${["red", "blue", "yellow", "green"][index % 4]} ${getChoiceClassName(index)}`}
            onClick={() => handleAnswerSelect(index)}
            disabled={isAnswered}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
};

export default Questioner;
