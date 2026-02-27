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

const getAnswerKey = (question: { id: string; category: string }) =>
  `${question.category}-${question.id}`;

const MockExamHistory = ({ userEmail }: MockExamHistoryProps) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);
  const [retakeAnswers, setRetakeAnswers] = useState<Record<string, number>>({});
  const [isRetakeMode, setIsRetakeMode] = useState(false);
  const [isSavingRetake, setIsSavingRetake] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const averageScore = useMemo(() => {
    if (history.length === 0) {
      return 0;
    }

    const totalPercentage = history.reduce((runningTotal, item) => {
      if (item.totalQuestions === 0) {
        return runningTotal;
      }

      return runningTotal + (item.score / item.totalQuestions) * 100;
    }, 0);

    return Math.round(totalPercentage / history.length);
  }, [history]);

  return (
    <div className="mock-history-page">
      <div className="mock-history-card">
        <div className="mock-history-header">
          <h2>Mock Exam History</h2>
          {userEmail && !isLoading && !error && history.length > 0 && (
            <span className="mock-history-badge">{history.length} Attempts</span>
          )}
        </div>
        <p className="mock-history-subtitle">
          Track your previous attempts and monitor your performance over time.
        </p>

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
            <div className="mock-history-summary" aria-live="polite">
              <span>
                <strong>Attempts</strong>
                {history.length}
              </span>
              <span>
                <strong>Average Score</strong>
                {averageScore}%
              </span>
            </div>

            <ul className="mock-history-list">
              {history.map((item) => {
                const percentage =
                  item.totalQuestions > 0
                    ? Math.round((item.score / item.totalQuestions) * 100)
                    : 0;
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

                    <p className="mock-history-item-categories">
                      <strong>Categories:</strong> {item.selectedCategories.join(", ")}
                    </p>

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
                    {canRetake && <p className="mock-history-retake-note">Score below 80% — retake available.</p>}
                  </li>
                );
              })}
            </ul>
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

                {selectedAttempt.totalQuestions > 0 &&
                  Math.round((selectedAttempt.score / selectedAttempt.totalQuestions) * 100) < 80 && (
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
