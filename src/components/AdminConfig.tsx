import { useCallback, useEffect, useMemo, useState } from "react";
import "../css/admin-config.css";
import {
  CATEGORY_KEYS,
  FIREBASE_DB_URL,
  QUESTION_CATEGORIES,
  type QuestionCategory,
} from "../constants/questions";

type PendingQuestion = {
  id: string;
  category: QuestionCategory;
  question: string;
  options: string[];
  correctIndex: number;
  hint?: string;
  createdAt?: number;
};

type CommonAdminSettings = {
  submissionsOpen: boolean;
  autoPublishAdminEdits: boolean;
};

type FirebaseQuestionPayload = {
  question?: string;
  options?: string[];
  correctIndex?: number;
  hint?: string;
  createdAt?: number;
};

const DEFAULT_SETTINGS: CommonAdminSettings = {
  submissionsOpen: true,
  autoPublishAdminEdits: true,
};

const settingsResource = `${FIREBASE_DB_URL}/settings/common.json`;

const normalizePendingQuestions = (
  category: QuestionCategory,
  payload: Record<string, FirebaseQuestionPayload> | null,
): PendingQuestion[] => {
  if (!payload) {
    return [];
  }

  return Object.entries(payload).reduce<PendingQuestion[]>((result, [id, rawValue]) => {
    const question = rawValue.question?.trim();
    const options = rawValue.options?.map((option) => option.trim()) ?? [];
    const correctIndex = rawValue.correctIndex;

    if (!question || options.length === 0 || options.some((option) => !option)) {
      return result;
    }

    if (typeof correctIndex !== "number" || correctIndex < 0 || correctIndex >= options.length) {
      return result;
    }

    result.push({
      id,
      category,
      question,
      options,
      correctIndex,
      ...(rawValue.hint?.trim() ? { hint: rawValue.hint.trim() } : {}),
      ...(typeof rawValue.createdAt === "number" ? { createdAt: rawValue.createdAt } : {}),
    });

    return result;
  }, []);
};

