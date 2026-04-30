import { useEffect, useMemo, useState } from "react";
import { api, getAuthHeaders, jsonHeaders } from "../../api.js";

function AdminLogin({ onLoggedIn }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    try {
      const result = await api("/api/admin/login", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ username, password })
      });
      onLoggedIn(result.token);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="screen admin-screen">
      <div className="admin-card auth-card">
        <h1>Admin Login</h1>
        <form onSubmit={submit} className="stack-form">
          <label>
            Username
            <input value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error ? <p className="error-text">{error}</p> : null}
          <button className="btn btn-primary" type="submit">Sign in</button>
        </form>
      </div>
    </main>
  );
}

export default function AdminPage() {
  const [token, setToken] = useState(localStorage.getItem("adminToken") || "");
  const [images, setImages] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [todos, setTodos] = useState([]);
  const [responses, setResponses] = useState([]);
  const [printerSettings, setPrinterSettings] = useState(null);
  const [selectedImageId, setSelectedImageId] = useState("");
  const [questionPrompt, setQuestionPrompt] = useState("");
  const [imageTitle, setImageTitle] = useState("");
  const [imageDisplayName, setImageDisplayName] = useState("");
  const [imageOrder, setImageOrder] = useState(0);
  const [imageFile, setImageFile] = useState(null);
  const [todoTitle, setTodoTitle] = useState("");
  const [todoDetails, setTodoDetails] = useState("");
  const [todoTimeframe, setTodoTimeframe] = useState("");
  const [todoCategory, setTodoCategory] = useState("");
  const [todoEffort, setTodoEffort] = useState("low");
  const [notice, setNotice] = useState("");

  const authHeaders = useMemo(() => getAuthHeaders(token), [token]);

  useEffect(() => {
    if (!token) {
      return;
    }
    Promise.all([
      api("/api/admin/images", { headers: authHeaders }),
      api("/api/admin/questions", { headers: authHeaders }),
      api("/api/admin/todos", { headers: authHeaders }),
      api("/api/admin/responses", { headers: authHeaders }),
      api("/api/admin/printer-settings", { headers: authHeaders })
    ])
      .then(([imageRows, questionRows, todoRows, responseRows, printerRow]) => {
        setImages(imageRows);
        setQuestions(questionRows);
        setTodos(todoRows);
        setResponses(responseRows);
        setPrinterSettings(printerRow);
      })
      .catch((err) => setNotice(err.message));
  }, [token, authHeaders]);

  if (!token) {
    return (
      <AdminLogin
        onLoggedIn={(newToken) => {
          localStorage.setItem("adminToken", newToken);
          setToken(newToken);
        }}
      />
    );
  }

  async function uploadImage(event) {
    event.preventDefault();
    if (!imageFile) {
      setNotice("Please choose an image file.");
      return;
    }

    const formData = new FormData();
    formData.append("image", imageFile);
    formData.append("title", imageTitle);
    formData.append("display_name", imageDisplayName);
    formData.append("order_index", String(imageOrder));

    const response = await fetch("/api/admin/images", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setNotice(body.error || "Image upload failed");
      return;
    }

    const created = await response.json();
    setImages((prev) => [...prev, created]);
    setImageTitle("");
    setImageDisplayName("");
    setImageOrder(0);
    setImageFile(null);
    setNotice("Image uploaded.");
  }

  async function createQuestion(event) {
    event.preventDefault();
    if (!selectedImageId || !questionPrompt.trim()) {
      setNotice("Pick an image and enter a question prompt.");
      return;
    }

    const question = await api("/api/admin/questions", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ image_id: Number(selectedImageId), prompt: questionPrompt, required: true })
    });

    setQuestions((prev) => [...prev, question]);
    setQuestionPrompt("");
    setNotice("Question created.");
  }

  async function triggerBackup() {
    try {
      const result = await api("/api/admin/backup", {
        method: "POST",
        headers: authHeaders
      });

      const downloadResponse = await fetch(result.download_url, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!downloadResponse.ok) {
        const body = await downloadResponse.json().catch(() => ({}));
        throw new Error(body.error || "Backup download failed");
      }

      const blob = await downloadResponse.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = result.file || "backup.tar.gz";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);

      setNotice(`Backup generated and downloaded: ${result.file}`);
    } catch (err) {
      setNotice(err.message);
    }
  }

  async function exportCsv() {
    try {
      const response = await fetch("/api/admin/responses?format=csv", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "CSV export failed");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = "responses.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setNotice(err.message);
    }
  }

  async function removeImage(id) {
    await api(`/api/admin/images/${id}`, {
      method: "DELETE",
      headers: authHeaders
    });
    setImages((prev) => prev.filter((row) => row.id !== id));
    setQuestions((prev) => prev.filter((row) => row.image_id !== id));
  }

  async function createTodo(event) {
    event.preventDefault();
    if (!todoTitle.trim()) {
      setNotice("Please enter a todo title.");
      return;
    }

    const todo = await api("/api/admin/todos", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        title: todoTitle,
        details: todoDetails,
        timeframe: todoTimeframe,
        category: todoCategory,
        effort: todoEffort,
        is_active: true
      })
    });

    setTodos((prev) => [todo, ...prev]);
    setTodoTitle("");
    setTodoDetails("");
    setTodoTimeframe("");
    setTodoCategory("");
    setTodoEffort("low");
    setNotice("Todo created.");
  }

  async function toggleTodoActive(todo) {
    const updated = await api(`/api/admin/todos/${todo.id}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({
        title: todo.title,
        details: todo.details,
        timeframe: todo.timeframe,
        category: todo.category,
        effort: todo.effort,
        is_active: !todo.is_active
      })
    });

    setTodos((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
  }

  async function removeTodo(id) {
    await api(`/api/admin/todos/${id}`, {
      method: "DELETE",
      headers: authHeaders
    });
    setTodos((prev) => prev.filter((row) => row.id !== id));
  }

  async function savePrinterConfig(event) {
    event.preventDefault();
    if (!printerSettings) {
      return;
    }

    const updated = await api("/api/admin/printer-settings", {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify(printerSettings)
    });

    setPrinterSettings(updated);
    setNotice("Printer settings saved.");
  }

  async function testPrinter() {
    const result = await api("/api/admin/printer-settings/test-print", {
      method: "POST",
      headers: authHeaders
    });
    if (result.ok) {
      setNotice("Printer test sent.");
    }
  }

  return (
    <main className="screen admin-screen">
      <div className="admin-card">
        <header className="admin-header">
          <h1>Demokratie Admin</h1>
          <button
            className="btn btn-ghost"
            onClick={() => {
              localStorage.removeItem("adminToken");
              setToken("");
            }}
          >
            Logout
          </button>
        </header>

        {notice ? <p className="notice-text">{notice}</p> : null}

        <section className="admin-section">
          <h2>Images</h2>
          <form onSubmit={uploadImage} className="stack-form">
            <label>
              Image file
              <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
            </label>
            <label>
              Title
              <input value={imageTitle} onChange={(e) => setImageTitle(e.target.value)} />
            </label>
            <label>
              Display name
              <input value={imageDisplayName} onChange={(e) => setImageDisplayName(e.target.value)} />
            </label>
            <label>
              Order index
              <input type="number" value={imageOrder} onChange={(e) => setImageOrder(Number(e.target.value))} />
            </label>
            <button className="btn btn-primary" type="submit">Upload image</button>
          </form>

          <ul className="admin-list">
            {images.map((image) => (
              <li key={image.id}>
                <div>
                  <strong>{image.title || image.display_name || image.filename}</strong>
                  <p>{image.image_uid}</p>
                </div>
                <button className="btn btn-ghost" onClick={() => removeImage(image.id)}>Delete</button>
              </li>
            ))}
          </ul>
        </section>

        <section className="admin-section">
          <h2>Questions</h2>
          <form onSubmit={createQuestion} className="stack-form">
            <label>
              Image
              <select value={selectedImageId} onChange={(e) => setSelectedImageId(e.target.value)}>
                <option value="">Select image</option>
                {images.map((image) => (
                  <option key={image.id} value={image.id}>
                    {image.title || image.display_name || image.filename}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Prompt
              <input value={questionPrompt} onChange={(e) => setQuestionPrompt(e.target.value)} />
            </label>
            <button className="btn btn-primary" type="submit">Add question</button>
          </form>

          <ul className="admin-list">
            {questions.map((question) => (
              <li key={question.id}>
                <div>
                  <strong>{question.prompt}</strong>
                  <p>Image #{question.image_id}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="admin-section">
          <h2>Responses</h2>
          <div className="admin-actions">
            <button className="btn btn-ghost" onClick={exportCsv}>
              Export CSV
            </button>
            <button className="btn btn-primary" onClick={triggerBackup}>Create Backup</button>
          </div>
          <ul className="admin-list compact">
            {responses.slice(0, 20).map((response) => (
              <li key={response.id}>
                <strong>{response.question_prompt}</strong>
                <p>{response.answer}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="admin-section">
          <h2>Todos</h2>
          <form onSubmit={createTodo} className="stack-form">
            <label>
              Title
              <input value={todoTitle} onChange={(e) => setTodoTitle(e.target.value)} />
            </label>
            <label>
              Details
              <input value={todoDetails} onChange={(e) => setTodoDetails(e.target.value)} />
            </label>
            <label>
              Timeframe
              <input value={todoTimeframe} onChange={(e) => setTodoTimeframe(e.target.value)} placeholder="e.g. 2026-2030" />
            </label>
            <label>
              Category
              <input value={todoCategory} onChange={(e) => setTodoCategory(e.target.value)} placeholder="e.g. Wohnen" />
            </label>
            <label>
              Effort
              <select value={todoEffort} onChange={(e) => setTodoEffort(e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <button className="btn btn-primary" type="submit">Add todo</button>
          </form>

          <ul className="admin-list">
            {todos.map((todo) => (
              <li key={todo.id}>
                <div>
                  <strong>{todo.title}</strong>
                  {todo.details ? <p>{todo.details}</p> : null}
                  <p>
                    <small>
                      {todo.category ? `Category: ${todo.category} | ` : ""}
                      {todo.timeframe ? `Timeframe: ${todo.timeframe} | ` : ""}
                      {todo.effort ? `Effort: ${todo.effort}` : ""}
                    </small>
                  </p>
                  <p>Status: {todo.is_active ? "Active" : "Inactive"}</p>
                </div>
                <div className="admin-actions">
                  <button className="btn btn-ghost" onClick={() => toggleTodoActive(todo)}>
                    {todo.is_active ? "Deactivate" : "Activate"}
                  </button>
                  <button className="btn btn-ghost" onClick={() => removeTodo(todo.id)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="admin-section">
          <h2>Receipt Printer</h2>
          {printerSettings ? (
            <form onSubmit={savePrinterConfig} className="stack-form">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={Boolean(printerSettings.enabled)}
                  onChange={(e) => setPrinterSettings((prev) => ({ ...prev, enabled: e.target.checked }))}
                />
                Enabled
              </label>
              <label>
                Host
                <input
                  value={printerSettings.host || ""}
                  onChange={(e) => setPrinterSettings((prev) => ({ ...prev, host: e.target.value }))}
                  placeholder="192.168.1.50"
                />
              </label>
              <label>
                Port
                <input
                  type="number"
                  value={printerSettings.port || 9100}
                  onChange={(e) => setPrinterSettings((prev) => ({ ...prev, port: Number(e.target.value) }))}
                />
              </label>
              <label>
                Receipt title
                <input
                  value={printerSettings.receipt_title || ""}
                  onChange={(e) => setPrinterSettings((prev) => ({ ...prev, receipt_title: e.target.value }))}
                />
              </label>
              <label>
                Footer text
                <input
                  value={printerSettings.footer_text || ""}
                  onChange={(e) => setPrinterSettings((prev) => ({ ...prev, footer_text: e.target.value }))}
                />
              </label>
              <label>
                Barcode message
                <input
                  value={printerSettings.barcode_message || ""}
                  onChange={(e) => setPrinterSettings((prev) => ({ ...prev, barcode_message: e.target.value }))}
                />
              </label>
              <label>
                Paper width
                <input
                  type="number"
                  value={printerSettings.paper_width || 42}
                  onChange={(e) => setPrinterSettings((prev) => ({ ...prev, paper_width: Number(e.target.value) }))}
                />
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={Boolean(printerSettings.cut_paper)}
                  onChange={(e) => setPrinterSettings((prev) => ({ ...prev, cut_paper: e.target.checked }))}
                />
                Cut paper after print
              </label>
              <div className="admin-actions">
                <button className="btn btn-primary" type="submit">Save printer settings</button>
                <button className="btn btn-ghost" type="button" onClick={testPrinter}>Print test receipt</button>
              </div>
            </form>
          ) : null}
        </section>
      </div>
    </main>
  );
}
