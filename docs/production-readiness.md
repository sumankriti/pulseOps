# PulseOps production-readiness plan

PulseOps demonstrates Angular 21 runtime federation, isolated domain stores, a shared platform service, and a complete **demo** login flow. It is not ready to handle real identities, customer records, or stock reservations. Static analysis and CI establish an engineering baseline; they do not supply the missing backend and operating controls.

## Architecture ownership

| Owner                   | Responsibilities                                                                                                                      | Boundary to preserve                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Shell/platform          | Federation bootstrap, navigation, public/protected layouts, session coordination, shared runtime policy, startup/failure presentation | Do not import remote implementation or absorb domain rules.                                  |
| Orders                  | Order routes, fulfillment rules, API adapter, order state, feature validation                                                         | Expose a small route contract; keep the store private to orders.                             |
| Inventory               | Inventory routes, reservation rules, stock state, API adapter                                                                         | Coordinate real reservations through an authoritative backend, not another remote's signals. |
| Shared platform modules | Session contract and bounded notification capability                                                                                  | Share class/token identity deliberately; avoid a general shared business store.              |
| Release owners          | Compatible artifacts, promotion, monitoring, rollback, incident response                                                              | Independent builds still need runtime contract verification.                                 |

The singleton mappings for `@pulseops/auth-contract` and `@pulseops/notifications` preserve runtime identities. Angular's root injector provides instances inside the composed application. Standalone previews and browser tabs have separate memory. Domain data is not synchronized by federation.

## Quality feedback loop

Use local checks while developing and repeat the required checks in CI. Editor extensions are feedback, not the enforcement boundary.

| Command                    | Purpose                                                                      |
| -------------------------- | ---------------------------------------------------------------------------- |
| `npm run lint`             | Enforce TypeScript, Angular, template, and configured maintainability rules. |
| `npm run typecheck`        | Check application and test TypeScript independently of lint rules.           |
| `npm run format:check`     | Detect formatting drift without changing files.                              |
| `npm run check:boundaries` | Validate the repository's permitted dependency directions.                   |
| `npm run test:coverage`    | Run meaningful unit/store tests and generate mapped source coverage.         |
| `npm run quality`          | Run the repository's fast quality checks together.                           |
| `npm run build`            | Build host and both remotes with Angular template/type checking.             |
| `npm run test:e2e`         | Verify generated artifacts and cross-origin user journeys in a browser.      |
| `npm run verify`           | Run the complete local verification sequence.                                |

Inspect `package.json` for the exact task composition. Do not use a successful lint command as proof of a successful production build or federation runtime. Formatting should be separate from correctness rules; fix genuine violations rather than broadly disabling rules.

The import checker is a starter architectural policy. Keep shared-module imports narrow and validate shared modules as well as applications. Runtime remote strings do not produce ordinary compile-time dependencies, so source-boundary checks must be complemented by host/remote compatibility tests.

## SonarQube for IDE and server analysis

SonarQube for IDE is the current name for SonarLint. Use it alongside the ESLint extension. Standalone editor analysis works without a server connection; connected mode aligns the editor with a configured SonarQube Server or Cloud project.

No Sonar organization, server, project binding, or credential has been supplied. Repository configuration can prepare analysis, but cannot establish that a remote scan or server quality gate has passed. Configure the real project and connected-mode binding through the extension UI; keep authentication in the IDE's credential storage or CI secrets, not tracked settings.

CI scanning needs explicit configuration for `SONAR_HOST_URL`, `SONAR_TOKEN`, and `SONAR_PROJECT_KEY`; SonarQube Cloud also needs the actual organization. Enable the optional scan job only after choosing the service/project. Use a narrowly scoped token, do not expose it to untrusted fork pull requests, and do not print it or place it in CLI arguments.

Coverage analysis should import the actual `coverage/lcov.info` report. Generated JavaScript and scratch test output must map back to the real TypeScript files. Keep application files visible even when unit tests do not exercise them. A focused core-rule/service threshold is distinct from application-wide coverage; passing one does not prove the other.

A proposed server policy is to reject new reliability/security issues, require review of new security hotspots, and enforce agreed new-code coverage/duplication limits. Define those conditions in the selected Sonar project and branch policy. They are not enforced simply by adding a properties file. Choose the new-code baseline deliberately; do not exclude difficult source files to make a gate pass.

## Production work in priority order

### P0 — Real identity and authoritative business operations

1. Replace `DemoSession` with a backend/identity-provider session integration. The public sample credentials and `sessionStorage` marker are learning utilities, not authentication.
2. Authorize every protected API operation on the server. Guards and UI permissions improve navigation but cannot secure data.
3. Replace the timer-based order adapter and local reservations with real domain APIs. Validate payloads at runtime and enforce stock changes atomically; define idempotency and concurrency semantics for writes.
4. Derive permitted tenants from verified identity. Scope reads, writes, subscriptions, and caches; cancel or reconcile in-flight work when identity or tenant changes.

**Acceptance evidence:** unauthenticated and cross-tenant requests are rejected by server tests; modified browser state cannot grant access; duplicate/concurrent reservations cannot oversell; logout/expiry invalidates the authoritative session and clears stale domain data.

