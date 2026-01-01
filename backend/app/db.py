from __future__ import annotations

import hashlib
import os
from array import array
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from threading import Lock
from typing import Any, Dict, List, Optional

import psycopg2
from psycopg2 import extras, pool, sql

DB_SCHEMA = os.getenv("DB_SCHEMA", "public")
DB_POOL_MIN = int(os.getenv("DB_POOL_MIN", "1"))
DB_POOL_MAX = int(os.getenv("DB_POOL_MAX", "5"))
DB_CONNECT_TIMEOUT = int(os.getenv("DB_CONNECT_TIMEOUT", "5"))
DB_STATEMENT_TIMEOUT_MS = int(os.getenv("DB_STATEMENT_TIMEOUT_MS", "5000"))

_pool: pool.SimpleConnectionPool | None = None
_pool_lock = Lock()


def _get_dsn() -> str:
    dsn = os.getenv("DATABASE_URL")
    if dsn:
        return dsn
    host = os.getenv("DB_HOST")
    name = os.getenv("DB_NAME")
    user = os.getenv("DB_USER")
    password = os.getenv("DB_PASSWORD")
    port = os.getenv("DB_PORT", "5432")
    sslmode = os.getenv("DB_SSLMODE", "require")
    if not all([host, name, user, password]):
        raise RuntimeError("Postgres env not configured (DATABASE_URL or DB_* vars required)")
    return (
        f"host={host} port={port} dbname={name} user={user} "
        f"password={password} sslmode={sslmode}"
    )


def _get_pool() -> pool.SimpleConnectionPool:
    global _pool
    if _pool is not None:
        return _pool
    with _pool_lock:
        if _pool is None:
            _pool = pool.SimpleConnectionPool(
                minconn=max(1, DB_POOL_MIN),
                maxconn=max(DB_POOL_MIN, DB_POOL_MAX),
                dsn=_get_dsn(),
                connect_timeout=DB_CONNECT_TIMEOUT,
            )
    return _pool


def _configure_conn(conn) -> None:
    with conn.cursor() as cur:
        if DB_SCHEMA:
            cur.execute(sql.SQL("SET search_path TO {}").format(sql.Identifier(DB_SCHEMA)))
        cur.execute(
            sql.SQL("SET statement_timeout TO {}").format(sql.Literal(DB_STATEMENT_TIMEOUT_MS))
        )


@contextmanager
def db_conn():
    conn = _get_pool().getconn()
    try:
        _configure_conn(conn)
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        _get_pool().putconn(conn)


def init_db() -> None:
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS posts (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    user_email TEXT NOT NULL,
                    caption TEXT,
                    media_base64 TEXT,
                    media_mime TEXT,
                    media_type TEXT,
                    media_url TEXT,
                    location TEXT,
                    ai_summary TEXT,
                    credits_awarded INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'pending',
                    verified INTEGER DEFAULT 0,
                    review_notes TEXT,
                    created_at TEXT
                );
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS lost_found (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    user_email TEXT NOT NULL,
                    title TEXT,
                    description TEXT,
                    location TEXT,
                    contact TEXT,
                    image_url TEXT,
                    status TEXT DEFAULT 'open',
                    credits_awarded INTEGER DEFAULT 0,
                    created_at TEXT
                );
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS credits (
                    user_id TEXT PRIMARY KEY,
                    credits INTEGER DEFAULT 0
                );
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS embeddings (
                    post_id TEXT,
                    user_id TEXT,
                    vector BYTEA
                );
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS mobilenet_embeddings (
                    post_id TEXT,
                    user_id TEXT,
                    vector BYTEA
                );
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS user_settings (
                    user_id TEXT PRIMARY KEY,
                    username TEXT,
                    theme TEXT DEFAULT 'dark'
                );
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL,
                    username TEXT,
                    password_hash TEXT NOT NULL,
                    role TEXT DEFAULT 'user',
                    created_at TEXT
                );
                """
            )
            # Backward compatibility for existing local DBs
            cur.execute("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS username TEXT")
            cur.execute("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'dark'")
            cur.execute("ALTER TABLE posts ADD COLUMN IF NOT EXISTS user_email TEXT NOT NULL DEFAULT ''")
            cur.execute("ALTER TABLE lost_found ADD COLUMN IF NOT EXISTS user_email TEXT NOT NULL DEFAULT ''")

            # Seed admin account if missing
            cur.execute("SELECT 1 FROM users WHERE email = %s", ("admin@ecosync.local",))
            if not cur.fetchone():
                pwd_hash = hashlib.sha256("Admin@123".encode("utf-8")).hexdigest()
                created_at = datetime.now(timezone.utc).isoformat()
                cur.execute(
                    """
                    INSERT INTO users (id, email, username, password_hash, role, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (
                        "user-admin",
                        "admin@ecosync.local",
                        "admin",
                        pwd_hash,
                        "admin",
                        created_at,
                    ),
                )


