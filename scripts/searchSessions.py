#!/usr/bin/env python3
"""Ищет ключевые слова и/или временные диапазоны в репликах из прошлых сессий Claude Code этого проекта.

Использование:
  python3 scripts/searchSessions.py KEYWORD [KEYWORD ...] [--files a.jsonl,b.jsonl] [--role assistant|user|all]
  python3 scripts/searchSessions.py --since 2026-07-16T09 --until 2026-07-16T12 --files a.jsonl [--min-length 60]
"""
import argparse
import json
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
CONTEXT_BEFORE = 120
CONTEXT_AFTER = 180


def transcripts_dir():
    sanitized = re.sub(r"[^A-Za-z0-9]", "-", str(REPO_ROOT))
    return Path.home() / ".claude" / "projects" / sanitized


def message_text(entry):
    message = entry.get("message")
    content = message.get("content") if isinstance(message, dict) else None
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return " ".join(
            item.get("text", "") for item in content
            if isinstance(item, dict) and item.get("type") == "text"
        )
    return ""


def search_file(path, keywords, role, since, until, min_length):
    with path.open(errors="ignore") as f:
        for line in f:
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue
            # role filter: role param ("assistant" default) — этот скрипт ищет
            # формулировки/идеи, предложенные ассистентом в прошлых сессиях
            if role != "all" and entry.get("type") != role:
                continue
            ts = entry.get("timestamp", "")
            if since and ts < since:
                continue
            if until and ts >= until:
                continue
            text = message_text(entry)
            if not text or len(text) < min_length:
                continue
            if not keywords:
                snippet = text[:CONTEXT_AFTER].replace("\n", " ")
                print(f"{ts} | ... {snippet}")
                continue
            for kw in keywords:
                idx = text.find(kw)
                if idx == -1:
                    continue
                snippet = text[max(0, idx - CONTEXT_BEFORE):idx + CONTEXT_AFTER].replace("\n", " ")
                print(f"{ts} | {kw} | ... {snippet}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("keywords", nargs="*")
    parser.add_argument("--files", help="comma-separated jsonl basenames; default: all sessions")
    parser.add_argument("--role", choices=["assistant", "user", "all"], default="assistant")
    parser.add_argument("--since", default="", help="ISO timestamp prefix, inclusive (e.g. 2026-07-16T09)")
    parser.add_argument("--until", default="", help="ISO timestamp prefix, exclusive (e.g. 2026-07-16T12)")
    parser.add_argument("--min-length", type=int, default=0)
    args = parser.parse_args()

    directory = transcripts_dir()
    if args.files:
        paths = [directory / name for name in args.files.split(",")]
    else:
        paths = sorted(directory.glob("*.jsonl"))

    for path in paths:
        if not path.exists():
            continue
        print(f"===== {path.name}")
        search_file(path, args.keywords, args.role, args.since, args.until, args.min_length)


if __name__ == "__main__":
    main()
