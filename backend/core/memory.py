"""
CozyCrypto Trader — Persistent Memory (GitHub-backed)
Adapted from Governor V4 memory system.

Stores:
  - Trading memory: strategies, lessons learned, patterns
  - Session history: conversation sessions
  - Knowledge base: market intelligence from learner
  - Project memory: permanent settings, risk configs
"""

import os, json, base64, time, uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
import requests

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
REPO         = os.environ.get("TRADER_REPO", "fassdavid722-cpu/cozycrypto-trader")
GH_BASE      = "https://api.github.com"

GH_MEMORY_PATH    = "data/memory.json"
GH_SESSIONS_PATH  = "data/sessions"
GH_KNOWLEDGE_PATH = "data/knowledge.json"

LOCAL_MEM       = "/tmp/trader_memory.json"
LOCAL_SESSIONS  = "/tmp/trader_sessions"
LOCAL_KNOWLEDGE = "/tmp/trader_knowledge.json"

os.makedirs(LOCAL_SESSIONS, exist_ok=True)

_mem_cache:      Optional[Dict] = None
_knowledge_cache: Optional[Dict] = None
_session_cache:  Dict[str, Dict] = {}
_sessions_restored = False

# ── GitHub helpers ─────────────────────────────────────────────────────────────

def _gh_headers():
    return {"Authorization": f"Bearer {GITHUB_TOKEN}", "Accept": "application/vnd.github+json"}

def _gh_read(path: str, default=None):
    try:
        r = requests.get(f"{GH_BASE}/repos/{REPO}/contents/{path}", headers=_gh_headers(), timeout=15)
        if r.status_code == 200:
            d = r.json()
            return json.loads(base64.b64decode(d["content"]).decode()), d.get("sha", "")
        return default or {}, ""
    except Exception:
        return default or {}, ""

def _gh_write(path: str, data: Any, sha: str, message: str) -> bool:
    try:
        body = {"message": message, "content": base64.b64encode(json.dumps(data, indent=2).encode()).decode()}
        if sha: body["sha"] = sha
        r = requests.put(f"{GH_BASE}/repos/{REPO}/contents/{path}", headers=_gh_headers(), json=body, timeout=20)
        return r.status_code in (200, 201)
    except Exception:
        return False

# ── Memory operations ──────────────────────────────────────────────────────────

def load_memory() -> Dict:
    global _mem_cache
    if _mem_cache: return _mem_cache
    try:
        with open(LOCAL_MEM) as f: _mem_cache = json.load(f); return _mem_cache
    except Exception: pass
    data, _ = _gh_read(GH_MEMORY_PATH, {"entries": [], "task_history": [], "trading_lessons": []})
    _mem_cache = data
    try:
        with open(LOCAL_MEM, "w") as f: json.dump(_mem_cache, f, indent=2)
    except Exception: pass
    return _mem_cache

def remember(key: str, value: str, category: str = "general"):
    mem = load_memory()
    entries = mem.setdefault("entries", [])
    # Update if exists
    for e in entries:
        if e.get("key") == key:
            e["value"] = value; e["updated"] = datetime.now(timezone.utc).isoformat(); e["category"] = category
            _flush_memory(mem); return
    entries.append({"key": key, "value": value, "category": category,
                    "created": datetime.now(timezone.utc).isoformat(), "hits": 0})
    if len(entries) > 500: entries.sort(key=lambda x: x.get("hits", 0)); entries.pop(0)
    _flush_memory(mem)

def recall(query: str, n=5) -> List[Dict]:
    mem = load_memory()
    query_lower = query.lower()
    results = [e for e in mem.get("entries", []) if query_lower in e.get("key","").lower() or query_lower in str(e.get("value","")).lower()]
    return results[:n]

def remember_trade_lesson(lesson: str):
    mem = load_memory()
    lessons = mem.setdefault("trading_lessons", [])
    lessons.insert(0, {"lesson": lesson, "time": datetime.now(timezone.utc).isoformat()})
    if len(lessons) > 100: lessons.pop()
    _flush_memory(mem)

def get_trade_lessons(n=10) -> List[str]:
    mem = load_memory()
    return [l["lesson"] for l in mem.get("trading_lessons", [])[:n]]