def purge_rejected_posts(max_age_hours: int = 24) -> None:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=max_age_hours)
    stale_ids: List[str] = []
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, created_at FROM posts WHERE status = 'rejected'")
            for post_id, created_raw in cur.fetchall():
                if not created_raw:
                    continue
                try:
                    dt = datetime.fromisoformat(created_raw)
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=timezone.utc)
                    else:
                        dt = dt.astimezone(timezone.utc)
                    if dt < cutoff:
                        stale_ids.append(post_id)
                except Exception:
                    continue
    for post_id in stale_ids:
        delete_post_record(post_id)


def list_posts(limit: int = 25) -> List[Dict[str, Any]]:
    purge_rejected_posts()
    with db_conn() as conn:
        with conn.cursor(cursor_factory=extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM posts ORDER BY created_at DESC LIMIT %s", (limit,))
            return [dict(row) for row in cur.fetchall()]


def add_post(doc: Dict[str, Any]) -> None:
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO posts (
                    id, user_id, user_email, caption, media_base64, media_mime, media_type, media_url,
                    location, ai_summary, credits_awarded, status, verified, review_notes, created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    doc["id"],
                    doc["user_id"],
                    doc["user_email"],
                    doc.get("caption"),
                    doc.get("media_base64"),
                    doc.get("media_mime"),
                    doc.get("media_type"),
                    doc.get("media_url"),
                    doc.get("location"),
                    doc.get("ai_summary"),
                    int(doc.get("credits_awarded", 0)),
                    doc.get("status", "pending"),
                    1 if doc.get("verified") else 0,
                    doc.get("review_notes"),
                    doc.get("created_at"),
                ),
            )


