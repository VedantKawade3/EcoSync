"use client";

import { useEffect, useRef, useState } from "react";
import { createPost } from "../lib/api";

const UploadForm = ({ user, onCreated }) => {
  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return setError("Sign in failed. Try again.");
    if (!file) return setError("Attach a photo or short video.");
    setError("");
    setLoading(true);
    try {
      const mediaType = file.type.includes("video") ? "video" : "image";
      const toBase64 = (f) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(f);
        });

      const media_base64 = await toBase64(file);

      const created = await createPost({
        user_id: user.uid,
        user_email: user.email || user.uid,
        username: user.username || "",
        caption,
        location,
        media_base64,
        media_mime: file.type || "image/jpeg",
        media_type: mediaType,
      });
      if (created?.review_notes) {
        setError(created.review_notes);
      }
      setCaption("");
      setLocation("");
      setFile(null);
      onCreated?.();
    } catch (err) {
      console.error(err);
      setError(err.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" id="upload">
      <div className="card__header">
        <h3>Log a cleanup</h3>
        <p className="muted">Upload photo/video proof to earn credits.</p>
      </div>
      <form className="form" onSubmit={handleSubmit}>
        <label>
          Caption
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Properly disposing recyclables near dorms"
            required
          />
        </label>
        <label>
          Location
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="North quad recycling station"
          />
        </label>
        <label className="file-input">
          <span>{file ? file.name : "Take a selfie or upload proof"}</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            capture="user"
            onChange={(e) => setFile(e.target.files[0])}
          />
        </label>
        <div className="camera-preview">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ width: "100%", borderRadius: 12, transform: "scaleX(-1)" }}
          />
          <div className="cta-row">
            <button
              className="btn ghost"
              type="button"
              onClick={async () => {
                try {
                  const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "user" },
                    audio: false,
                  });
                  streamRef.current = stream;
                  if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                  }
                } catch (err) {
                  setError("Camera permission denied.");
                }
              }}
            >
              Take selfie
            </button>
            <button
              className="btn primary"
              type="button"
              onClick={() => {
                if (!videoRef.current) return;
                const video = videoRef.current;
                const canvas = document.createElement("canvas");
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                canvas.toBlob((blob) => {
                  if (!blob) return;
                  const filename = `cleanup-selfie-${Date.now()}.jpg`;
                  const fileFromCam = new File([blob], filename, { type: "image/jpeg" });
                  setFile(fileFromCam);
                  setError("");
                  // Pause preview and release camera
                  if (videoRef.current) {
                    videoRef.current.pause();
                  }
                  if (streamRef.current) {
                    streamRef.current.getTracks().forEach((t) => t.stop());
                    streamRef.current = null;
                  }
                }, "image/jpeg");
              }}
            >
              Click photo
            </button>
          </div>
        </div>
        {error && <p className="error">{error}</p>}
        <button className="btn primary" type="submit" disabled={loading}>
          {loading ? "Uploading..." : "Earn credits"}
        </button>
      </form>
    </div>
  );
};

export default UploadForm;
