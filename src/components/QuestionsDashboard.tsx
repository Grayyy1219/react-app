import { useEffect, useMemo, useState } from "react";
import "../css/questions-dashboard.css";
import {
  CATEGORY_KEYS,
  FIREBASE_DB_URL,
  QUESTION_CATEGORIES,
  type QuestionCategory,
} from "../constants/questions";
import { getGeneralQuestionStats } from "../firebase";

type FirebaseQuestion = {
  question?: string;
  category?: QuestionCategory;
  options?: string[];
  correctIndex?: number;
  createdAt?: number;
};

type BaseQuestion = {
  id: string;
  category: QuestionCategory;
  question: string;
  options: string[];
  correctIndex: number;
  createdAt?: number;
};

type QuestionRow = BaseQuestion & {
  correct: number;
  wrong: number;
  attempts: number;
  score: number;
};

type QuestionEditorState = {
  id: string;
  originalCategory: QuestionCategory;
  category: QuestionCategory;
  question: string;
  options: string[];
  correctIndex: number;
  createdAt?: number;
};

type QuestionsDashboardProps = {
  isAdmin?: boolean;
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
    });

    return result;
  }, []);
};

const QuestionsDashboard = ({ isAdmin = false }: QuestionsDashboardProps) => {
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<QuestionEditorState | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchDashboardData = async () => {
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

      const [questionByCategory, statsByQuestion] = await Promise.all([
        Promise.all(questionRequests),
        getGeneralQuestionStats(),
      ]);

      const merged = questionByCategory
        .flat()
        .map((question) => {
          const stats = statsByQuestion[question.id] ?? { correct: 0, wrong: 0 };
          const attempts = stats.correct + stats.wrong;

          return {
            ...question,
            correct: stats.correct,
            wrong: stats.wrong,
            attempts,
            score: stats.wrong * 2 - stats.correct,
          } satisfies QuestionRow;
        })
        .sort((a, b) => b.score - a.score || b.wrong - a.wrong || b.attempts - a.attempts);

      setQuestions(merged);
    } catch (loadError) {
      console.error("Failed to load dashboard data", loadError);
      setError("Unable to load questions dashboard right now.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchDashboardData();
  }, []);

  const totals = useMemo(() => {
    return questions.reduce(
      (summary, question) => {
        summary.correct += question.correct;
        summary.wrong += question.wrong;
        summary.attempts += question.attempts;
        return summary;
      },
      { correct: 0, wrong: 0, attempts: 0 },
    );
  }, [questions]);

  const openEditor = (question: QuestionRow) => {
    setEditor({
      id: question.id,
      originalCategory: question.category,
      category: question.category,
      question: question.question,
      options: [...question.options],
      correctIndex: question.correctIndex,
      createdAt: question.createdAt,
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
          <h1>Questions Ranking Dashboard</h1>
          <p>Track question performance and maintain content quality from one place.</p>
        </div>

        <div className="questions-metrics-grid">
          <article className="metric-card">
            <h3>Total Questions</h3>
            <strong>{questions.length}</strong>
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

        <div className="dashboard-table-wrap">
          {isLoading && <p className="dashboard-state">Loading questions dashboard…</p>}
          {!isLoading && error && <p className="dashboard-state error">{error}</p>}

          {!isLoading && !error && (
            <table className="questions-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Question</th>
                  <th>Category</th>
                  <th>Wrong</th>
                  <th>Correct</th>
                  <th>Attempts</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {questions.map((question, index) => (
                  <tr key={`${question.category}-${question.id}`}>
                    <td>#{index + 1}</td>
                    <td className="question-cell">{question.question}</td>
                    <td>{question.category}</td>
                    <td>{question.wrong}</td>
                    <td>{question.correct}</td>
                    <td>{question.attempts}</td>
                    <td>
                      <button
                        type="button"
                        className="table-action-btn"
                        onClick={() => openEditor(question)}
                        disabled={!isAdmin}
                      >
                        Edit
                      </button>
                    </td>
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
              <input
                type="text"
                value={editor.question}
                onChange={(event) => setEditor({ ...editor, question: event.target.value })}
              />
            </label>

            <label>
              Category
              <select
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
                  <div className="editor-option-row">
                    <input
                      type="radio"
                      name="correctAnswer"
                      checked={editor.correctIndex === index}
                      onChange={() => setEditor({ ...editor, correctIndex: index })}
                      aria-label={`Mark option ${index + 1} as correct`}
                    />
                    <input
                      type="text"
                      value={option}
                      onChange={(event) => updateEditorOption(index, event.target.value)}
                    />
                  </div>
                </label>
              ))}
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
