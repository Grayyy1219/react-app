import { useEffect, useState } from "react";
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

  return (
    <div className="mock-history-page">
      <div className="mock-history-card">
        <h2>Mock Exam History</h2>

        {!userEmail && <p>Please login first to view your mock exam history.</p>}
        {userEmail && isLoading && <p>Loading history...</p>}
        {userEmail && !isLoading && error && <p className="mock-history-error">{error}</p>}

        {userEmail && !isLoading && !error && history.length === 0 && (
          <p>You have not taken any mock exam yet.</p>
        )}

        {userEmail && !isLoading && !error && history.length > 0 && (
          <ul className="mock-history-list">
            {history.map((item) => (
              <li key={item.id} className="mock-history-item">
                <p>
                  <strong>Score:</strong> {item.score} / {item.totalQuestions}
                </p>
                <p>
                  <strong>Categories:</strong> {item.selectedCategories.join(", ")}
                </p>
                <p>
                  <strong>Taken at:</strong>{" "}
                  {new Date(item.submittedAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default MockExamHistory;
