import React, { useState } from "react";
import "../css/addquestion.css";
import {
  CATEGORY_KEYS,
  FIREBASE_DB_URL,
  QUESTION_CATEGORIES,
  type QuestionCategory,
} from "../constants/questions";

function AddQuestion() {
  const [question, setQuestion] = useState("");
  const [category, setCategory] = useState<QuestionCategory>("General Information");
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

    const selectedCategory = category || "General Information";

    try {
      const response = await fetch(
        `${FIREBASE_DB_URL}/questions/${CATEGORY_KEYS[selectedCategory]}.json`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: question.trim(),
            category: selectedCategory,
            options: options.map((option) => option.trim()),
            correctIndex,
            createdAt: Date.now(),
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Firebase request failed");
      }

      setQuestion("");
      setCategory("General Information");
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
    <div className="questioner_div">
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
        <div className="category_field">
          <label htmlFor="question-category" className="category_label">
            Category
          </label>
          <select
            id="question-category"
            className="category_select"
            value={category}
            onChange={(event) => setCategory(event.target.value as QuestionCategory)}
          >
            {QUESTION_CATEGORIES.map((categoryOption) => (
              <option key={categoryOption} value={categoryOption}>
                {categoryOption}
              </option>
            ))}
          </select>
        </div>
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
    </div>
  );
}

export default AddQuestion;
