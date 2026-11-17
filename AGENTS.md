<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AI Coding Agent Governance Rules

All AI coding assistants and autonomous agents (Antigravity, Cursor, Claude Code, Copilot, etc.) working in this repository **MUST STRICTLY ADHERE** to the following operational policies.

---

## 1. Git Commit Message Rule
- **Format:** Every git commit message **MUST** be **2 to 5 words** in plain natural language.
  - ✅ **Valid Examples:**
    - `initialize nextjs project structure`
    - `create project documentation files`
    - `add webrtc signaling hook`
    - `implement offline pwa banner`
    - `fix bluetooth packet chunking`
- **Strict Prohibitions:**
  - ❌ **NEVER** use colons (`:`) anywhere in the commit message.
  - ❌ **NEVER** use Conventional Commit prefixes (e.g., `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `style:`, `test:`).
  - ❌ **NEVER** use multi-line bullet lists, paragraphs, or verbose changelogs in commit subjects.

---

## 2. Mandatory Post-Execution Documentation Sync
After every task: update only the affected entries in `documentation/codebase_map.md`. For bugfixes, refactors, and minor tweaks, append a brief dated/numbered entry under the **Maintenance & Fixes Log** inside `documentation/archive/backlog_sprints_old.md` — NEVER create new micro-sprint entries (e.g., Sprint 34, 35...) in `documentation/backlog.md` unless a brand-new major feature milestone is explicitly requested. Update `about_project.md` only when product behavior or the file tree changes. Then commit and push.

---

## 3. Mandatory Testing Before Completion Gate
Before marking any sprint task as completed (`[x]`) in `documentation/backlog.md` or making a git commit, the agent **MUST** satisfy all verification gates:
- **Unit Tests:** Implement relevant unit tests using Vitest / React Testing Library for newly added utilities, state hooks, and component logic.
- **API Smoke Tests:** For any API routes, run `curl` checks against local development endpoints to confirm status codes and payload schemas.
- **Automated Quality Checks:** All three checks must pass with zero errors:
  1. `npm test` (or `npx vitest run`) -> 100% test pass rate.
  2. `npm run lint` -> Zero ESLint warnings or errors.
  3. `npm run build` -> Clean Next.js compilation with zero TypeScript or bundling errors.
---

## 4. Mandatory Git Commit & Remote Push
Immediately after satisfying all verification gates and completing the documentation sync update, the agent **MUST**:
1. Stage all changed project files: `git add .`
2. Commit changes using a clean **2 to 5 words** natural language message adhering strictly to Rule 1 (e.g. `complete internet mode implementation`).
3. Push the commit to the remote repository: `git push origin <branch>` (e.g. `git push origin main`). Never conclude a sprint or feature without pushing to GitHub.
