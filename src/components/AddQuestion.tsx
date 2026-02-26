import React, { useState } from "react";
import "../css/addquestion.css";
import {
  CATEGORY_KEYS,
  FIREBASE_DB_URL,
  QUESTION_CATEGORIES,
  type QuestionCategory,
} from "../constants/questions";

type AddQuestionProps = {
  isAdmin: boolean;
};

function AddQuestion({ isAdmin }: AddQuestionProps) {
  const [question, setQuestion] = useState("");
  const [hint, setHint] = useState("");
  const [category, setCategory] = useState<QuestionCategory>("General Information");
  const [options, setOptions] = useState<string[]>(["", ""]);
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

  const addOption = () => {
    setOptions((previous) => [...previous, ""]);
  };

  const removeOption = (index: number) => {
    setOptions((previous) => previous.filter((_, optionIndex) => optionIndex !== index));
    setCorrectIndex((previous) => {
      if (previous === null) {
        return previous;
      }

      if (previous === index) {
        return null;
      }

      return previous > index ? previous - 1 : previous;
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedOptions = options.map((option) => option.trim());

    if (!question.trim()) {
      alert("Please fill in the question.");
      return;
    }

    if (trimmedOptions.length === 0 || trimmedOptions.some((option) => !option)) {
      alert("Please add at least one answer option.");
      return;
    }

    if (correctIndex === null || !options[correctIndex]?.trim()) {
      alert("Please select the correct answer.");
      return;
    }

    setIsSaving(true);

    const selectedCategory = category || "General Information";

    try {
      const resourcePath = isAdmin
        ? `questions/${CATEGORY_KEYS[selectedCategory]}`
        : `pendingQuestions/${CATEGORY_KEYS[selectedCategory]}`;
      const response = await fetch(`${FIREBASE_DB_URL}/${resourcePath}.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          category: selectedCategory,
          options: trimmedOptions,
          correctIndex,
          hint: hint.trim(),
          status: isAdmin ? "approved" : "pending",
          createdAt: Date.now(),
        }),
      });

      if (!response.ok) {
        throw new Error("Firebase request failed");
      }

      setQuestion("");
      setHint("");
      setCategory("General Information");
      setOptions(["", ""]);
      setCorrectIndex(null);
      alert(
        isAdmin
          ? "Question added to Firebase."
          : "Question submitted successfully. It will appear after admin approval.",
      );
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
        <p className="submission_notice">
          {isAdmin
            ? "Admin mode: your submission is published immediately."
            : "Contributor mode: submitted questions require admin approval before publishing."}
        </p>
        <textarea
          className="question_input"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Enter your question..."
          rows={3}
          required
        />
        <textarea
          className="question_input"
          value={hint}
          onChange={(event) => setHint(event.target.value)}
          placeholder="Optional hint / note for this question"
          rows={3}
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
            <div className={`option_row ${correctIndex === index ? "option_row_selected" : ""}`} key={index}>
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
              {options.length > 1 && (
                <button
                  type="button"
                  className="option_remove_btn"
                  onClick={() => removeOption(index)}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
        <button type="button" className="option_add_btn" onClick={addOption}>
          + Add answer option
        </button>
        <button type="submit" className="a_q_btn" disabled={isSaving}>
          {isSaving ? "Saving..." : "Add Question"}
        </button>
      </form>
    </div>
  );
}

export default AddQuestion;
