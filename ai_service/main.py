# ai_service/main.py
from __future__ import annotations

import base64
import io
import os
import logging
from dataclasses import dataclass
from typing import Dict, Optional, Tuple

import imagehash
import numpy as np
import psycopg2
from psycopg2 import sql
from fastapi import FastAPI, Header, HTTPException, status
from PIL import Image
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel

API_KEY = os.getenv("AI_SERVICE_KEY", "")
ALLOWED_ORIGINS = os.getenv("AI_CORS_ORIGINS", "*").split(",")
DEFAULT_CREDITS = int(os.getenv("AI_DEFAULT_CREDITS", "1"))

logger = logging.getLogger("ai_service")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO)

app = FastAPI(title="EcoSync AI Service", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in ALLOWED_ORIGINS if o],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    init_db()


def require_api_key(key: Optional[str]) -> None:
    if API_KEY and key != API_KEY:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid AI key")


def _decode_image(b64_data: str) -> Image.Image:
    try:
        data = base64.b64decode(b64_data)
        img = Image.open(io.BytesIO(data)).convert("RGB")
        return img
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid image data") from exc


@dataclass
class InMemoryStore:
    vectors: Dict[str, Dict]  # user_id -> list of entries

    def add(self, user_id: str, post_id: str, vec: np.ndarray) -> None:
        entry = {"post_id": post_id, "vector": vec}
        self.vectors.setdefault(user_id, []).append(entry)

    def search(self, user_id: str, vec: np.ndarray, thresh: float = 0.9) -> Optional[Dict]:
        best = None
        best_score = 0.0
        for entry in self.vectors.get(user_id, []):
            v = entry["vector"]
            num = float(np.dot(vec, v))
            denom = float(np.linalg.norm(vec) * np.linalg.norm(v) + 1e-9)
            score = num / denom
            if score > thresh and score > best_score:
                best = entry | {"score": score}
                best_score = score
        return best


def _get_db_params() -> Tuple[str, str]:
    dsn = os.getenv("AI_DATABASE_URL")
    if not dsn:
        host = os.getenv("AI_DB_HOST")
        name = os.getenv("AI_DB_NAME")
        user = os.getenv("AI_DB_USER")
        password = os.getenv("AI_DB_PASSWORD")
        port = os.getenv("AI_DB_PORT", "5432")
        sslmode = os.getenv("AI_DB_SSLMODE", "require")
        if not all([host, name, user, password]):
            raise RuntimeError("Postgres env not configured (AI_DATABASE_URL or AI_DB_* vars required)")
        dsn = f"host={host} port={port} dbname={name} user={user} password={password} sslmode={sslmode}"
    schema = os.getenv("AI_DB_SCHEMA", "public")
    return dsn, schema


def get_conn():
    dsn, schema = _get_db_params()
    conn = psycopg2.connect(dsn)
    if schema:
        with conn.cursor() as cur:
            cur.execute(sql.SQL("SET search_path TO {}").format(sql.Identifier(schema)))
        conn.commit()
    return conn


