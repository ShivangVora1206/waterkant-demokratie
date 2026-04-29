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
  const [responses, setResponses] = useState([]);
  const [selectedImageId, setSelectedImageId] = useState("");
  const [questionPrompt, setQuestionPrompt] = useState("");
  const [imageTitle, setImageTitle] = useState("");
  const [imageDisplayName, setImageDisplayName] = useState("");
  const [imageOrder, setImageOrder] = useState(0);
  const [imageFile, setImageFile] = useState(null);
  const [notice, setNotice] = useState("");

  const authHeaders = useMemo(() => getAuthHeaders(token), [token]);

  useEffect(() => {
    if (!token) {
      return;
    }
    Promise.all([
      api("/api/admin/images", { headers: authHeaders }),
      api("/api/admin/questions", { headers: authHeaders }),
      api("/api/admin/responses", { headers: authHeaders })
    ])
      .then(([imageRows, questionRows, responseRows]) => {
        setImages(imageRows);
        setQuestions(questionRows);
        setResponses(responseRows);
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
    const result = await api("/api/admin/backup", {
      method: "POST",
      headers: authHeaders
    });
    setNotice(`Backup generated: ${result.file}`);
  }

  async function removeImage(id) {
    await api(`/api/admin/images/${id}`, {
      method: "DELETE",
      headers: authHeaders
    });
    setImages((prev) => prev.filter((row) => row.id !== id));
    setQuestions((prev) => prev.filter((row) => row.image_id !== id));
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
            <a className="btn btn-ghost" href="/api/admin/responses?format=csv" target="_blank" rel="noreferrer">
              Export CSV
            </a>
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
      </div>
    </main>
  );
}
