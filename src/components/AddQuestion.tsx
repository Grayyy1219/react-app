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

type BulkQuestionPayload = {
  question: string;
  category: QuestionCategory;
  options: string[];
  correctIndex: number;
  hint: string;
  status: "approved" | "pending";
  createdAt: number;
};

const parseBulkLine = (line: string, rowNumber: number, selectedCategory: QuestionCategory, isAdmin: boolean) => {
  const columns = line.split("|").map((column) => column.trim()).filter(Boolean);
  const questionText = columns[0] ?? "";

  if (!questionText || columns.length < 3) {
    throw new Error(
      `Invalid row ${rowNumber}. Use format: question|*correct option|wrong option|...|hint:optional hint`,
    );
  }

  const optionTokens = [...columns.slice(1)];
  let hintText = "";

  const lastToken = optionTokens.at(-1);
  if (lastToken?.toLowerCase().startsWith("hint:")) {
    hintText = lastToken.slice(5).trim();
    optionTokens.pop();
  }

  const nextCorrectIndex = optionTokens.findIndex((option) => option.startsWith("*"));

  if (optionTokens.length < 2 || nextCorrectIndex === -1) {
    throw new Error(
      `Invalid row ${rowNumber}. Include at least 2 options and mark exactly one correct option with *`,
    );
  }

  return {
    question: questionText,
    category: selectedCategory,
    options: optionTokens.map((option) => option.replace(/^\*/, "").trim()),
    correctIndex: nextCorrectIndex,
    hint: hintText,
    status: isAdmin ? "approved" : "pending",
    createdAt: Date.now(),
  } satisfies BulkQuestionPayload;
};

const normalizeSpreadsheetToBulkText = (rows: string[][]) => {
  const nonEmptyRows = rows
    .map((row) => row.map((cell) => cell.trim()))
    .filter((row) => row.some(Boolean));

  if (nonEmptyRows.length === 0) {
    return "";
  }

  const firstRow = nonEmptyRows[0].map((cell) => cell.toLowerCase());
  const questionIndex = firstRow.findIndex((cell) => cell.includes("question"));
  const correctIndex = firstRow.findIndex((cell) => cell.includes("correct"));
  const hintIndex = firstRow.findIndex((cell) => cell.includes("hint"));
  const optionIndexes = firstRow.reduce<number[]>((result, cell, index) => {
    if (cell.includes("option") || cell.includes("choice") || cell === "answer") {
      result.push(index);
    }

    return result;
  }, []);

  const hasHeaderMapping = questionIndex !== -1 && correctIndex !== -1;

  const dataRows = hasHeaderMapping ? nonEmptyRows.slice(1) : nonEmptyRows;

  return dataRows
    .map((row) => {
      if (hasHeaderMapping) {
        const question = row[questionIndex]?.trim() ?? "";
        const correct = row[correctIndex]?.trim() ?? "";
        const wrongOptions = optionIndexes
          .filter((index) => index !== correctIndex)
          .map((index) => row[index]?.trim() ?? "")
          .filter(Boolean);

        const nextLine = [question, `*${correct}`, ...wrongOptions];

        if (hintIndex !== -1 && row[hintIndex]?.trim()) {
          nextLine.push(`hint:${row[hintIndex].trim()}`);
        }

        return nextLine.join("|");
      }

      const question = row[0]?.trim() ?? "";
      const correct = row[1]?.trim() ?? "";
      const wrongOptions = row.slice(2).map((value) => value.trim()).filter(Boolean);

      return [question, `*${correct}`, ...wrongOptions].join("|");
    })
    .filter(Boolean)
    .join("\n");
};