def _flush_memory(mem: Dict):
    global _mem_cache
    _mem_cache = mem
    try:
        with open(LOCAL_MEM, "w") as f: json.dump(mem, f, indent=2)
    except Exception: pass
    # Async GitHub write
    import threading
    def _push():
        _, sha = _gh_read(GH_MEMORY_PATH)
        _gh_write(GH_MEMORY_PATH, mem, sha, "chore: update memory")
    threading.Thread(target=_push, daemon=True).start()

# ── Session management ─────────────────────────────────────────────────────────

def new_session() -> str:
    sid = str(uuid.uuid4())[:8]
    _session_cache[sid] = {"id": sid, "messages": [], "created": datetime.now(timezone.utc).isoformat(), "title": "New Session"}
    return sid

def get_session(sid: str) -> Optional[Dict]:
    return _session_cache.get(sid)

def append_message(sid: str, role: str, content: str):
    if sid not in _session_cache:
        _session_cache[sid] = {"id": sid, "messages": [], "created": datetime.now(timezone.utc).isoformat(), "title": "Session"}
    msgs = _session_cache[sid]["messages"]
    msgs.append({"role": role, "content": content, "time": datetime.now(timezone.utc).isoformat()})
    if len(msgs) > 100: msgs.pop(0)
    # Auto-title from first user message
    if len(msgs) == 1 and role == "user":
        _session_cache[sid]["title"] = content[:50]
    _persist_session(sid)

def list_sessions() -> List[Dict]:
    return [{"id": v["id"], "title": v.get("title","Session"), "created": v.get("created","")}
            for v in _session_cache.values()]

def _persist_session(sid: str):
    data = _session_cache.get(sid, {})
    path = f"{LOCAL_SESSIONS}/{sid}.json"
    try:
        with open(path, "w") as f: json.dump(data, f, indent=2)
    except Exception: pass
    import threading
    def _push():
        _, sha = _gh_read(f"{GH_SESSIONS_PATH}/{sid}.json")
        _gh_write(f"{GH_SESSIONS_PATH}/{sid}.json", data, sha, f"session: {sid}")
    threading.Thread(target=_push, daemon=True).start()

def restore_sessions_from_github():
    global _sessions_restored
    if _sessions_restored: return
    try:
        r = requests.get(f"{GH_BASE}/repos/{REPO}/contents/{GH_SESSIONS_PATH}", headers=_gh_headers(), timeout=15)
        if r.status_code == 200:
            files = r.json()
            if isinstance(files, list):
                for f in files:
                    if f["name"].endswith(".json"):
                        sid = f["name"].replace(".json","")
                        data, _ = _gh_read(f"{GH_SESSIONS_PATH}/{sid}.json")
                        if data: _session_cache[sid] = data
    except Exception: pass
    _sessions_restored = True

# ── Knowledge base ─────────────────────────────────────────────────────────────

def load_knowledge() -> Dict:
    global _knowledge_cache
    if _knowledge_cache: return _knowledge_cache
    try:
        with open(LOCAL_KNOWLEDGE) as f: _knowledge_cache = json.load(f); return _knowledge_cache
    except Exception: pass
    data, _ = _gh_read(GH_KNOWLEDGE_PATH, {"entries": {}})
    _knowledge_cache = data
    try:
        with open(LOCAL_KNOWLEDGE, "w") as f: json.dump(_knowledge_cache, f, indent=2)
    except Exception: pass
    return _knowledge_cache

def save_knowledge(topic_id: str, summary: str, raw: str = ""):
    kb = load_knowledge()
    kb.setdefault("entries", {})[topic_id] = {
        "summary": summary, "raw": raw[:2000],
        "updated": datetime.now(timezone.utc).isoformat()
    }
    global _knowledge_cache
    _knowledge_cache = kb
    try:
        with open(LOCAL_KNOWLEDGE, "w") as f: json.dump(kb, f, indent=2)
    except Exception: pass
    import threading
    def _push():
        _, sha = _gh_read(GH_KNOWLEDGE_PATH)
        _gh_write(GH_KNOWLEDGE_PATH, kb, sha, f"knowledge: {topic_id}")
    threading.Thread(target=_push, daemon=True).start()

def search_knowledge(query: str, n=5) -> List[str]:
    kb = load_knowledge()
    q = query.lower()
    results = []
    for tid, data in kb.get("entries", {}).items():
        if q in tid.lower() or q in data.get("summary","").lower():
            results.append(f"[{tid}] {data.get('summary','')[:300]}")
    return results[:n]
