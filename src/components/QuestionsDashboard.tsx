import { useCallback, useEffect, useMemo, useState } from "react";
import "../css/questions-dashboard.css";
import {
  CATEGORY_KEYS,
  FIREBASE_DB_URL,
  QUESTION_CATEGORIES,
  type QuestionCategory,
} from "../constants/questions";
import { getGeneralQuestionStats, getUserQuestionStats, toUserKey } from "../firebase";

type FirebaseQuestion = {
  question?: string;
  category?: QuestionCategory;
  options?: string[];
  correctIndex?: number;
  createdAt?: number;
  hint?: string;
};

type BaseQuestion = {
  id: string;
  category: QuestionCategory;
  question: string;
  options: string[];
  correctIndex: number;
  createdAt?: number;
  hint?: string;
};

type QuestionRow = BaseQuestion & {
  correct: number;
  wrong: number;
  attempts: number;
  score: number;
  rank: number;
};

type QuestionStat = {
  correct: number;
  wrong: number;
};

type SortKey = "rank" | "question" | "category" | "wrong" | "correct" | "attempts";
type SortDirection = "asc" | "desc";

type QuestionEditorState = {
  id: string;
  originalCategory: QuestionCategory;
  category: QuestionCategory;
  question: string;
  options: string[];
  correctIndex: number;
  createdAt?: number;
  hint?: string;
};

type QuestionsDashboardProps = {
  isAdmin?: boolean;
  userEmail?: string | null;
};

const normalizeQuestions = (
  category: QuestionCategory,
  payload: Record<string, FirebaseQuestion> | null,
): BaseQuestion[] => {
  if (!payload) {
    return [];
  }

  return Object.entries(payload).reduce<BaseQuestion[]>((result, [id, value]) => {
    const options = value.options;
    const correctIndex = value.correctIndex;
    const hasValidOptions =
      Array.isArray(options) && options.length > 0 && options.every((item) => Boolean(item?.trim()));
    const hasValidCorrectIndex =
      typeof correctIndex === "number" &&
      correctIndex >= 0 &&
      hasValidOptions &&
      correctIndex < options.length;

    if (!value.question?.trim() || !hasValidOptions || !hasValidCorrectIndex) {
      return result;
    }

    result.push({
      id,
      category,
      question: value.question.trim(),
      options: options.map((option) => option.trim()),
      correctIndex,
      ...(typeof value.createdAt === "number" ? { createdAt: value.createdAt } : {}),
      ...(value.hint?.trim() ? { hint: value.hint.trim() } : {}),
    });

    return result;
  }, []);
};