### P1 — Safe artifact publication and runtime trust

1. Publish complete immutable host/remote artifacts before promoting environment manifests. Retain old hashed assets for open tabs and rollback.
2. Govern trusted manifest locations and publication permissions. Validate remote URLs, serve correct MIME types, and configure HTTPS, CORS, and a tested CSP for the chosen federation/shim mode.
3. Test a candidate remote against supported released host versions. Preserve remote names, exposure keys, exported symbols, and shared-runtime compatibility; the current `Array.isArray` check is only a shallow guard.
4. Define promotion, rollback, cache retention, ownership, and the behavior of already open tabs. A manifest change does not replace modules already evaluated in a page.

**Acceptance evidence:** a compatible remote release and rollback succeed against an unchanged host artifact; metadata never references unpublished files; stale/open-tab scenarios work; untrusted origins fail validation; an unavailable remote preserves supported product journeys.

### P1 — Observability and operational response

Instrument bootstrap, remote loading, domain API errors, and key user journeys. Include host/remote release IDs and correlation IDs while excluding credentials and sensitive payloads. Distinguish startup failures, exposed-route failures, later chunk failures, and component exceptions; the current remote-route fallback does not catch them all.

Set a user-facing availability/latency objective and assign owners. The 10-second startup message is feedback, not a fetch timeout or cancellation policy. Document and exercise incident and rollback runbooks.

**Acceptance evidence:** an injected remote/API failure produces an actionable signal with release identity; the responsible owner can diagnose and recover using the runbook; telemetry retention and access have an agreed policy.

### P2 — Performance, accessibility, and sustainable delivery

Measure cold and warm domain navigations on representative devices and networks. Angular's initial-bundle budget excludes additional shared federation assets and cannot represent complete cold-load cost. Review the global stylesheet as a versioned compatibility input; component-level UI ownership does not automatically isolate CSS.

Exercise keyboard/focus transitions through login, remote navigation, validation, and failure/retry. Add accessibility checks and manual review for critical operator tasks. Track lead time, failed releases, integration failures, and recovery time before claiming an organizational benefit from microfrontends.

**Acceptance evidence:** documented journey budgets pass with complete network waterfalls; key workflows pass keyboard/accessibility review; a shared-style change is tested against supported host/remote versions; delivery metrics show whether federation earns its coordination cost.

## Review checklist for each change

- Which domain/platform owner approves the contract and operating behavior?
- Does the change alter an exposure, shared package, token identity, global style, or runtime assumption?
- Which existing host/remote combinations must remain compatible?
- What user state survives navigation, and what must reset at logout or tenant change?
- Which automated check detects the relevant failure, and what remains a manual check?
- Can the change be promoted and rolled back without losing referenced assets or unsaved work?

## Verification limits

A green local quality suite establishes that the configured checks passed against this checkout. It does not prove backend authorization, production hosting configuration, a remote Sonar gate, independent production rollout, or real multi-team delivery outcomes. Keep those claims tied to explicit acceptance evidence.

References: [Angular route guards](https://angular.dev/guide/routing/route-guards), [Native Federation runtime](https://native-federation.com/docs/v4/angular-adapter/runtime/), [SonarQube for VS Code connected mode](https://docs.sonarsource.com/sonarqube-for-vs-code/connect-your-ide/connected-mode), [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

## Initial quality policy and activation

The local core gate is 80% line coverage per listed file in `scripts/coverage-check.mjs`; full-app coverage remains visible separately. A reasonable initial Sonar new-code policy to agree with the team is no new reliability/security issues, reviewed new hotspots, at least 80% new-code coverage, and at most 3% new-code duplication. Those are proposed server settings, not a gate automatically created by this repository. An initial scan may fail until the baseline and coverage work are deliberately addressed.

For CI Sonar scanning, enable repository variable `SONAR_ENABLED=true` and set the connection/project variables plus the secret token. The job waits for the real server gate. For local scanning, supply those environment variables through your shell/secret manager before `npm run sonar:scan`; do not commit or paste tokens into tracked settings. The workspace currently has no supplied server/project binding.

After pushing to a GitHub repository, require the checks job through branch protection/rulesets. The workflow has not been executed remotely in this session. The current local directory is not itself a Git repository, so no commit, push, or repository administration was performed.

## Verified local baseline — 14 November 2026

- Root ESLint and all three `ng lint` targets passed with zero warnings.
- Independent TypeScript checking, Prettier, and app/shared boundary checks passed.
- 14 unit/store tests passed and generated original-source LCOV. Full-app unit line coverage was 22.96%; the seven listed core files each passed the 80% line gate.
- All three production builds passed.
- 17 browser tests passed using isolated remote test ports 4401/4402, preserving the already running development servers.
- The Sonar wrapper's missing-configuration guard failed clearly as intended. No external scan, connected-mode binding, GitHub workflow run, branch-protection change, or production deployment was performed.

These results establish the configured local quality baseline. The P0 and P1 production acceptance criteria above remain outstanding.
