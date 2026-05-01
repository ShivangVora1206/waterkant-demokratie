import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DialogFlow from "../components/DialogFlow.jsx";
import { api, jsonHeaders } from "../api.js";

export default function ViewerPage() {
  const [images, setImages] = useState([]);
  const [sessionUid, setSessionUid] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [openDialog, setOpenDialog] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    async function bootstrap() {
      try {
        const session = await api("/api/sessions", {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({})
        });
        setSessionUid(session.session_uid);

        const list = await api("/api/images");
        setImages(list);
        if (list.length > 0) {
          setCurrentIndex(Math.floor(Math.random() * list.length));
        }
      } catch (err) {
        setError(err.message);
      }
    }

    bootstrap();
  }, []);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Enter" && !openDialog && images.length) {
        setOpenDialog(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openDialog, images.length]);

  const currentImage = useMemo(() => images[currentIndex], [images, currentIndex]);

  async function handleImageCompleted() {
    if (!currentImage) {
      return;
    }

    setOpenDialog(false);

    try {
      await api(`/api/sessions/${sessionUid}/complete`, { method: "POST" });
      navigate(`/summary/${sessionUid}`);
    } catch (err) {
      setError(err.message);
    }
  }

  if (error) {
    return <main className="screen"><p className="error-text">{error}</p></main>;
  }

  if (!images.length) {
    return (
      <main className="screen">
        <div className="center-card">
          <h1>Demokratie</h1>
          <p>No images are configured yet. Open Admin to add images and questions.</p>
          <a className="btn btn-primary" href="/admin">Open Admin</a>
        </div>
      </main>
    );
  }

  return (
    <main className="screen image-screen">
      <img className="fullscreen-image" src={currentImage.media_url} alt={currentImage.title || "Presentation image"} />
      <div className="overlay-hint">
        {/* <p>{currentImage.title || currentImage.display_name || "Untitled image"}</p> */}
        <button className="btn btn-primary" onClick={() => setOpenDialog(true)}>Press Enter to answer</button>
      </div>

      <DialogFlow
        image={currentImage}
        sessionUid={sessionUid}
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        onCompleted={handleImageCompleted}
      />
    </main>
  );
}