const QuestionsDashboard = ({ isAdmin = false, userEmail = null }: QuestionsDashboardProps) => {
  const [questions, setQuestions] = useState<BaseQuestion[]>([]);
  const [generalStatsByQuestion, setGeneralStatsByQuestion] = useState<Record<string, QuestionStat>>({});
  const [userStatsByQuestion, setUserStatsByQuestion] = useState<Record<string, QuestionStat>>({});
  const [statsScope, setStatsScope] = useState<"global" | "mine">(() =>
    userEmail ? "mine" : "global",
  );
  const [sortBy, setSortBy] = useState<SortKey>("rank");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<QuestionEditorState | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const hasLoggedInUser = Boolean(userEmail);

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const questionRequests = QUESTION_CATEGORIES.map(async (category) => {
        const response = await fetch(`${FIREBASE_DB_URL}/questions/${CATEGORY_KEYS[category]}.json`);

        if (!response.ok) {
          throw new Error(`Failed to fetch ${category}`);
        }

        const data = (await response.json()) as Record<string, FirebaseQuestion> | null;
        return normalizeQuestions(category, data);
      });

      const [questionByCategory, globalStats] = await Promise.all([
        Promise.all(questionRequests),
        getGeneralQuestionStats(),
      ]);

      const nextUserStats = hasLoggedInUser
        ? await getUserQuestionStats(toUserKey(userEmail ?? ""))
        : {};

      setQuestions(questionByCategory.flat());
      setGeneralStatsByQuestion(globalStats);
      setUserStatsByQuestion(nextUserStats);
    } catch (loadError) {
      console.error("Failed to load dashboard data", loadError);
      setError("Unable to load questions dashboard right now.");
    } finally {
      setIsLoading(false);
    }
  }, [hasLoggedInUser, userEmail]);

  useEffect(() => {
    void fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    setStatsScope(hasLoggedInUser ? "mine" : "global");
  }, [hasLoggedInUser]);

  const activeStatsByQuestion = statsScope === "mine" ? userStatsByQuestion : generalStatsByQuestion;

  const questionRows = useMemo(() => {
    const rows = questions
      .map((question) => {
        const stats = activeStatsByQuestion[question.id] ?? { correct: 0, wrong: 0 };
        const attempts = stats.correct + stats.wrong;

        return {
          ...question,
          correct: stats.correct,
          wrong: stats.wrong,
          attempts,
          score: stats.wrong * 2 - stats.correct,
          rank: 0,
        } satisfies QuestionRow;
      });

    const rankedRows = [...rows].sort(
      (a, b) => b.score - a.score || b.wrong - a.wrong || b.attempts - a.attempts,
    );

    const rankByQuestionId = rankedRows.reduce<Record<string, number>>((result, row, index) => {
      result[row.id] = index + 1;
      return result;
    }, {});

    return rows.map((row) => ({
      ...row,
      rank: rankByQuestionId[row.id] ?? 0,
    }));
  }, [activeStatsByQuestion, questions]);

  const sortedQuestionRows = useMemo(() => {
    const rows = [...questionRows];
    const rankingComparator = (a: QuestionRow, b: QuestionRow) => a.rank - b.rank;

    rows.sort((a, b) => {
      if (sortBy === "rank") {
        return sortDirection === "asc" ? -rankingComparator(a, b) : rankingComparator(a, b);
      }

      if (sortBy === "question") {
        const result = a.question.localeCompare(b.question);
        return sortDirection === "asc" ? result : -result;
      }

      if (sortBy === "category") {
        const result = a.category.localeCompare(b.category);
        return sortDirection === "asc" ? result : -result;
      }

      const numericResult = a[sortBy] - b[sortBy];
      return sortDirection === "asc" ? numericResult : -numericResult;
    });

    return rows;
  }, [questionRows, sortBy, sortDirection]);

  const totals = useMemo(() => {
    return sortedQuestionRows.reduce(
      (summary, question) => {
        summary.correct += question.correct;
        summary.wrong += question.wrong;
        summary.attempts += question.attempts;
        return summary;
      },
      { correct: 0, wrong: 0, attempts: 0 },
    );
  }, [sortedQuestionRows]);

  const updateSort = (nextSortKey: SortKey) => {
    if (sortBy === nextSortKey) {
      setSortDirection((currentDirection) => (currentDirection === "asc" ? "desc" : "asc"));
      return;
    }

    setSortBy(nextSortKey);
    setSortDirection(nextSortKey === "question" || nextSortKey === "category" ? "asc" : "desc");
  };

  const sortLabel = (key: SortKey) => {
    if (sortBy !== key) {
      return "";
    }

    return sortDirection === "asc" ? " ↑" : " ↓";
  };

  const openEditor = (question: QuestionRow) => {
    setEditor({
      id: question.id,
      originalCategory: question.category,
      category: question.category,
      question: question.question,
      options: [...question.options],
      correctIndex: question.correctIndex,
      createdAt: question.createdAt,
      hint: question.hint ?? "",
    });
  };

  const updateEditorOption = (index: number, value: string) => {
    if (!editor) {
      return;
    }

    const nextOptions = [...editor.options];
    nextOptions[index] = value;
    setEditor({ ...editor, options: nextOptions });
  };

  const addEditorOption = () => {
    if (!editor) {
      return;
    }

    setEditor({ ...editor, options: [...editor.options, ""] });
  };

  const removeEditorOption = (index: number) => {
    if (!editor || editor.options.length <= 1) {
      return;
    }

    const nextOptions = editor.options.filter((_, optionIndex) => optionIndex !== index);
    let nextCorrectIndex = editor.correctIndex;

    if (editor.correctIndex === index) {
      nextCorrectIndex = 0;
    } else if (editor.correctIndex > index) {
      nextCorrectIndex = editor.correctIndex - 1;
    }

    setEditor({ ...editor, options: nextOptions, correctIndex: nextCorrectIndex });
  };

  const handleSaveQuestion = async () => {
    if (!editor || !isAdmin) {
      return;
    }

    const trimmedQuestion = editor.question.trim();
    const trimmedOptions = editor.options.map((option) => option.trim());

    if (!trimmedQuestion || trimmedOptions.some((option) => !option)) {
      alert("Please fill in the question and all options before saving.");
      return;
    }

    if (editor.correctIndex < 0 || editor.correctIndex >= trimmedOptions.length) {
      alert("Please pick a valid correct answer.");
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        question: trimmedQuestion,
        category: editor.category,
        options: trimmedOptions,
        correctIndex: editor.correctIndex,
        createdAt: editor.createdAt ?? Date.now(),
        updatedAt: Date.now(),
        hint: editor.hint?.trim() ?? "",
      };

      const targetPath = `${FIREBASE_DB_URL}/questions/${CATEGORY_KEYS[editor.category]}/${editor.id}.json`;

      if (editor.originalCategory !== editor.category) {
        const deleteResponse = await fetch(
          `${FIREBASE_DB_URL}/questions/${CATEGORY_KEYS[editor.originalCategory]}/${editor.id}.json`,
          { method: "DELETE" },
        );

        if (!deleteResponse.ok) {
          throw new Error("Failed to move question from previous category");
        }
      }

      const saveResponse = await fetch(targetPath, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!saveResponse.ok) {
        throw new Error("Failed to save question details");
      }

      setEditor(null);
      await fetchDashboardData();
    } catch (saveError) {
      console.error("Failed to save question", saveError);
      alert("Unable to save question. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="questions-dashboard-page">
      <div className="questions-dashboard-shell">
        <div className="questions-dashboard-header">
          <div className="questions-dashboard-title-row">
            <h1>Questions Ranking Dashboard</h1>
            <button
              type="button"
              className="rank-tooltip-trigger"
              title="Rank is calculated by score (wrong × 2 − correct). Ties are broken by more wrong answers, then more attempts."
              aria-label="How ranking works"
            >
              ?
            </button>
          </div>
          <p>Track question performance and maintain content quality from one place.</p>
        </div>

        <div className="questions-metrics-grid">
          <article className="metric-card">
            <h3>Total Questions</h3>
            <strong>{sortedQuestionRows.length}</strong>
          </article>
          <article className="metric-card">
            <h3>Total Correct</h3>
            <strong>{totals.correct}</strong>
          </article>
          <article className="metric-card">
            <h3>Total Wrong</h3>
            <strong>{totals.wrong}</strong>
          </article>
          <article className="metric-card">
            <h3>Total Attempts</h3>
            <strong>{totals.attempts}</strong>
          </article>
        </div>

        {hasLoggedInUser && (
          <div
            className={`stats-toggle ${statsScope === "mine" ? "stats-toggle-mine" : "stats-toggle-global"}`}
            role="group"
            aria-label="Stats scope"
          >
            <button
              type="button"
              className={`stats-toggle-btn ${statsScope === "mine" ? "active" : ""}`}
              onClick={() => setStatsScope("mine")}
            >
              My Stats
            </button>
            <button
              type="button"
              className={`stats-toggle-btn ${statsScope === "global" ? "active" : ""}`}
              onClick={() => setStatsScope("global")}
            >
              Global Stats
            </button>
          </div>
        )}

        <div className="dashboard-table-wrap">
          {isLoading && <p className="dashboard-state">Loading questions dashboard…</p>}
          {!isLoading && error && <p className="dashboard-state error">{error}</p>}

          {!isLoading && !error && (
            <table className="questions-table">
              <thead>
                <tr>
                  <th>
                    <button type="button" className="header-sort-btn" onClick={() => updateSort("rank")}>
                      Rank{sortLabel("rank")}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="header-sort-btn" onClick={() => updateSort("question")}>
                      Question{sortLabel("question")}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="header-sort-btn" onClick={() => updateSort("category")}>
                      Category{sortLabel("category")}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="header-sort-btn" onClick={() => updateSort("wrong")}>
                      Wrong{sortLabel("wrong")}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="header-sort-btn" onClick={() => updateSort("correct")}>
                      Correct{sortLabel("correct")}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="header-sort-btn" onClick={() => updateSort("attempts")}>
                      Attempts{sortLabel("attempts")}
                    </button>
                  </th>
                  {isAdmin && <th>Action</th>}
                </tr>
              </thead>
              <tbody>
                {sortedQuestionRows.map((question) => (
                  <tr key={`${question.category}-${question.id}`}>
                    <td data-label="Rank" className="colmin">#{question.rank}</td>
                    <td className="question-cell" data-label="Question">{question.question}</td>
                    <td data-label="Category">{question.category}</td>
                    <td data-label="Wrong">{question.wrong}</td>
                    <td data-label="Correct">{question.correct}</td>
                    <td data-label="Attempts">{question.attempts}</td>
                    {isAdmin && (
                      <td data-label="Action">
                        <button
                          type="button"
                          className="table-action-btn"
                          onClick={() => openEditor(question)}
                        >
                          Edit
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {editor && (
        <div className="editor-modal-backdrop" role="presentation" onClick={() => setEditor(null)}>
          <div
            className="editor-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Edit question"
            onClick={(event) => event.stopPropagation()}
          >
            <h2>Edit Question</h2>
            <label>
              Question
              <textarea
                className="question_input"
                value={editor.question}
                onChange={(event) => setEditor({ ...editor, question: event.target.value })}
                rows={3}
              />
            </label>

            <label>
              Hint / note
              <textarea
                className="question_input"
                value={editor.hint ?? ""}
                onChange={(event) => setEditor({ ...editor, hint: event.target.value })}
                rows={3}
              />
            </label>

            <label className="category_field">
              Category
              <select
                className="category_select"
                value={editor.category}
                onChange={(event) =>
                  setEditor({ ...editor, category: event.target.value as QuestionCategory })
                }
              >
                {QUESTION_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <div className="editor-options">
              {editor.options.map((option, index) => (
                <label key={`${editor.id}-${index}`}>
                  Option {index + 1}
                  <div className={`editor-option-row option_row ${editor.correctIndex === index ? "option_row_selected" : ""}`}>
                    <input
                      type="radio"
                      className="correct_checkbox"
                      name="correctAnswer"
                      checked={editor.correctIndex === index}
                      onChange={() => setEditor({ ...editor, correctIndex: index })}
                      aria-label={`Mark option ${index + 1} as correct`}
                    />
                    <input
                      type="text"
                      className="option_input"
                      value={option}
                      onChange={(event) => updateEditorOption(index, event.target.value)}
                    />
                    {editor.options.length > 1 && (
                      <button
                        type="button"
                        className="option_remove_btn"
                        onClick={() => removeEditorOption(index)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </label>
              ))}
              <button type="button" className="option_add_btn" onClick={addEditorOption}>
                + Add answer option
              </button>
            </div>

            <div className="editor-actions">
              <button type="button" onClick={() => setEditor(null)} className="secondary-btn">
                Cancel
              </button>
              <button
                type="button"
                className="primary-btn"
                onClick={() => void handleSaveQuestion()}
                disabled={!isAdmin || isSaving}
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default QuestionsDashboard;
