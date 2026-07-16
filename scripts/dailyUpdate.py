#!/usr/bin/env python3
"""Собирает сырые данные для #дневнойапдейт: коммиты за день + пользовательские реплики из сессий Claude Code."""
import json
import re
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent


def target_date():
    if len(sys.argv) > 1:
        return sys.argv[1]
    yesterday = datetime.now().astimezone() - timedelta(days=1)
    return yesterday.strftime("%Y-%m-%d")


def print_commits(date):
    print(f"=== Commits {date} ===")
    result = subprocess.run(
        [
            "git", "log", "--all",
            f"--since={date} 00:00", f"--until={date} 23:59",
            "--pretty=format:%h|%ad|%an|%s", "--date=iso",
        ],
        capture_output=True, text=True, cwd=REPO_ROOT,
    )
    output = result.stdout.strip()
    print(output if output else "(нет коммитов)")


def transcripts_dir():
    sanitized = re.sub(r"[^A-Za-z0-9]", "-", str(REPO_ROOT))
    return Path.home() / ".claude" / "projects" / sanitized


NOISE_PREFIXES = (
    "<local-command", "<command-name", "<command-args",
    "This session is being continued from a previous conversation",
)


def is_noise(text):
    return text.startswith(NOISE_PREFIXES)


def print_session_prompts(date):
    print(f"\n=== User prompts {date} ===")
    # role filter: "user" only — дайджест нужен для восстановления намерений
    # автора за день, полный вывод ассистента здесь избыточен
    directory = transcripts_dir()
    if not directory.exists():
        print("(транскрипты не найдены)")
        return
    for path in sorted(directory.glob("*.jsonl")):
        seen = set()
        matches = []
        with path.open(errors="ignore") as f:
            for line in f:
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if obj.get("type") != "user":
                    continue
                ts = obj.get("timestamp", "")
                if not ts.startswith(date):
                    continue
                message = obj.get("message")
                content = message.get("content") if isinstance(message, dict) else None
                if isinstance(content, list):
                    content = " ".join(
                        item.get("text", "") for item in content
                        if isinstance(item, dict) and item.get("type") == "text"
                    )
                if not isinstance(content, str) or not content.strip() or is_noise(content.strip()):
                    continue
                snippet = content.strip()[:200]
                key = (ts, snippet)
                if key in seen:
                    continue
                seen.add(key)
                matches.append((ts, snippet))
        if matches:
            print(f"\n-- {path.stem} --")
            for ts, snippet in matches:
                print(f"[{ts}] {snippet}")


def main():
    date = target_date()
    print_commits(date)
    print_session_prompts(date)


if __name__ == "__main__":
    main()
