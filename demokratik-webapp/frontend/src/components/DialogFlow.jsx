import { useEffect, useRef, useState } from "react";
import { api, jsonHeaders } from "../api.js";

export default function DialogFlow({ image, sessionUid, open, onClose, onCompleted }) {
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open || !image) {
      return;
    }

    api(`/api/images/${image.id}/questions`)
      .then((data) => {
        setQuestions(data);
        setIndex(0);
        setAnswer("");
        setError("");
      })
      .catch((err) => setError(err.message));
  }, [open, image]);

  useEffect(() => {
    if (open && questions.length > 0) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, index, questions.length]);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    if (open) {
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }
  }, [open, onClose]);

  if (!open || !image) {
    return null;
  }

  if (!questions.length) {
    return (
      <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-label="No questions available">
        <div className="dialog-card">
          <h2 className="dialog-title">No Questions</h2>
          <p className="dialog-copy">This image has no questions yet.</p>
          <div className="dialog-actions">
            <button className="btn btn-primary" onClick={() => onCompleted()}>
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[index];

  async function submitCurrent(event) {
    event.preventDefault();
    if (!currentQuestion) {
      return;
    }

    if (currentQuestion.required && !answer.trim()) {
      setError("Please enter an answer before continuing.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await api("/api/responses", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          session_uid: sessionUid,
          image_id: image.id,
          question_id: currentQuestion.id,
          answer
        })
      });

      if (index === questions.length - 1) {
        onCompleted();
      } else {
        setIndex(index + 1);
        setAnswer("");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-label="Question dialog">
      <div className="dialog-card">
        <p className="dialog-step">
          Question {index + 1} of {questions.length}
        </p>
        <h2 className="dialog-title">{currentQuestion.prompt}</h2>
        <form onSubmit={submitCurrent}>
          <textarea
            ref={inputRef}
            className="dialog-input"
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submitCurrent(e);
              }
            }}
            rows={4}
            aria-label="Answer input"
            placeholder="Write your response here... (Press Enter to submit)"
          />
          {error ? <p className="error-text">{error}</p> : null}
          <div className="dialog-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
              ESC: Close
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {index === questions.length - 1 ? "ENTER: Finish image" : "ENTER: Next question"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
