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

  useEffect(() => {
    function onKeyDown(e) {
      // Ignore if typing in an input
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
        return;
      }
      
      if (e.key === "Enter") {
        e.preventDefault();
        if (summary?.selected_todos?.length && !printing) {
          printTodos();
        }
      } else if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        navigate("/");
      }
    }
    
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [summary, printing, navigate, sessionUid]);

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
    <main
      className="screen summary-screen"
      style={{
        boxSizing: 'border-box',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <div 
        className="summary-card" 
        style={{ 
          maxWidth: '1200px', 
          width: '90%', 
          display: 'flex', 
          flexDirection: 'row',
          gap: '3rem', 
          maxHeight: '85vh', 
          overflow: 'hidden' 
        }}
      >
        
        {/* Left Side: Summary & Actions */}
        <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '2rem', justifyContent: 'center' }}>
          <div>
            <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Session Summary</h1>
            <p className="summary-subtitle" style={{ fontSize: '1rem' }}>Session UID: {sessionUid}</p>
          </div>
          
          <div className="summary-actions" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: 'auto' }}>
            {summary?.selected_todos?.length ? (
              <button 
                className="btn btn-primary" 
                style={{ padding: '1.2rem', fontSize: '1.2rem', whiteSpace: 'nowrap' }} 
                onClick={printTodos} 
                disabled={printing}
              >
                {printing ? "Printing..." : "[ENTER] Print todos"}
              </button>
            ) : null}
            <button 
              className="btn btn-ghost" 
              style={{ padding: '1.2rem', fontSize: '1.2rem' }} 
              onClick={() => navigate("/")}
            >
              [SPACE] Start new session
            </button>
          </div>
        </div>

        {/* Right Side: Scrollable Data */}
        <div style={{ flex: '1.5', overflowY: 'auto', paddingRight: '1rem' }}>
          {!grouped.length ? <p>No responses recorded for this session.</p> : null}

          {grouped.map((group) => (
            <section key={group.imageTitle} className="summary-section" style={{ borderTop: 'none', borderBottom: '1px solid var(--border-color)', margin: 0, paddingBottom: '1.5rem', paddingTop: '1.5rem' }}>
              <h2>{group.imageTitle}</h2>
              {group.rows.map((row) => (
                <article key={row.question_id} className="summary-row" style={{ marginTop: '0.75rem' }}>
                  <h3 style={{ fontSize: '1.1rem' }}>{row.question_prompt}</h3>
                  <p style={{ margin: 0, color: 'var(--text-color)' }}>{row.answer}</p>
                </article>
              ))}
            </section>
          ))}

          {summary?.selected_todos?.length ? (
            <section className="summary-section" style={{ borderTop: 'none', paddingTop: '1.5rem' }}>
              <h2>Suggested Todos</h2>
              {summary.selected_todos.map((todo, index) => (
                <article key={todo.id} className="summary-row" style={{ marginTop: '0.75rem', paddingBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1rem', color: 'var(--subtext-color)' }}>
                    {`${index + 1}. ${formatTimeframe(todo.timeframe)}${todo.category ? ", " : ""}${todo.category || ""}:`}
                  </h3>
                  <p style={{ fontSize: '1.1rem', margin: 0, fontWeight: 'bold' }}>{todo.title}</p>
                </article>
              ))}
            </section>
          ) : null}
        </div>

      </div>
    </main>
  );
}
