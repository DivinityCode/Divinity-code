# IDE Extension
Owner: Builder Experience

Builder Mode commands for IDE workflows.

## Current Commands
- `Divinity: Run Task` prompts for an objective and runs `divinity run` in an IDE terminal.
- `Divinity: Open Dashboard` opens the local operator dashboard HTML file.
- `Divinity: Doctor` runs `divinity doctor` in an IDE terminal.

The extension manifest is VS Code-compatible and intentionally delegates execution to the repo-local CLI so the CLI, API, and dashboard contracts stay shared.
