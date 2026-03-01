import { useEffect, useMemo, useState } from "react";
import "../css/questioner.css";
import {
  ALL_CATEGORIES,
  CATEGORY_KEYS,
  FIREBASE_DB_URL,
  QUESTION_CATEGORIES,
  type QuestionCategory,
  type QuestionFilter,
} from "../constants/questions";
import {
  getGeneralQuestionStats,
  getUserQuestionStats,
  saveQuestionAttempt,
  toUserKey,
} from "../firebase";

type QuestionItem = {
  id: string;
  question: string;
  category: QuestionCategory;
  options: string[];
  correctIndex: number;
  hint?: string;
};

type FirebaseQuestion = {
  question?: string;
  options?: string[];
  correctIndex?: number;
  hint?: string;
};

const SESSION_KEY = "cse-reviewer-user-session";

type QuestionStat = {
  correct: number;
  wrong: number;
};

const getCurrentSession = () => {
  const rawSession = sessionStorage.getItem(SESSION_KEY);

  if (!rawSession) {
    return null;
  }

  try {
    return JSON.parse(rawSession) as { email?: string };
  } catch {
    return null;
  }
};

const getCurrentUserKey = () => {
  const session = getCurrentSession();
  return session?.email ? toUserKey(session.email) : null;
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
        ...(value.hint?.trim() ? { hint: value.hint.trim() } : {}),
      } satisfies QuestionItem;
    })
    .filter((item): item is QuestionItem => item !== null);
};

const getQuestionWeight = (
  questionId: string,
  userStatsByQuestion: Record<string, QuestionStat>,
  generalStatsByQuestion: Record<string, QuestionStat>,
) => {
  const userStats = userStatsByQuestion[questionId] ?? { correct: 0, wrong: 0 };
  const generalStats = generalStatsByQuestion[questionId] ?? {
    correct: 0,
    wrong: 0,
  };

  const weightedCorrect = userStats.correct + generalStats.correct * 0.35;
  const weightedWrong = userStats.wrong + generalStats.wrong * 0.35;

  return (weightedWrong + 1) / (weightedCorrect + 1);
};

const getWeightedRandomQuestion = (
  questions: QuestionItem[],
  userStatsByQuestion: Record<string, QuestionStat>,
  generalStatsByQuestion: Record<string, QuestionStat>,
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
    weight: getQuestionWeight(
      question.id,
      userStatsByQuestion,
      generalStatsByQuestion,
    ),
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

const shuffleArray = <T,>(items: T[]) => {
  const nextItems = [...items];

  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [nextItems[index], nextItems[swapIndex]] = [
      nextItems[swapIndex],
      nextItems[index],
    ];
  }

  return nextItems;
};

type QuestionerProps = {
  isAdmin?: boolean;
};

