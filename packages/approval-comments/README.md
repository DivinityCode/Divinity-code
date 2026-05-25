# Approval Comments

`packages/approval-comments` creates stable comment records for approval discussions.

The records are intentionally small: run id, actor, body, timestamp, and a deterministic per-run comment id. API and CLI approval comment surfaces use this package so local script output and persisted control-plane records stay aligned.
