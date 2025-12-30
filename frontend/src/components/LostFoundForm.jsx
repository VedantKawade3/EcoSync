"use client";

import { useEffect, useRef, useState } from "react";
import { createLostItem } from "../lib/api";

const LostFoundForm = ({ user, onCreated }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [contact, setContact] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return setError("Sign in failed. Try again.");
    setLoading(true);
    setError("");
    try {
      let imageUrl = null;
      if (file) {
        const toBase64 = (f) =>
          new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(",")[1]);
            reader.onerror = reject;
            reader.readAsDataURL(f);
          });
        const b64 = await toBase64(file);
        imageUrl = `data:${file.type || "image/jpeg"};base64,${b64}`;
      }
      await createLostItem({
        user_id: user.uid,
        user_email: user.email,
        username: user.username || "",
        title,
        description,
        location,
        contact,
        image_url: imageUrl,
      });
      setTitle("");
      setDescription("");
      setLocation("");
      setContact("");
      setFile(null);
      onCreated?.();
    } catch (err) {
      console.error(err);
      setError(err.message || "Could not create entry");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" id="lostfound">
      <div className="card__header">
        <h3>Report a found item</h3>
        <p className="muted">Help return valuables and earn trust.</p>
      </div>
      <form className="form" onSubmit={handleSubmit}>
        <label>
          Title
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Found wallet near library"
            required
          />
        </label>
        <label>
          Description
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Black leather wallet with student ID"
            required
          />
        </label>
        <label>
          Location
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Front desk, science building"
            required
          />
        </label>
        <label>
          Contact
          <input
            type="text"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="Email or phone"
            required
          />
        </label>
        <label className="file-input">
          <span>{file ? file.name : "Attach optional photo"}</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => setFile(e.target.files[0])}
          />
        </label>
        <div className="camera-preview">
          <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", borderRadius: 12 }} />
          <div className="cta-row">
            <button
              className="btn ghost"
              type="button"
              onClick={async () => {
                try {
                  const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: "environment" } },
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
              Start camera
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
                  const filename = `lost-item-${Date.now()}.jpg`;
                  const fileFromCam = new File([blob], filename, { type: "image/jpeg" });
                  setFile(fileFromCam);
                  setError("");
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
              Capture photo
            </button>
          </div>
        </div>
        {error && <p className="error">{error}</p>}
        <button className="btn secondary" type="submit" disabled={loading}>
          {loading ? "Submitting..." : "Submit"}
        </button>
      </form>
    </div>
  );
};

export default LostFoundForm;
