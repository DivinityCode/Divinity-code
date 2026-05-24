# Audit Package
Owner: Platform

Builds hash-backed audit records and filtered audit exports for run lifecycle data.

## Current Surface
- `createAuditRecord(...)` wraps run, event, approval, and artifact payloads with a stable SHA-256 hash.
- `exportAuditLog(...)` filters records by optional `from` and `to` timestamps and emits `divinity.audit.v1`.