const Questioner = ({ isAdmin = false }: QuestionerProps) => {
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [activeFilter, setActiveFilter] =
    useState<QuestionFilter>(ALL_CATEGORIES);
  const [isMultiSelectEnabled, setIsMultiSelectEnabled] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<QuestionCategory[]>(
    [...QUESTION_CATEGORIES],
  );
  const [currentQuestion, setCurrentQuestion] = useState<QuestionItem | null>(
    null,
  );
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [userStatsByQuestion, setUserStatsByQuestion] = useState<
    Record<string, QuestionStat>
  >({});
  const [generalStatsByQuestion, setGeneralStatsByQuestion] = useState<
    Record<string, QuestionStat>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNote, setShowNote] = useState(false);
  const [isNoteConfirmOpen, setIsNoteConfirmOpen] = useState(false);
  const [confirmedHintQuestionId, setConfirmedHintQuestionId] = useState<string | null>(
    null,
  );
  const [userNotes, setUserNotes] = useState<Record<string, string>>({});
  const [noteDraft, setNoteDraft] = useState("");
  const [shuffledOptionIndices, setShuffledOptionIndices] = useState<number[]>(
    [],
  );

  const currentUserKey = getCurrentUserKey();
  const noteStorageKey = currentUserKey
    ? `question-notes-${currentUserKey}`
    : null;

  useEffect(() => {
    if (!noteStorageKey) {
      setUserNotes({});
      return;
    }

    const savedNotes = localStorage.getItem(noteStorageKey);

    if (!savedNotes) {
      setUserNotes({});
      return;
    }

    try {
      setUserNotes(JSON.parse(savedNotes) as Record<string, string>);
    } catch {
      setUserNotes({});
    }
  }, [noteStorageKey]);

  useEffect(() => {
    setShowNote(false);
    setIsNoteConfirmOpen(false);
    setConfirmedHintQuestionId(null);
  }, [currentQuestion]);

  useEffect(() => {
    setNoteDraft(currentQuestion ? (userNotes[currentQuestion.id] ?? "") : "");
  }, [currentQuestion, userNotes]);

  useEffect(() => {
    if (!currentQuestion) {
      setShuffledOptionIndices([]);
      return;
    }

    setShuffledOptionIndices(
      shuffleArray(currentQuestion.options.map((_, index) => index)),
    );
  }, [currentQuestion]);

  useEffect(() => {
    const fetchQuestions = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const userKey = getCurrentUserKey();

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

        const [responses, generalStats, userStats] = await Promise.all([
          Promise.all(questionRequests),
          getGeneralQuestionStats(),
          userKey ? getUserQuestionStats(userKey) : Promise.resolve({}),
        ]);

        setQuestions(responses.flat());
        setGeneralStatsByQuestion(generalStats);
        setUserStatsByQuestion(userStats);
      } catch (fetchError) {
        console.error("Failed to load questions", fetchError);
        setError("Unable to load questions right now.");
      } finally {
        setIsLoading(false);
      }
    };

    void fetchQuestions();
  }, []);

  const filteredQuestions = useMemo(() => {
    if (isMultiSelectEnabled) {
      return questions.filter((question) =>
        selectedCategories.includes(question.category),
      );
    }

    if (activeFilter === ALL_CATEGORIES) {
      return questions;
    }

    return questions.filter((question) => question.category === activeFilter);
  }, [activeFilter, isMultiSelectEnabled, questions, selectedCategories]);

  const moveToNextQuestion = (
    pool: QuestionItem[],
    userStatsMap: Record<string, QuestionStat>,
    generalStatsMap: Record<string, QuestionStat>,
    excludedQuestionId?: string,
  ) => {
    setCurrentQuestion(
      getWeightedRandomQuestion(
        pool,
        userStatsMap,
        generalStatsMap,
        excludedQuestionId,
      ),
    );
    setSelectedIndex(null);
  };

  useEffect(() => {
    if (selectedIndex !== null) {
      return;
    }

    moveToNextQuestion(
      filteredQuestions,
      userStatsByQuestion,
      generalStatsByQuestion,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredQuestions, selectedIndex]);

  const showAnotherQuestion = (filter: QuestionFilter) => {
    if (isMultiSelectEnabled) {
      return;
    }

    setActiveFilter(filter);

    const pool =
      filter === ALL_CATEGORIES
        ? questions
        : questions.filter((question) => question.category === filter);

    moveToNextQuestion(
      pool,
      userStatsByQuestion,
      generalStatsByQuestion,
      currentQuestion?.id,
    );
  };

  const toggleMultiSelectMode = () => {
    if (isMultiSelectEnabled) {
      setIsMultiSelectEnabled(false);
      setActiveFilter(
        selectedCategories.length === 1 ? selectedCategories[0] : ALL_CATEGORIES,
      );
      return;
    }

    setIsMultiSelectEnabled(true);
    setSelectedCategories(
      activeFilter === ALL_CATEGORIES ? [...QUESTION_CATEGORIES] : [activeFilter],
    );
  };

  const toggleCategorySelection = (category: QuestionCategory) => {
    setSelectedCategories((previous) => {
      const isAllSelected = previous.length === QUESTION_CATEGORIES.length;

      if (isAllSelected && previous.includes(category)) {
        return [category];
      }

      if (previous.includes(category)) {
        return previous.length === 1
          ? previous
          : previous.filter((item) => item !== category);
      }

      return [...previous, category];
    });
  };

  const selectAllCategories = () => {
    setSelectedCategories([...QUESTION_CATEGORIES]);
  };

  const handleAnswerSelect = (index: number) => {
    if (!currentQuestion || selectedIndex !== null) {
      return;
    }

    setSelectedIndex(index);

    const answeredCorrectly = index === currentQuestion.correctIndex;
    const userKey = getCurrentUserKey();
    const currentGeneral = generalStatsByQuestion[currentQuestion.id] ?? {
      correct: 0,
      wrong: 0,
    };
    const nextGeneral = answeredCorrectly
      ? { ...currentGeneral, correct: currentGeneral.correct + 1 }
      : { ...currentGeneral, wrong: currentGeneral.wrong + 1 };

    void saveQuestionAttempt(currentQuestion.id, answeredCorrectly, userKey);

    setGeneralStatsByQuestion((previousGeneral) => ({
      ...previousGeneral,
      [currentQuestion.id]: nextGeneral,
    }));

    setUserStatsByQuestion((previous) => {
      const currentStat = previous[currentQuestion.id] ?? {
        correct: 0,
        wrong: 0,
      };
      const nextStat = answeredCorrectly
        ? { ...currentStat, correct: currentStat.correct + 1 }
        : { ...currentStat, wrong: currentStat.wrong + 1 };

      return { ...previous, [currentQuestion.id]: nextStat };
    });
  };

  const saveOwnNote = () => {
    if (!currentQuestion || !noteStorageKey) {
      return;
    }

    const trimmed = noteDraft.trim();
    const nextNotes = { ...userNotes };

    if (trimmed) {
      nextNotes[currentQuestion.id] = trimmed;
    } else {
      delete nextNotes[currentQuestion.id];
    }

    localStorage.setItem(noteStorageKey, JSON.stringify(nextNotes));
    setUserNotes(nextNotes);
  };

  const handleNoteToggle = () => {
    if (!currentQuestion) {
      return;
    }

    if (showNote) {
      setShowNote(false);
      return;
    }

    if (confirmedHintQuestionId === currentQuestion.id) {
      setShowNote(true);
      return;
    }

    setIsNoteConfirmOpen(true);
  };

  const confirmShowNote = () => {
    if (!currentQuestion) {
      return;
    }

    setConfirmedHintQuestionId(currentQuestion.id);
    setShowNote(true);
    setIsNoteConfirmOpen(false);
  };

  const cancelShowNote = () => {
    setIsNoteConfirmOpen(false);
  };

  const handleNextQuestion = () => {
    if (!currentQuestion) {
      return;
    }

    moveToNextQuestion(
      filteredQuestions,
      userStatsByQuestion,
      generalStatsByQuestion,
      currentQuestion.id,
    );
  };

  const isAnswered = selectedIndex !== null && currentQuestion !== null;
  const isCorrectSelection =
    isAnswered &&
    selectedIndex !== null &&
    selectedIndex === currentQuestion.correctIndex;

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

  const adminCurrentStats = currentQuestion
    ? (generalStatsByQuestion[currentQuestion.id] ?? { correct: 0, wrong: 0 })
    : null;

  const shouldShowNoteActions =
    Boolean(currentQuestion?.hint) ||
    Boolean(currentQuestion && currentUserKey);
  const isAllCategoriesSelectedInMulti =
    selectedCategories.length === QUESTION_CATEGORIES.length;

  return (
    <div className="quiz-container">
      <div
        className="category-bar"
        role="group"
        aria-label="Question categories"
      >
        <button
          type="button"
          className={`multiselect-toggle-btn ${isMultiSelectEnabled ? "active" : ""}`}
          onClick={toggleMultiSelectMode}
          aria-pressed={isMultiSelectEnabled}
          title="Toggle multi-select categories"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M4 5h11v2H4V5zm0 6h11v2H4v-2zm0 6h11v2H4v-2zm13.5 2-3.5-3.5 1.4-1.4 2.1 2.1 4.1-4.1 1.4 1.4-5.5 5.5z" />
          </svg>
          Multi
        </button>
        <button
          className={`category-btn ${
            isMultiSelectEnabled
              ? isAllCategoriesSelectedInMulti
                ? "active"
                : ""
              : activeFilter === ALL_CATEGORIES
                ? "active"
                : ""
          }`}
          onClick={() =>
            isMultiSelectEnabled
              ? selectAllCategories()
              : showAnotherQuestion(ALL_CATEGORIES)
          }
        >
          {ALL_CATEGORIES}
        </button>
        {QUESTION_CATEGORIES.map((category) => (
          <button
            key={category}
            className={`category-btn ${
              isMultiSelectEnabled
                ? !isAllCategoriesSelectedInMulti && selectedCategories.includes(category)
                  ? "active"
                  : ""
                : activeFilter === category
                  ? "active"
                  : ""
            }`}
            onClick={() =>
              isMultiSelectEnabled
                ? toggleCategorySelection(category)
                : showAnotherQuestion(category)
            }
          >
            {category}
          </button>
        ))}
      </div>

      <div className="question-box">
        {shouldShowNoteActions && currentQuestion && (
          <button
            type="button"
            className={`hint-icon-btn ${showNote ? "active" : ""}`}
            onClick={handleNoteToggle}
            aria-label={showNote ? "Hide hint" : "Show hint"}
            title={showNote ? "Hide hint" : "Show hint"}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M9 21h6v-1H9v1zm3-20a7 7 0 0 0-4.75 12.14c.52.48 1.2 1.44 1.52 2.38.1.29.38.48.68.48h5.1c.3 0 .58-.19.68-.48.32-.94 1-1.9 1.52-2.38A7 7 0 0 0 12 1zm3.7 11.08c-.63.58-1.4 1.56-1.88 2.92h-3.64c-.48-1.36-1.25-2.34-1.88-2.92A5.5 5.5 0 1 1 15.7 12.08z" />
            </svg>
          </button>
        )}
        {isLoading && "Loading question..."}
        {!isLoading && error && error}
        {!isLoading &&
          !error &&
          !currentQuestion &&
          "No questions found for the selected categories."}
        {!isLoading && !error && currentQuestion && currentQuestion.question}
      </div>

      {shouldShowNoteActions && currentQuestion && (
        <div className="question-note-wrap">
          {showNote && (
            <div className="question-note-card">
              {currentQuestion.hint && (
                <p>
                  <strong>Tip:</strong> {currentQuestion.hint}
                </p>
              )}
              {currentUserKey && (
                <>
                  <label htmlFor="own-note-input">Your note</label>
                  <textarea
                    id="own-note-input"
                    value={noteDraft}
                    onChange={(event) => setNoteDraft(event.target.value)}
                    placeholder="Write your own note for this question..."
                  />
                  <button
                    type="button"
                    className="save-note-btn"
                    onClick={saveOwnNote}
                  >
                    Save note
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {isNoteConfirmOpen && (
        <div className="note-confirm-overlay" role="presentation">
          <div
            className="note-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="note-confirm-title"
          >
            <h3 id="note-confirm-title">View hint?</h3>
            <p>Hints may include direct answers for this question.</p>
            <div className="note-confirm-actions">
              <button
                type="button"
                className="note-confirm-cancel"
                onClick={cancelShowNote}
              >
                Cancel
              </button>
              <button
                type="button"
                className="note-confirm-accept"
                onClick={confirmShowNote}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {isAdmin && adminCurrentStats && (
        <div className="admin-question-stats" aria-label="Question stats">
          <span>✅ Right: {adminCurrentStats.correct}</span>
          <span>❌ Wrong: {adminCurrentStats.wrong}</span>
        </div>
      )}

      {isAnswered && currentQuestion && (
        <div
          className={`answer-feedback ${isCorrectSelection ? "success" : "error"}`}
        >
          {isCorrectSelection
            ? "✅ Correct answer! Showing less of this question over time."
            : `❌ Wrong answer. Correct answer: ${currentQuestion.options[currentQuestion.correctIndex]}. You'll see this more often for practice.`}
        </div>
      )}

      <div className="choices">
        {currentQuestion &&
          shuffledOptionIndices.map((optionIndex, visualIndex) => (
          <button
            key={`${currentQuestion.id}-${optionIndex}`}
            type="button"
            className={`choice ${["red", "blue", "yellow", "green"][visualIndex % 4]} ${getChoiceClassName(optionIndex)}`}
            onClick={() => handleAnswerSelect(optionIndex)}
            disabled={isAnswered}
          >
            {currentQuestion.options[optionIndex]}
          </button>
          ))}
      </div>

      {isAnswered && (
        <button
          type="button"
          className="next-question-btn"
          onClick={handleNextQuestion}
        >
          Next Question
        </button>
      )}
    </div>
  );
};

export default Questioner;
