# Connectors Package
Owner: Platform

Defines connector adapter metadata and run-level connector reference helpers for external context sources that runners and dashboards can attach to runs.

## Current Surface
- `CONNECTOR_ADAPTERS` lists ticket, docs, and CI status reference adapters.
- `publicConnectorAdapters(...)` returns defensive copies for capability discovery.
- `createConnectorReference(...)` validates and normalizes one ticket/docs/CI run reference.
- `createConnectorReferences(...)` validates and normalizes ordered reference arrays.
