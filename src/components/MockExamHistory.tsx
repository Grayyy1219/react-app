import { useEffect, useMemo, useState } from "react";
import "../css/mock-exam-history.css";
import {
  getMockExamHistory,
  saveMockExamRecord,
  type MockExamRecord,
  toUserKey,
} from "../firebase";

type MockExamHistoryProps = {
  userEmail: string | null;
};

type HistoryItem = MockExamRecord & { id: string };

type SortOption = "newest" | "oldest" | "score-high" | "score-low";

const getAnswerKey = (question: { id: string; category: string }) =>
  `${question.category}-${question.id}`;

const getAttemptPercentage = (attempt: Pick<MockExamRecord, "score" | "totalQuestions">) => {
  if (attempt.totalQuestions <= 0) {
    return 0;
  }

  return Math.round((attempt.score / attempt.totalQuestions) * 100);
};

const MockExamHistory = ({ userEmail }: MockExamHistoryProps) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);
  const [retakeAnswers, setRetakeAnswers] = useState<Record<string, number>>({});
  const [isRetakeMode, setIsRetakeMode] = useState(false);
  const [isSavingRetake, setIsSavingRetake] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");

  useEffect(() => {
    const loadHistory = async () => {
      if (!userEmail) {
        setHistory([]);
        setSelectedAttemptId(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const records = await getMockExamHistory(toUserKey(userEmail));
        setHistory(records);
      } catch (historyError) {
        console.error("Failed to load mock exam history", historyError);
        setError("Unable to load history right now.");
      } finally {
        setIsLoading(false);
      }
    };

    void loadHistory();
  }, [userEmail]);

  useEffect(() => {
    if (history.length === 0) {
      setSelectedAttemptId(null);
      return;
    }
  }, [history]);

  const selectedAttempt = useMemo(
    () => history.find((item) => item.id === selectedAttemptId) ?? null,
    [history, selectedAttemptId],
  );

  const filteredHistory = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();

    const bySearch = history.filter((item) => {
      if (!normalizedSearch) {
        return true;
      }

      const categories = item.selectedCategories.join(" ").toLowerCase();
      const submittedAt = new Date(item.submittedAt).toLocaleString().toLowerCase();
      const scoreText = `${item.score}/${item.totalQuestions}`;

      return (
        categories.includes(normalizedSearch) ||
        submittedAt.includes(normalizedSearch) ||
        scoreText.includes(normalizedSearch)
      );
    });

    return [...bySearch].sort((a, b) => {
      if (sortBy === "oldest") {
        return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
      }

      if (sortBy === "score-high") {
        return getAttemptPercentage(b) - getAttemptPercentage(a);
      }

      if (sortBy === "score-low") {
        return getAttemptPercentage(a) - getAttemptPercentage(b);
      }

      return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
    });
  }, [history, searchValue, sortBy]);

  const retakeQuestionCount = selectedAttempt?.questions?.length ?? 0;
  const retakeScore = useMemo(() => {
    if (!selectedAttempt?.questions) {
      return 0;
    }

    return selectedAttempt.questions.reduce((total, question) => {
      return retakeAnswers[getAnswerKey(question)] === question.correctIndex ? total + 1 : total;
    }, 0);
  }, [retakeAnswers, selectedAttempt]);

  const retakePercentage =
    retakeQuestionCount > 0 ? Math.round((retakeScore / retakeQuestionCount) * 100) : 0;

  const closeModal = () => {
    setSelectedAttemptId(null);
    setRetakeAnswers({});
    setIsRetakeMode(false);
  };

  const submitRetake = async () => {
    if (!userEmail || !selectedAttempt?.questions || selectedAttempt.questions.length === 0) {
      return;
    }

    setIsSavingRetake(true);
    setError(null);

    try {
      await saveMockExamRecord(toUserKey(userEmail), {
        totalQuestions: selectedAttempt.questions.length,
        score: retakeScore,
        selectedCategories: selectedAttempt.selectedCategories,
        submittedAt: new Date().toISOString(),
        isRetake: true,
        retakeOfAttemptId: selectedAttempt.id,
        questions: selectedAttempt.questions.map((question) => ({
          ...question,
          selectedIndex: retakeAnswers[getAnswerKey(question)]!,
        })),
      });

      const records = await getMockExamHistory(toUserKey(userEmail));
      setHistory(records);
      closeModal();
    } catch (retakeError) {
      console.error("Failed to save mock exam retake", retakeError);
      setError("Unable to save your retake result. Please try again.");
    } finally {
      setIsSavingRetake(false);
    }
  };

  const metrics = useMemo(() => {
    if (history.length === 0) {
      return {
        averageScore: 0,
        bestScore: 0,
        belowTargetCount: 0,
        latestScore: 0,
      };
    }

    const percentages = history.map((item) => getAttemptPercentage(item));

    return {
      averageScore: Math.round(percentages.reduce((total, value) => total + value, 0) / percentages.length),
      bestScore: Math.max(...percentages),
      belowTargetCount: percentages.filter((value) => value < 80).length,
      latestScore: getAttemptPercentage(history[0]),
    };
  }, [history]);

  return (
    <div className="mock-history-page">
      <div className="mock-history-card">
        <div className="mock-history-header">
          <div>
            <h2>Mock Exam History</h2>
            <p className="mock-history-subtitle">
              Review your past attempts, spot weak areas, and launch retakes when needed.
            </p>
          </div>
          {userEmail && !isLoading && !error && history.length > 0 && (
            <span className="mock-history-badge">{history.length} Attempts</span>
          )}
        </div>

        {!userEmail && (
          <p className="mock-history-empty-state">
            Please login first to view your mock exam history.
          </p>
        )}
        {userEmail && isLoading && <p className="mock-history-empty-state">Loading history...</p>}
        {userEmail && !isLoading && error && <p className="mock-history-error">{error}</p>}

        {userEmail && !isLoading && !error && history.length === 0 && (
          <p className="mock-history-empty-state">You have not taken any mock exam yet.</p>
        )}

        {userEmail && !isLoading && !error && history.length > 0 && (
          <>
            <section className="mock-history-metrics" aria-live="polite">
              <article className="mock-history-metric-card">
                <span>Average score</span>
                <strong>{metrics.averageScore}%</strong>
              </article>
              <article className="mock-history-metric-card">
                <span>Best score</span>
                <strong>{metrics.bestScore}%</strong>
              </article>
              <article className="mock-history-metric-card">
                <span>Latest score</span>
                <strong>{metrics.latestScore}%</strong>
              </article>
              <article className="mock-history-metric-card warning">
                <span>Below 80%</span>
                <strong>{metrics.belowTargetCount}</strong>
              </article>
            </section>

            <section className="mock-history-controls" aria-label="History controls">
              <label className="mock-history-control-field">
                <span>Search</span>
                <input
                  type="text"
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Category, score, or date"
                />
              </label>

              <label className="mock-history-control-field">
                <span>Sort by</span>
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortOption)}>
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="score-high">Highest score</option>
                  <option value="score-low">Lowest score</option>
                </select>
              </label>
            </section>

            {filteredHistory.length === 0 ? (
              <p className="mock-history-empty-state">No attempts match your current search.</p>
            ) : (
              <ul className="mock-history-list">
                {filteredHistory.map((item) => {
                  const percentage = getAttemptPercentage(item);
                  const canRetake = percentage < 80 && (item.questions?.length ?? 0) > 0;

                  return (
                    <li key={item.id} className="mock-history-item">
                      <div className="mock-history-item-header">
                        <p className="mock-history-item-score">
                          {item.score} / {item.totalQuestions}
                          <span>{percentage}%</span>
                        </p>
                        <div className="mock-history-item-meta">
                          {item.isRetake && <span className="mock-history-retake-tag">Retake</span>}
                          <span className="mock-history-item-date">
                            {new Date(item.submittedAt).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div className="mock-history-score-track" role="presentation">
                        <span style={{ width: `${Math.min(percentage, 100)}%` }} />
                      </div>

                      <p className="mock-history-item-categories">
                        <strong>Categories:</strong> {item.selectedCategories.join(", ")}
                      </p>

                      <div className="mock-history-item-footer">
                        <button
                          type="button"
                          className="mock-history-view-btn"
                          onClick={() => {
                            setSelectedAttemptId(item.id);
                            setIsRetakeMode(false);
                            setRetakeAnswers({});
                          }}
                        >
                          View Attempt Details
                        </button>

                        {canRetake && (
                          <p className="mock-history-retake-note">Score below 80% — retake available.</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>

      {selectedAttempt && (
        <div className="mock-history-modal-overlay" role="presentation" onClick={closeModal}>
          <div
            className="mock-history-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Attempt details"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mock-history-modal-header">
              <h3>{isRetakeMode ? "Retake Mock Exam" : "Attempt Details"}</h3>
              <button type="button" className="mock-history-modal-close" onClick={closeModal}>
                ✕
              </button>
            </div>

            {!selectedAttempt.questions || selectedAttempt.questions.length === 0 ? (
              <p className="mock-history-details-empty">
                This attempt was saved before detailed review was available.
              </p>
            ) : isRetakeMode ? (
              <>
                <p className="mock-history-subtitle">Answer all questions to save a new retake record.</p>
                <ol className="mock-history-question-list">
                  {selectedAttempt.questions.map((question, index) => (
                    <li key={`${selectedAttempt.id}-${question.id}`} className="mock-history-question-item">
                      <p className="mock-history-question-title">
                        {index + 1}. {question.question}
                      </p>
                      <p className="mock-history-question-meta">{question.category}</p>
                      <div className="mock-history-retake-options">
                        {question.options.map((option, optionIndex) => (
                          <label key={`${question.id}-${optionIndex}`} className="mock-history-retake-option">
                            <input
                              type="radio"
                              name={`retake-${question.id}`}
                              checked={retakeAnswers[getAnswerKey(question)] === optionIndex}
                              onChange={() =>
                                setRetakeAnswers((previous) => ({
                                  ...previous,
                                  [getAnswerKey(question)]: optionIndex,
                                }))
                              }
                            />
                            <span>{option}</span>
                          </label>
                        ))}
                      </div>
                    </li>
                  ))}
                </ol>

                <div className="mock-history-retake-footer">
                  <p className="mock-history-retake-progress">
                    {Object.keys(retakeAnswers).length}/{retakeQuestionCount} answered
                  </p>
                  <button
                    type="button"
                    className="mock-history-view-btn"
                    disabled={Object.keys(retakeAnswers).length !== retakeQuestionCount || isSavingRetake}
                    onClick={() => void submitRetake()}
                  >
                    {isSavingRetake ? "Submitting..." : `Submit Retake (${retakePercentage}%)`}
                  </button>
                </div>
              </>
            ) : (
              <>
                <ol className="mock-history-question-list">
                  {selectedAttempt.questions.map((question) => {
                    const selectedOption = question.options[question.selectedIndex];
                    const correctOption = question.options[question.correctIndex];
                    const isCorrect = question.selectedIndex === question.correctIndex;

                    return (
                      <li key={`${selectedAttempt.id}-${question.id}`} className="mock-history-question-item">
                        <p className="mock-history-question-title">{question.question}</p>
                        <p className="mock-history-question-meta">{question.category}</p>
                        <p className={`mock-history-question-answer ${isCorrect ? "is-correct" : "is-wrong"}`}>
                          <strong>Your answer:</strong> {selectedOption ?? "No answer"}
                        </p>
                        {!isCorrect && (
                          <p className="mock-history-question-correct-answer">
                            <strong>Correct answer:</strong> {correctOption}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ol>

                {getAttemptPercentage(selectedAttempt) < 80 && (
                  <button
                    type="button"
                    className="mock-history-view-btn"
                    onClick={() => {
                      setIsRetakeMode(true);
                      setRetakeAnswers({});
                    }}
                  >
                    Retake Exam
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MockExamHistory;
