import { useEffect, useMemo, useState } from "react";
import "../css/mock-exam-history.css";
import { getMockExamHistory, type MockExamRecord, toUserKey } from "../firebase";

type MockExamHistoryProps = {
  userEmail: string | null;
};

type HistoryItem = MockExamRecord & { id: string };

const MockExamHistory = ({ userEmail }: MockExamHistoryProps) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadHistory = async () => {
      if (!userEmail) {
        setHistory([]);
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

                return (
                  <li key={item.id} className="mock-history-item">
                    <div className="mock-history-item-header">
                      <p className="mock-history-item-score">
                        {item.score} / {item.totalQuestions}
                        <span>{percentage}%</span>
                      </p>
                      <span className="mock-history-item-date">
                        {new Date(item.submittedAt).toLocaleString()}
                      </span>
                    </div>

                    <p className="mock-history-item-categories">
                      <strong>Categories:</strong> {item.selectedCategories.join(", ")}
                    </p>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
};

export default MockExamHistory;
