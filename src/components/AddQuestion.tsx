import React, { useState } from "react";
import "../css/addquestion.css";

const FIREBASE_DB_URL =
  "https://for-mae-default-rtdb.asia-southeast1.firebasedatabase.app";

function AddQuestion() {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const updateOption = (index: number, value: string) => {
    const next = [...options];
    next[index] = value;
    setOptions(next);
  };

  const handleCheckboxChange = (index: number) => {
    setCorrectIndex(index);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!question.trim() || options.some((option) => !option.trim())) {
      alert("Please fill in the question and all 4 options.");
      return;
    }

    if (correctIndex === null) {
      alert("Please select the correct answer.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`${FIREBASE_DB_URL}/questions.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          options: options.map((option) => option.trim()),
          correctIndex,
          createdAt: Date.now(),
        }),
      });

      if (!response.ok) {
        throw new Error("Firebase request failed");
      }

      setQuestion("");
      setOptions(["", "", "", ""]);
      setCorrectIndex(null);
      alert("Question added to Firebase.");
    } catch (error) {
      console.error("Error adding question:", error);
      alert("Failed to add question.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="a_q_form">
      <h2>Add Question</h2>

      <input
        type="text"
        className="question_input"
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        placeholder="Enter your question..."
        required
      />

      <div className="options_container">
        {options.map((option, index) => (
          <div className="option_row" key={index}>
            <input
              type="checkbox"
              checked={correctIndex === index}
              onChange={() => handleCheckboxChange(index)}
              className="correct_checkbox"
            />

            <input
              type="text"
              value={option}
              onChange={(event) => updateOption(index, event.target.value)}
              placeholder={`Option ${index + 1}`}
              required
              className="option_input"
            />
          </div>
        ))}
      </div>

      <button type="submit" className="a_q_btn" disabled={isSaving}>
        {isSaving ? "Saving..." : "Add Question"}
      </button>
    </form>
  );
}

export default AddQuestion;