def init_db() -> None:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS embeddings (
            user_id TEXT NOT NULL,
            post_id TEXT NOT NULL,
            kind TEXT NOT NULL, -- mobilenet or phash
            vector BYTEA NOT NULL
        );
        """
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS embeddings_user_kind_idx ON embeddings (user_id, kind)"
    )
    conn.commit()
    conn.close()


def save_vector(user_id: str, post_id: str, kind: str, vec: np.ndarray) -> None:
    vec32 = np.asarray(vec, dtype=np.float32)
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO embeddings (user_id, post_id, kind, vector) VALUES (%s, %s, %s, %s)",
        (user_id, post_id, kind, psycopg2.Binary(vec32.tobytes())),
    )
    conn.commit()
    conn.close()


def search_vectors(user_id: str, vec: np.ndarray, kind: str, thresh: float) -> Optional[Dict]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT post_id, vector FROM embeddings WHERE user_id = %s AND kind = %s", (user_id, kind))
    best = None
    best_score = 0.0
    for row in cur.fetchall():
        stored_bytes = bytes(row[1])
        stored = np.frombuffer(stored_bytes, dtype=np.float32)
        if stored.shape != vec.shape:
            # Skip vectors from earlier runs with different dimensionality
            continue
        num = float(np.dot(vec, stored))
        denom = float(np.linalg.norm(vec) * np.linalg.norm(stored) + 1e-9)
        score = num / denom
        if score > thresh and score > best_score:
            best = {"post_id": row[0], "score": score}
            best_score = score
    conn.close()
    return best


_mobilenet_model = None
_mobilenet_loaded = False


def _get_mobilenet_model():
    global _mobilenet_model, _mobilenet_loaded
    if _mobilenet_loaded:
        return _mobilenet_model
    try:
        import tensorflow as tf  # type: ignore
        import tensorflow_hub as hub  # type: ignore

        model = hub.load("https://tfhub.dev/google/tf2-preview/mobilenet_v2/feature_vector/4")
        _mobilenet_model = (model, tf)
        logger.info("Loaded MobileNetV2 feature extractor from TF Hub")
    except Exception as exc:
        logger.exception("Failed to load MobileNetV2 model from TF Hub: %s", exc)
        _mobilenet_model = None
    _mobilenet_loaded = True
    return _mobilenet_model


def mobilenet_embed(img: Image.Image) -> Optional[np.ndarray]:
    pair = _get_mobilenet_model()
    if not pair:
        logger.warning("MobileNet model unavailable; skipping embedding")
        return None
    model, tf = pair
    try:
        image = img.resize((224, 224))
        arr = np.array(image).astype(np.float32) / 255.0
        arr = np.expand_dims(arr, 0)
        embedding = model(arr)
        vec = embedding.numpy().flatten()
        return vec
    except Exception:
        logger.exception("MobileNet embedding failed")
        return None


class VerifyPayload(BaseModel):
    user_id: str
    post_id: str
    media_base64: str


@app.post("/ai/verify")
async def verify(payload: VerifyPayload, x_ai_key: Optional[str] = Header(default=None)) -> Dict:
    require_api_key(x_ai_key)
    user_id = payload.user_id
    post_id = payload.post_id
    media_b64 = payload.media_base64

    logger.info("Verify start user=%s post=%s b64_len=%s", user_id, post_id, len(media_b64 or ""))

    # Perceptual hash as lightweight duplicate signal
    try:
        img = _decode_image(media_b64)
        ph = imagehash.phash(img)
        ph_vec = np.array(ph.hash, dtype=float).flatten()
    except Exception as exc:
        return {"status": "pending", "notes": f"ai-error: {exc}"}

    # Try MobileNet embedding first; fall back to phash
    mn_vec = mobilenet_embed(img)

    if mn_vec is not None:
        logger.info("MobileNet embedding shape=%s norm=%.4f", mn_vec.shape, float(np.linalg.norm(mn_vec)))
        dup = search_vectors(user_id, mn_vec, "mobilenet", thresh=0.80)
        save_vector(user_id, post_id, "mobilenet", mn_vec)
        if dup:
            logger.info("Duplicate detected for post %s vs %s score=%.3f", post_id, dup["post_id"], dup["score"])
            return {
                "status": "rejected",
                "notes": f"Duplicate detected (mobilenet) similar to {dup['post_id']} (score {dup['score']:.3f})",
                "credits_awarded": 0,
            }
        logger.info("Unique upload for post %s; marking verified", post_id)
        return {
            "status": "verified",
            "notes": "Unique upload (mobilenet)",
            "credits_awarded": DEFAULT_CREDITS,
        }

    logger.warning("No MobileNet embedding produced for post %s; returning pending", post_id)
    return {"status": "pending", "notes": "Pending manual review", "credits_awarded": 0}
