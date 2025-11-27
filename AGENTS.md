# Repository Guidelines

## Project Structure & Module Organization
`venice/`, `fal/`, and `replicate/` each expose a CLI entry point plus helpers (`cli.js`, `generate.js`, `utils.js`) for their respective providers. `venice/models.json` is the cached catalog refreshed by `venice-models`. Shared development helpers live under `tools/`, while generated media lands in `output/` (Replicate), `images/` (Fal), or `images/venice/`. Use `Makefile` targets for quick local scripts, and keep large assets or credentials outside the repo.

## Build, Test & Development Commands
- `npm install`: install CLI dependencies; rerun after updating `package.json`.
- `npm link` or `npm install -g .`: expose `venice`, `falflux`, `repflux`, and `venice-models` globally for manual testing.
- `make run -- <args>`: call `node replicate/index.js` with raw arguments; useful for debugging downloads.
- `make get <predictionId>`: wrapper for `node replicate/get.js` to fetch a single prediction artifact.
- `npm test`: placeholder echo that succeeds; extend when real tests exist.

## Coding Style & Naming Conventions
JavaScript files use ES modules, 4-space indentation, and single quotes for strings unless interpolation requires template literals. CLI flags prefer kebab-case (e.g., `--file`). Functions are camelCase (`getModelConstraints`), constants are SCREAMING_SNAKE_CASE, and file names stay lowercase with hyphens where needed (`get-models.js`). Run `node venice/index.js --help` etc. after large edits to ensure flag descriptions match implementation.

## Testing Guidelines
Run `npm test` to execute `tests/smoke.test.js`, which spawns each CLI with mock network responses (via `*_SMOKE_TEST=1`) and verifies files land in temp directories. Extend that suite when adding new providers or output types. For manual checks, still spot-test:
1. `venice --prompt "Smoke test"` saving under `images/venice/`.
2. `falflux --prompt "Smoke test" --out` to confirm image/video downloads.
3. `repflux` listing/downloading actual predictions with valid credentials.
Document intentionally skipped scenarios in PR descriptions alongside sample artifacts.

## Commit & Pull Request Guidelines
Follow the existing concise, imperative style (`better help messages`, `update models`). Scope commits narrowly per provider or feature. PRs should include: summary bullet list, reproduction steps or CLI commands, expected/actual output, and screenshots or sample file paths when UI/asset changes occur. Link to relevant issues or TODOs in `CLAUDE.md`, call out required secrets (VENICE_API_TOKEN, FAL_KEY, REPLICATE_API_TOKEN), and request review from domain owners before merging.

## Security & Configuration Tips
Never commit API tokens; load them via shell exports (`export VENICE_API_TOKEN=...`). Prefer `.env.local` ignored by git for local experiments. When handling uploaded source images, scrub paths before logging. Rotate cached `venice/models.json` after provider updates to avoid stale endpoints.