def update_post(post_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if not updates:
        return None
    fields = []
    values = []
    for key, value in updates.items():
        if key == "verified":
            value = 1 if bool(value) else 0
        fields.append(f"{key} = %s")
        values.append(value)
    values.append(post_id)
    with db_conn() as conn:
        with conn.cursor(cursor_factory=extras.RealDictCursor) as cur:
            cur.execute(f"UPDATE posts SET {', '.join(fields)} WHERE id = %s", values)
            cur.execute("SELECT * FROM posts WHERE id = %s", (post_id,))
            row = cur.fetchone()
            return dict(row) if row else None


def get_post(post_id: str) -> Optional[Dict[str, Any]]:
    with db_conn() as conn:
        with conn.cursor(cursor_factory=extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM posts WHERE id = %s", (post_id,))
            row = cur.fetchone()
            return dict(row) if row else None


def list_lost_found(limit: int = 25) -> List[Dict[str, Any]]:
    with db_conn() as conn:
        with conn.cursor(cursor_factory=extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM lost_found ORDER BY created_at DESC LIMIT %s", (limit,))
            return [dict(row) for row in cur.fetchall()]


def add_lost_found(item: Dict[str, Any]) -> Dict[str, Any]:
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO lost_found (
                    id, user_id, user_email, title, description, location, contact, image_url,
                    status, credits_awarded, created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    item["id"],
                    item["user_id"],
                    item["user_email"],
                    item.get("title"),
                    item.get("description"),
                    item.get("location"),
                    item.get("contact"),
                    item.get("image_url"),
                    item.get("status", "open"),
                    int(item.get("credits_awarded", 0)),
                    item.get("created_at"),
                ),
            )
    return item


def find_duplicate_lost(user_id: str, title: str, description: str) -> Optional[Dict[str, Any]]:
    with db_conn() as conn:
        with conn.cursor(cursor_factory=extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT * FROM lost_found
                WHERE user_id = %s AND (LOWER(title) = LOWER(%s) OR LOWER(description) = LOWER(%s))
                ORDER BY created_at DESC
                """,
                (user_id, title, description),
            )
            row = cur.fetchone()
            return dict(row) if row else None


def update_lost_status(item_id: str, status: str) -> Optional[Dict[str, Any]]:
    with db_conn() as conn:
        with conn.cursor(cursor_factory=extras.RealDictCursor) as cur:
            cur.execute("UPDATE lost_found SET status = %s WHERE id = %s", (status, item_id))
            cur.execute("SELECT * FROM lost_found WHERE id = %s", (item_id,))
            row = cur.fetchone()
            return dict(row) if row else None


def adjust_credits(user_id: str, delta: int) -> int:
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT credits FROM credits WHERE user_id = %s", (user_id,))
            row = cur.fetchone()
            current = int(row[0]) if row else 0
            new_val = max(0, current + delta)
            if row:
                cur.execute("UPDATE credits SET credits = %s WHERE user_id = %s", (new_val, user_id))
            else:
                cur.execute("INSERT INTO credits (user_id, credits) VALUES (%s, %s)", (user_id, new_val))
            return new_val


def get_credits(user_id: str) -> int:
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT credits FROM credits WHERE user_id = %s", (user_id,))
            row = cur.fetchone()
            return int(row[0]) if row else 0


def save_embedding(post_id: str, user_id: str, vector: List[float]) -> None:
    buf = array("f", vector).tobytes()
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO embeddings (post_id, user_id, vector) VALUES (%s, %s, %s)",
                (post_id, user_id, psycopg2.Binary(buf)),
            )


def get_embeddings() -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT post_id, user_id, vector FROM embeddings")
            for post_id, user_id, vec_bytes in cur.fetchall():
                arr = array("f")
                arr.frombytes(bytes(vec_bytes))
                rows.append({"post_id": post_id, "user_id": user_id, "vector": list(arr)})
    return rows


def save_mobilenet_embedding(post_id: str, user_id: str, vector: List[float]) -> None:
    buf = array("f", vector).tobytes()
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO mobilenet_embeddings (post_id, user_id, vector) VALUES (%s, %s, %s)",
                (post_id, user_id, psycopg2.Binary(buf)),
            )


def get_mobilenet_embeddings() -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT post_id, user_id, vector FROM mobilenet_embeddings")
            for post_id, user_id, vec_bytes in cur.fetchall():
                arr = array("f")
                arr.frombytes(bytes(vec_bytes))
                rows.append({"post_id": post_id, "user_id": user_id, "vector": list(arr)})
    return rows


def delete_post_record(post_id: str) -> None:
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM posts WHERE id = %s", (post_id,))
            cur.execute("DELETE FROM embeddings WHERE post_id = %s", (post_id,))


def delete_lost_found_record(item_id: str) -> None:
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM lost_found WHERE id = %s", (item_id,))


def create_user(email: str, username: str, password_hash: str, role: str = "user") -> Dict[str, Any]:
    user_id = f"user-{abs(hash(email))}"
    created_at = datetime.now(timezone.utc).isoformat()
    with db_conn() as conn:
        with conn.cursor(cursor_factory=extras.RealDictCursor) as cur:
            cur.execute(
                """
                INSERT INTO users (id, email, username, password_hash, role, created_at)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (user_id, email.lower(), username, password_hash, role, created_at),
            )
            cur.execute("SELECT id, email, username, role FROM users WHERE id = %s", (user_id,))
            row = cur.fetchone()
            return dict(row) if row else {}


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    with db_conn() as conn:
        with conn.cursor(cursor_factory=extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT id, email, username, password_hash, role FROM users WHERE email = %s",
                (email.lower(),),
            )
            row = cur.fetchone()
            return dict(row) if row else None


def list_users() -> List[Dict[str, Any]]:
    with db_conn() as conn:
        with conn.cursor(cursor_factory=extras.RealDictCursor) as cur:
            cur.execute("SELECT id, email, username, role, created_at FROM users ORDER BY created_at DESC")
            return [dict(row) for row in cur.fetchall()]


def get_user_settings(user_id: str) -> Dict[str, Any]:
    with db_conn() as conn:
        with conn.cursor(cursor_factory=extras.RealDictCursor) as cur:
            cur.execute("SELECT user_id, username, theme FROM user_settings WHERE user_id = %s", (user_id,))
            row = cur.fetchone()
            if row:
                return dict(row)
    return {"user_id": user_id, "username": "", "theme": "dark"}


def save_user_settings(user_id: str, username: str, theme: str) -> Dict[str, Any]:
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO user_settings (user_id, username, theme)
                VALUES (%s, %s, %s)
                ON CONFLICT (user_id) DO UPDATE
                SET username = EXCLUDED.username, theme = EXCLUDED.theme
                """,
                (user_id, username, theme),
            )
    return {"user_id": user_id, "username": username, "theme": theme}