function AddQuestion({ isAdmin }: AddQuestionProps) {
  const [entryMode, setEntryMode] = useState<"single" | "bulk">("single");
  const [question, setQuestion] = useState("");
  const [hint, setHint] = useState("");
  const [bulkQuestionsText, setBulkQuestionsText] = useState("");
  const [category, setCategory] = useState<QuestionCategory>("General Information");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [correctIndex, setCorrectIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [submissionsOpen, setSubmissionsOpen] = useState(true);

  React.useEffect(() => {
    if (isAdmin) {
      return;
    }

    const loadSettings = async () => {
      try {
        const response = await fetch(`${FIREBASE_DB_URL}/settings/common/submissionsOpen.json`);

        if (!response.ok) {
          throw new Error("Failed to load submissions setting");
        }

        const value = (await response.json()) as boolean | null;
        setSubmissionsOpen(value ?? true);
      } catch (error) {
        console.error("Unable to load submissions setting", error);
      }
    };

    void loadSettings();
  }, [isAdmin]);

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

  const handleBulkFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const filename = file.name.toLowerCase();

      if (filename.endsWith(".csv") || filename.endsWith(".txt")) {
        const text = await file.text();
        setBulkQuestionsText((previous) => `${previous}${previous ? "\n" : ""}${text.trim()}`);
        event.target.value = "";
        return;
      }

      if (filename.endsWith(".tsv")) {
        const text = await file.text();
        const normalizedRows = text
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => line.split("\t"));
        const convertedBulkText = normalizeSpreadsheetToBulkText(normalizedRows);

        if (!convertedBulkText.trim()) {
          throw new Error("No valid rows found in TSV file.");
        }

        setBulkQuestionsText((previous) =>
          `${previous}${previous && convertedBulkText ? "\n" : ""}${convertedBulkText}`,
        );
        event.target.value = "";
        return;
      }

      throw new Error("Unsupported file type. Please upload .csv, .tsv, or .txt");
    } catch (error) {
      console.error("Unable to parse upload", error);
      alert(error instanceof Error ? error.message : "Failed to parse upload file.");
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedOptions = options.map((option) => option.trim());

    if (!isAdmin && !submissionsOpen) {
      alert("Submissions are temporarily closed by admin.");
      return;
    }

    if (entryMode === "single" && !question.trim()) {
      alert("Please fill in the question.");
      return;
    }

    if (entryMode === "bulk" && !bulkQuestionsText.trim()) {
      alert("Please add or upload bulk questions before submitting.");
      return;
    }

    if (entryMode === "single" && (trimmedOptions.length === 0 || trimmedOptions.some((option) => !option))) {
      alert("Please add at least one answer option.");
      return;
    }

    if (entryMode === "single" && (correctIndex === null || !options[correctIndex]?.trim())) {
      alert("Please select the correct answer.");
      return;
    }

    setIsSaving(true);

    const selectedCategory = category || "General Information";

    try {
      const resourcePath = isAdmin
        ? `questions/${CATEGORY_KEYS[selectedCategory]}`
        : `pendingQuestions/${CATEGORY_KEYS[selectedCategory]}`;

      if (entryMode === "bulk") {
        const rows = bulkQuestionsText
          .split("\n")
          .map((row) => row.trim())
          .filter(Boolean);

        const parsedRows = rows.map((row, index) =>
          parseBulkLine(row, index + 1, selectedCategory, isAdmin),
        );

        const responses = await Promise.all(
          parsedRows.map((payload) =>
            fetch(`${FIREBASE_DB_URL}/${resourcePath}.json`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            }),
          ),
        );

        if (responses.some((response) => !response.ok)) {
          throw new Error("One or more Firebase requests failed");
        }

        setBulkQuestionsText("");
        alert(`Added ${parsedRows.length} questions successfully.`);
      } else {
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
        setOptions(["", ""]);
        setCorrectIndex(null);
        alert(
          isAdmin
            ? "Question added to Firebase."
            : "Question submitted successfully. It will appear after admin approval.",
        );
      }

      setCategory("General Information");
    } catch (error) {
      console.error("Error adding question:", error);
      alert(error instanceof Error ? error.message : "Failed to add question.");
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
            : submissionsOpen
              ? "Contributor mode: submitted questions require admin approval before publishing."
              : "Contributor mode: submissions are currently paused by admin."}
        </p>
        {entryMode === "single" && (
          <>
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
          </>
        )}
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
        {isAdmin && (
          <div className="entry_mode_toggle" role="radiogroup" aria-label="Question entry mode">
            <button
              type="button"
              className={`entry_mode_btn ${entryMode === "single" ? "entry_mode_btn_active" : ""}`}
              onClick={() => setEntryMode("single")}
            >
              Single
            </button>
            <button
              type="button"
              className={`entry_mode_btn ${entryMode === "bulk" ? "entry_mode_btn_active" : ""}`}
              onClick={() => setEntryMode("bulk")}
            >
              Bulk
            </button>
          </div>
        )}
        {entryMode === "single" ? (
          <>
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
          </>
        ) : (
          <div className="bulk_editor">
            <p className="bulk_help_text">
              Paste rows using: question|*correct option|wrong option|...|hint:optional hint
            </p>
            <label className="bulk_upload_label" htmlFor="bulk-file-upload">
              Upload file (.csv, .tsv, .txt)
            </label>
            <input
              id="bulk-file-upload"
              type="file"
              accept=".csv,.tsv,.txt"
              onChange={(event) => {
                void handleBulkFileUpload(event);
              }}
              className="bulk_file_input"
            />
            <textarea
              className="question_input bulk_textarea"
              value={bulkQuestionsText}
              onChange={(event) => setBulkQuestionsText(event.target.value)}
              placeholder="Example: What is 2+2?|*4|3|5|hint:Basic arithmetic"
              rows={8}
            />
          </div>
        )}
        <button type="submit" className="a_q_btn" disabled={isSaving || (!isAdmin && !submissionsOpen)}>
          {isSaving ? "Saving..." : entryMode === "bulk" ? "Bulk Add Questions" : "Add Question"}
        </button>
      </form>
    </div>
  );
}

export default AddQuestion;