function AdminConfig() {
  const [settings, setSettings] = useState<CommonAdminSettings>(DEFAULT_SETTINGS);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);

  const [pendingQuestions, setPendingQuestions] = useState<PendingQuestion[]>([]);
  const [isLoadingPending, setIsLoadingPending] = useState(true);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [processingQuestionId, setProcessingQuestionId] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      const response = await fetch(settingsResource);

      if (!response.ok) {
        throw new Error("Failed to load settings");
      }

      const data = (await response.json()) as Partial<CommonAdminSettings> | null;

      setSettings({
        submissionsOpen: data?.submissionsOpen ?? DEFAULT_SETTINGS.submissionsOpen,
        autoPublishAdminEdits:
          data?.autoPublishAdminEdits ?? DEFAULT_SETTINGS.autoPublishAdminEdits,
      });
      setSettingsMessage(null);
    } catch (error) {
      console.error("Unable to load common admin settings", error);
      setSettingsMessage("Unable to load settings right now.");
    }
  }, []);

  const loadPendingQuestions = useCallback(async () => {
    setIsLoadingPending(true);
    setPendingMessage(null);

    try {
      const requests = QUESTION_CATEGORIES.map(async (category) => {
        const response = await fetch(
          `${FIREBASE_DB_URL}/pendingQuestions/${CATEGORY_KEYS[category]}.json`,
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch pending ${category}`);
        }

        const data = (await response.json()) as Record<string, FirebaseQuestionPayload> | null;
        return normalizePendingQuestions(category, data);
      });

      const groupedPending = await Promise.all(requests);
      const sortedPending = groupedPending
        .flat()
        .sort((left, right) => (right.createdAt ?? 0) - (left.createdAt ?? 0));

      setPendingQuestions(sortedPending);
    } catch (error) {
      console.error("Unable to load pending questions", error);
      setPendingMessage("Unable to load user submissions right now.");
    } finally {
      setIsLoadingPending(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
    void loadPendingQuestions();
  }, [loadPendingQuestions, loadSettings]);

  const pendingCountByCategory = useMemo(() => {
    return pendingQuestions.reduce<Record<QuestionCategory, number>>(
      (result, question) => {
        result[question.category] += 1;
        return result;
      },
      {
        "General Information": 0,
        "Verbal Ability": 0,
        "Analytical Ability": 0,
        "Numerical Ability": 0,
      },
    );
  }, [pendingQuestions]);

  const saveSettings = async () => {
    setIsSavingSettings(true);
    setSettingsMessage(null);

    try {
      const response = await fetch(settingsResource, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error("Failed to save settings");
      }

      setSettingsMessage("Settings saved.");
    } catch (error) {
      console.error("Unable to save settings", error);
      setSettingsMessage("Saving failed. Please try again.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const removeFromPending = async (question: PendingQuestion) => {
    const response = await fetch(
      `${FIREBASE_DB_URL}/pendingQuestions/${CATEGORY_KEYS[question.category]}/${question.id}.json`,
      { method: "DELETE" },
    );

    if (!response.ok) {
      throw new Error("Failed to remove pending question");
    }
  };

  const handleApprove = async (question: PendingQuestion) => {
    setProcessingQuestionId(question.id);
    setPendingMessage(null);

    try {
      const publishResponse = await fetch(
        `${FIREBASE_DB_URL}/questions/${CATEGORY_KEYS[question.category]}.json`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: question.question,
            category: question.category,
            options: question.options,
            correctIndex: question.correctIndex,
            hint: question.hint ?? "",
            status: "approved",
            createdAt: question.createdAt ?? Date.now(),
            reviewedAt: Date.now(),
          }),
        },
      );

      if (!publishResponse.ok) {
        throw new Error("Failed to publish approved question");
      }

      await removeFromPending(question);
      setPendingQuestions((current) => current.filter((item) => item.id !== question.id));
      setPendingMessage("Question approved and published.");
    } catch (error) {
      console.error("Unable to approve question", error);
      setPendingMessage("Approving question failed.");
    } finally {
      setProcessingQuestionId(null);
    }
  };

  const handleReject = async (question: PendingQuestion) => {
    setProcessingQuestionId(question.id);
    setPendingMessage(null);

    try {
      await removeFromPending(question);
      setPendingQuestions((current) => current.filter((item) => item.id !== question.id));
      setPendingMessage("Question rejected and removed from queue.");
    } catch (error) {
      console.error("Unable to reject question", error);
      setPendingMessage("Rejecting question failed.");
    } finally {
      setProcessingQuestionId(null);
    }
  };

  return (
    <section className="admin-config-page">
      <div className="admin-config-shell">
        <div className="admin-config-header">
          <h1>Config</h1>
          <p>Manage common admin settings and review user-submitted questions.</p>
        </div>

        <article className="admin-config-card">
          <h2>Common Admin Settings</h2>

          <label className="admin-setting-row">
            <input
              type="checkbox"
              checked={settings.submissionsOpen}
              onChange={(event) =>
                setSettings({ ...settings, submissionsOpen: event.target.checked })
              }
            />
            <span>Allow contributors to submit questions</span>
          </label>

          <label className="admin-setting-row">
            <input
              type="checkbox"
              checked={settings.autoPublishAdminEdits}
              onChange={(event) =>
                setSettings({ ...settings, autoPublishAdminEdits: event.target.checked })
              }
            />
            <span>Auto-publish edits made by admins</span>
          </label>

          <div className="admin-actions-row">
            <button
              type="button"
              className="admin-action-btn admin-action-primary"
              onClick={() => void saveSettings()}
              disabled={isSavingSettings}
            >
              {isSavingSettings ? "Saving..." : "Save settings"}
            </button>
            {settingsMessage && <p className="admin-inline-message">{settingsMessage}</p>}
          </div>
        </article>

        <article className="admin-config-card">
          <div className="admin-review-header">
            <h2>Review User-Submitted Questions</h2>
            <button
              type="button"
              className="admin-action-btn"
              onClick={() => void loadPendingQuestions()}
            >
              Refresh
            </button>
          </div>

          <div className="admin-metrics-grid">
            {QUESTION_CATEGORIES.map((category) => (
              <article key={category} className="admin-metric-card">
                <h3>{category}</h3>
                <strong>{pendingCountByCategory[category]}</strong>
              </article>
            ))}
          </div>

          {isLoadingPending && <p className="admin-inline-message">Loading submissions...</p>}
          {!isLoadingPending && pendingQuestions.length === 0 && (
            <p className="admin-inline-message">No pending submissions.</p>
          )}
          {!isLoadingPending && pendingMessage && (
            <p className="admin-inline-message">{pendingMessage}</p>
          )}

          {!isLoadingPending && pendingQuestions.length > 0 && (
            <div className="admin-pending-list">
              {pendingQuestions.map((question) => {
                const isProcessing = processingQuestionId === question.id;

                return (
                  <article key={`${question.category}-${question.id}`} className="admin-pending-card">
                    <div className="admin-pending-top">
                      <span className="admin-category-pill">{question.category}</span>
                      <small>
                        {question.createdAt
                          ? new Date(question.createdAt).toLocaleString()
                          : "Unknown date"}
                      </small>
                    </div>

                    <h3>{question.question}</h3>
                    {question.hint && <p className="admin-pending-hint">Hint: {question.hint}</p>}

                    <ol>
                      {question.options.map((option, index) => (
                        <li
                          key={`${question.id}-${index}`}
                          className={question.correctIndex === index ? "admin-correct-option" : ""}
                        >
                          {option}
                          {question.correctIndex === index && (
                            <span className="admin-correct-badge">Correct</span>
                          )}
                        </li>
                      ))}
                    </ol>

                    <div className="admin-actions-row admin-actions-right">
                      <button
                        type="button"
                        className="admin-action-btn"
                        onClick={() => void handleReject(question)}
                        disabled={isProcessing}
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        className="admin-action-btn admin-action-primary"
                        onClick={() => void handleApprove(question)}
                        disabled={isProcessing}
                      >
                        {isProcessing ? "Processing..." : "Approve"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </article>
      </div>
    </section>
  );
}

export default AdminConfig;
