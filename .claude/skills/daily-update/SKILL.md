Draft the `#дневнойапдейт` post for this project: short, non-technical, past-tense bullets in Russian describing what functionality/problem was built or solved that day, and why — written so Valeri can recall the work later even though the phrasing is non-technical.

Target date: if the user passed one as an argument (e.g. `/daily-update 2026-07-15`), use it. Otherwise default to yesterday relative to today's date.

1. Run `python3 scripts/dailyUpdate.py <date>` (omit `<date>` for the default) from the repo root. This prints two sections: git commits for that date, and a role-filtered ("user" only) digest of that day's Claude Code session prompts across this project.
2. Read the digest and reconstruct what was actually built/fixed/tested that day — commit subjects give the "what", the user prompts give the "why".
3. Draft bullets following these style rules (learned from Valeri's edits to past drafts):
   - One line per bullet. Fold the reason into the same short clause (e.g. "закрепила архитектурные правила, чтобы не допустить разрастания код-монолита") — don't tack on a separate explanatory sentence.
   - Cut minor/internal tooling changes with no user-visible or team-visible impact (e.g. a package-manager migration).
   - Cut unresolved blockers or failed attempts — those are tracked elsewhere, not in the daily bullet list.
   - Cut meta bullets about the reporting process itself (e.g. never write a bullet about "prepared a status update").
   - Include manual verification/testing as its own bullet, separate from the feature-build bullet it verifies.
   - If commits/prompts don't fully explain some infra/ops work (error tracker wiring, Slack notifications, etc.), say so rather than silently omitting it — Valeri may add it herself.
4. Present the draft to Valeri. She will append non-development bullets herself (calls, user unsubscribes, bundles, etc.) — never fabricate or guess those.
5. If she edits the draft before posting, note what changed for future daily updates — it's a signal about style, not a one-off correction.
