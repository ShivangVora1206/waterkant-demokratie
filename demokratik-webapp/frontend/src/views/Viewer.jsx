import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DialogFlow from "../components/DialogFlow.jsx";
import { api, jsonHeaders } from "../api.js";

export default function ViewerPage() {
  const [images, setImages] = useState([]);
  const [sessionUid, setSessionUid] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [openDialog, setOpenDialog] = useState(false);
  const [consecutiveNonQ, setConsecutiveNonQ] = useState(0);
  const [targetConsecutive, setTargetConsecutive] = useState(2);
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
          const nonQs = list.map((img, i) => ({ img, i })).filter(x => !x.img.question_count);
          if (nonQs.length > 0) {
            setCurrentIndex(nonQs[Math.floor(Math.random() * nonQs.length)].i);
            setConsecutiveNonQ(1);
          } else {
            setCurrentIndex(Math.floor(Math.random() * list.length));
            setConsecutiveNonQ(0);
          }
          setTargetConsecutive(Math.random() > 0.5 ? 3 : 2);
        }
      } catch (err) {
        setError(err.message);
      }
    }

    bootstrap();
  }, []);

  const goToNextRandom = () => {
    if (images.length <= 1) return;

    const nonQs = images.map((img, i) => ({ img, i })).filter(x => !x.img.question_count);
    const qs = images.map((img, i) => ({ img, i })).filter(x => x.img.question_count > 0);

    let nextIndex = 0;

    if (nonQs.length === 0 || qs.length === 0) {
      // Fallback if the user has only 1 type of image uploaded
      nextIndex = Math.floor(Math.random() * images.length);
      if (nextIndex === currentIndex) {
        nextIndex = (nextIndex + 1) % images.length;
      }
    } else if (consecutiveNonQ < targetConsecutive) {
      // Ensure we pick another non-question image
      nextIndex = nonQs[Math.floor(Math.random() * nonQs.length)].i;
      if (nextIndex === currentIndex && nonQs.length > 1) {
        nextIndex = nonQs.find(x => x.i !== currentIndex).i;
      }
      setConsecutiveNonQ(prev => prev + 1);
    } else {
      // Met the quota! Show a question image
      nextIndex = qs[Math.floor(Math.random() * qs.length)].i;
      if (nextIndex === currentIndex && qs.length > 1) {
        nextIndex = qs.find(x => x.i !== currentIndex).i;
      }
      setConsecutiveNonQ(0);
      setTargetConsecutive(Math.random() > 0.5 ? 3 : 2);
    }

    setCurrentIndex(nextIndex);
  };

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Enter" && !openDialog && images.length) {
        const img = images[currentIndex];
        if (img && img.question_count > 0) {
          setOpenDialog(true);
        } else {
          goToNextRandom();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openDialog, images, currentIndex]);

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
        <button 
          className="btn btn-primary" 
          onClick={() => {
            if (currentImage && currentImage.question_count > 0) {
              setOpenDialog(true);
            } else {
              goToNextRandom();
            }
          }}
        >
          {currentImage && currentImage.question_count > 0 ? "Drücke die Enter, um zu antworten" : "Drücke die Enter, um zum nächsten Bild zu gelangen"}
        </button>
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
