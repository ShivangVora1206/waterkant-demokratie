import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";

export default function SummaryPage() {
  const { sessionUid } = useParams();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    api(`/api/sessions/${sessionUid}/summary`)
      .then((data) => setSummary(data))
      .catch((err) => setError(err.message));
  }, [sessionUid]);

  async function printTodos() {
    try {
      setPrinting(true);
      await api(`/api/sessions/${sessionUid}/print-todos`, { method: "POST" });
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setPrinting(false);
    }
  }

  const grouped = useMemo(() => {
    if (!summary) {
      return [];
    }

    const map = new Map();
    for (const item of summary.responses) {
      const key = item.image_id;
      if (!map.has(key)) {
        map.set(key, {
          imageTitle: item.image_title || item.image_display_name || "Untitled image",
          rows: []
        });
      }
      map.get(key).rows.push(item);
    }
    return Array.from(map.values());
  }, [summary]);

  function formatTimeframe(value) {
    if (!value) {
      return "";
    }
    const normalized = String(value).trim();
    return normalized ? normalized[0].toUpperCase() + normalized.slice(1) : "";
  }

  if (error) {
    return <main className="screen"><p className="error-text">{error}</p></main>;
  }

  return (
    <main className="screen summary-screen">
      <div className="summary-card">
        <h1>Session Summary</h1>
        <p className="summary-subtitle">Session UID: {sessionUid}</p>

        {!grouped.length ? <p>No responses recorded for this session.</p> : null}

        {grouped.map((group) => (
          <section key={group.imageTitle} className="summary-section">
            <h2>{group.imageTitle}</h2>
            {group.rows.map((row) => (
              <article key={row.question_id} className="summary-row">
                <h3>{row.question_prompt}</h3>
                <p>{row.answer}</p>
              </article>
            ))}
          </section>
        ))}

        {summary?.selected_todos?.length ? (
          <section className="summary-section">
            <h2>Suggested Todos</h2>
            {summary.selected_todos.map((todo, index) => (
              <article key={todo.id} className="summary-row">
                <h3>
                  {`${index + 1}. ${formatTimeframe(todo.timeframe)}${todo.category ? ", " : ""}${todo.category || ""}:`}
                </h3>
                <p>{todo.title}</p>
              </article>
            ))}
          </section>
        ) : null}

        <div className="summary-actions">
          {summary?.selected_todos?.length ? (
            <button className="btn btn-ghost" onClick={printTodos} disabled={printing}>
              {printing ? "Printing..." : "Print todos"}
            </button>
          ) : null}
          <button className="btn btn-primary" onClick={() => navigate("/")}>Start new session</button>
          {/* <Link className="btn btn-ghost" to="/admin">Admin panel</Link> */}
        </div>
      </div>
    </main>
  );
}
