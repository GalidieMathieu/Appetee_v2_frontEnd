# Appetee Frontend — AGENTS.md

## Purpose

Work safely and incrementally in the Appetee Angular frontend.

Implement exactly one documented phase per task. The task prompt must provide:

```text
Spec: <path to an F-XXX or E-XXX directory>
Phase: <number>
```

If the spec path or phase cannot be resolved, do not guess the intended work.

## Context Loading

Keep context minimal.

For the supplied spec:

1. Read only the requested phase in `README.md`.
2. Read the same phase in `frontend.md` if it exists.
3. Read only decisions, dependencies, or files under `assets/` explicitly referenced by that phase.
4. Inspect only affected feature/core code and tests.

Do not automatically read:

- other phases;
- `backend.md` or `infrastructure.md`;
- unrelated F-XXX or E-XXX documents;
- the roadmap;
- the full production-readiness audit;
- the whole repository.

Use targeted search/range reads rather than loading large documents in full.

The supplied specification is the source of truth for requested behavior.
This file contains permanent engineering constraints.

## Scope

Implement only the requested phase.

Do not implement later phases, unrelated UI cleanup, speculative abstractions, or opportunistic refactors.

Do not modify the backend repository.

If a minimal out-of-phase change is required for compilation, routing, or testing, make only that change and report it.

## Repository Map

- `src/app/core` — app-wide auth/session, guards, interceptors, layout, and truly global infrastructure.
- `src/app/features` — feature pages, components, feature state, forms, and feature data access.
- `server.js` — production static host.
- `public` — public static assets.

Keep feature-specific and temporary workflow state inside its feature when practical. Do not move feature state into `core` merely for convenience.

Follow existing Angular standalone, strict TypeScript, and typed-form patterns.

## Security Invariants

Preserve these on every change:

- Treat Angular guards, hidden controls, and client-side roles as UX only; the backend is the authorization boundary.
- Do not send client-selected user/owner/role/permission fields when the API derives them from the authenticated session.
- Do not make browser-calculated nutrition, cost, ownership, permission, or workflow state authoritative.
- Send credentials only to the configured Appetee API boundary.
- Never store authentication credentials in `localStorage` or `sessionStorage`.
- Clear all user-scoped state when identity changes or logout completes.
- Bound session/bootstrap waits so startup cannot hang indefinitely.
- Preserve the documented CSRF/antiforgery mechanism for state-changing API calls; never remove it to bypass a rejection.
- Preserve Angular escaping. Do not introduce sanitizer bypasses, unsafe dynamic HTML/script execution, `eval`, or `new Function`.
- Never place secrets in frontend source, environment files, logs, or bundles; anything shipped to the browser is public.
- Frontend file checks are UX only; never treat filename or MIME type as proof that an upload is safe.
- Do not duplicate backend authorization or business rules to compensate for a missing API contract.
- Avoid unbounded catalogue loading and N+1 hydration patterns when the API contract provides or requires bounded aggregate data.
- Do not weaken an existing security control merely to make a phase work.

If the requested spec conflicts with one of these invariants, stop and report the conflict.

## UI and State Rules

For modified flows, handle applicable loading, empty, error, success, retry, and submitting states.

Keep strict typing; do not use `any` simply to make compilation pass.

Manage Observable/component lifecycles and clean up temporary resources such as object URLs.

Preserve semantic HTML, labels, keyboard access, focus behavior, form error association, and responsive behavior for changed UI.

## Tests

Tests are part of the phase.

For every code-changing phase:

- implement the tests listed for that phase;
- add the minimum regression tests needed for changed routing, auth/session state, validation, failure handling, accessibility, or uploads;
- never delete or weaken a security/regression test just to make the suite pass.

Run targeted tests during development and, when practical before completion:

```bash
npm run build
npm run test -- --watch=false
npx --no-install tsc --noEmit -p tsconfig.app.json
npx --no-install tsc --noEmit -p tsconfig.spec.json
```

Use `npm ci` in a clean environment. Run dependency checks when package files change or the phase concerns dependencies.

Report only checks actually run. Distinguish pre-existing failures from failures introduced by the phase.

## Done

A phase is done only when:

- the requested phase is implemented and no later phase was added;
- required tests exist and relevant checks pass, or remaining failures are explicitly reported;
- user state cannot leak across identities;
- security authority remains on the backend;
- API calls match the documented contract;
- changed UI handles required states and does not regress accessibility;
- required documentation/contracts for that phase are updated.

Do not mark the entire F-XXX or E-XXX complete unless all of its phases are complete.

## Final Report

Keep the final response concise:

```text
Phase:
Files changed:
Tests/checks:
UI/API/security impact:
Manual verification:
Deferred to later phases:
```
