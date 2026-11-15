# PulseOps

An Angular 21 microfrontend learning project. `mfe-shell` is a runtime federation host; `mfe-orders` and `mfe-inventory` expose routes from independently built remote entries. Domain data remains simulated in memory. The shell owns a demo login/session shared with both composed remotes.

## Run locally

Install dependencies once at the workspace root. Use a Node version matching `package.json` (the project was verified with Node 24.14; the quality toolchain requires Node 24.14 or newer within major 24).

```sh
npm ci
```

Start all three applications with one command:

```sh
npm run start:all
```

The launcher checks ports 4200, 4201, and 4202, then starts the shell and both remotes. It reports occupied ports rather than silently reusing a potentially stale server. Stop old servers before launching; Ctrl+C stops the processes owned by this launcher.

Alternatively, start each application in a separate terminal, preferably remotes first:

```sh
npm run start:orders      # http://localhost:4201/orders
npm run start:inventory   # http://localhost:4202/inventory
npm run start:shell       # http://localhost:4200/orders (also npm start)
```

Restart any previously running Angular servers after the federation configuration changes. If 4200 is occupied, use `npm run start:shell -- --port 4300`. The remote URLs are independent of the shell port.

## Demo sign-in and shared session

Open `http://localhost:4200`. Protected orders/inventory URLs redirect to `/login`; successful demo sign-in returns to the requested internal page. Direct `/login` defaults to orders after sign-in.

- Email: `operator@pulseops.demo`
- Password: `PulseOpsDemo!`

This is a learning-only, client-side credential check, **not backend authentication or authorization**. Only use the supplied sample account. A 30-minute demo marker is kept in this tab's `sessionStorage` so reload can restore the demo user. The marker stores no password or authentication token, and can be modified by client-side code; it is not a trusted credential. Production authentication needs a backend/identity provider and server-enforced access checks.

The root `App` renders an outlet. The public login page sits outside `WorkspaceLayout`, which owns the protected navigation/frame. The shell provides `SESSION_CONTEXT` using its `DemoSession` instance. The `@pulseops/auth-contract` module is a singleton federation mapping in all three projects, ensuring remotes inject the same token and read the host-provided user.

Standalone remote previews deliberately provide `preview@pulseops.demo` as a fixture identity; they do not share the host tab's session memory. Sign out or expiry clears the host's demo marker and reloads the document, which also discards remote stores and pending fixture requests. An allowlisted return URL accepts orders, one order detail, and inventory; external or unsupported destinations fall back to `/orders`.

Keep the host URL consistent: `localhost` and `127.0.0.1` have separate browser storage origins. Changing between them starts a separate demo session.

## Remote entries and host configuration

- Orders: `http://localhost:4201/remoteEntry.json`
- Inventory: `http://localhost:4202/remoteEntry.json`
- Host manifest: `mfe-shell/public/federation.manifest.json`
- Exposed route key: `./Routes` in each remote's `federation.config.mjs`
- Host loading: `mfe-shell/src/app/app.routes.ts` calls the runtime's `loadRemoteModule()`.

Native Federation generates **remoteEntry.json**, not Webpack's remoteEntry.js. Do not create or edit the generated metadata by hand. It describes shared dependencies and maps exposed keys to generated JavaScript files.

The Angular 21-compatible adapter is `@angular-architects/native-federation-v4@21.2.18`. Each app's `main.ts` initializes federation before dynamically importing `bootstrap.ts`. The shell passes the returned runtime into its route factory; the factory uses its `loadRemoteModule` rather than the deprecated global loader.

```ts
// Simplified from mfe-shell/src/app/app.routes.ts
const { loadRemoteModule } = runtime;
const module = await loadRemoteModule('mfe-orders', './Routes');
return module.ORDERS_ROUTES;
```

There are no domain source aliases or imports in the shell. It downloads the remotes' exposed routes and domain chunks at runtime. Standalone domain bootstraps run only when opening those applications directly; the composed remote routes run inside the host Angular application's injector. Separate standalone tabs have independent memory.

## Project map

```text
mfe-shell/
  federation.config.mjs             # Shared dependency policy; no exposed feature
  public/federation.manifest.json    # Remote names -> remote entry URLs
  src/main.ts                       # Federation initialization
  src/bootstrap.ts                  # Angular bootstrap after initialization
  src/app/app.ts                    # Root router outlet
  src/app/workspace-layout.ts        # Protected frame and sign out
  src/app/auth/login/login.ts        # Demo login form
  src/app/auth/demo-session.ts       # Demo session restore/expiry/logout
  src/app/auth/auth.guards.ts        # Guest/protected route handling
  src/app/auth/return-url.ts         # Internal destination allowlist
  src/app/app.routes.ts             # loadRemoteModule + failure fallback
  src/app/remote-unavailable.ts
mfe-orders/
  federation.config.mjs             # Exposes ./Routes
  src/main.ts                       # Standalone federation initialization
  src/bootstrap.ts                  # Standalone Angular bootstrap
  src/app/orders.routes.ts          # ORDERS_ROUTES
  src/app/orders-store.ts           # Signal state + RxJS loading
  src/app/orders-api.ts             # Asynchronous fixture adapter
mfe-inventory/
  federation.config.mjs             # Exposes ./Routes
  src/main.ts
  src/bootstrap.ts
  src/app/inventory.routes.ts       # INVENTORY_ROUTES
  src/app/inventory-store.ts
shared/auth-contract/index.ts       # Singleton session token and types
shared/notifications/index.ts        # Concrete shared NotificationService
shared/styles.css                   # Shared CSS compiled into each app
angular.json                        # Federation wrapper + underlying Angular targets
```

`serve.options.port` is 4200/4201/4202. The `serve-original` target holds the underlying Angular dev-server settings. The federation build wraps the `esbuild` target; use the normal build/serve scripts so remote metadata is emitted.

## Shared notification service

`shared/notifications/index.ts` exports a concrete `NotificationService` through `@pulseops/notifications`. It uses `providedIn: 'root'`; all three federation configurations share the module as a singleton mapping. Both runtime class identity and the application injector matter: composed remote pages and the shell resolve the same service instance. Do not add the service to remote component or route `providers`, which would create a narrower instance.

```ts
import { inject } from '@angular/core';
import { NotificationService } from '@pulseops/notifications';

const notifications = inject(NotificationService);
const id = notifications.notify('inventory', 'A local stock action completed.');
// notifications.messages(): newest-first collection, capped at five entries
// notifications.latest(): newest entry or no entry
notifications.dismiss(id);
notifications.clear();
```

The workspace notification center displays a shell welcome message and notices emitted by order-status actions and inventory reservations/reset. Dismiss or clear them in the shell; the remotes' latest-notice readouts update through the same service. Notifications survive route navigation in the current application and reset on reload or logout. Domain stores remain owned by orders and inventory.

Try it after restarting all three servers for the new federation mapping:

1. Run `npm run start:all` and sign in with the existing demo account.
2. Simulate an order update; find the Orders notice in the shell center and the remote's latest-notice readout.
3. Open inventory and reserve a unit; find the Inventory notice alongside the earlier notice.
4. Dismiss the latest notice or clear the center, then observe the remote readout change.
5. Open inventory directly on 4202; its standalone preview has its own notification instance and does not update the shell tab.

No new npm dependency is required. This service shares UI notifications within one composed Angular application; it provides neither cross-tab communication nor backend event delivery, and should not become a shared business-state store.

## Failure behavior

An unavailable remote entry is tolerated during initialization. Failure to load a remote's exposed routes shows a shell-owned fallback while available domains remain navigable. Restore the remote and select **Reload and retry**: Angular caches loaded route configurations, so recovery intentionally uses a full page reload. This handles entry/exposed-route loading failures; it is not a universal boundary for all runtime errors or later nested chunk failures. The initial document shows startup progress before Angular mounts. A fatal initialization failure shows a recovery message rather than an empty root. These states help distinguish startup problems from a remote route fallback.

Compatible Angular/RxJS dependencies are shared as singletons with explicit version requirements. Shared runtime code does not imply shared business state or security isolation. The CSS is a build-time shared input; changes to global styles can still require coordinated builds.

## Verify

```sh
npm test                  # 14 domain/store, return-URL, and notification tests
npm run check:boundaries   # Reject all cross-project source imports
npm run build             # All 3 production builds
npm run test:e2e           # 17 login/session, federation, and shared notification browser checks
```

Individual builds: `npm run build:shell`, `npm run build:orders`, `npm run build:inventory`. Deploy each complete `dist/<project>/browser` directory; keep metadata, hashed chunks, and shared artifacts together. Update the manifest URLs per environment and configure appropriate CORS, MIME types, and SPA fallback. This repository verifies local runtime loading; production publishing and a release pipeline are not configured.

Browser checks use installed Google Chrome by default and start temporary artifact servers on 4300, 4201, and 4202. Stop servers on those ports first. If Chrome is unavailable, install a Playwright Chromium browser (`npx playwright install chromium`) and set `PLAYWRIGHT_CHANNEL=chromium`. Tests cover login redirects, validation, return destinations, shared session identity, restore/logout, cross-origin route loading, detail input binding, standalone bootstraps, and remote recovery. The generated shell JavaScript is checked for absence of domain fixture content.

For already running development servers (shell on 4300, remotes on 4201/4202):

```sh
PULSEOPS_E2E_EXTERNAL=1 npm run test:e2e -- --grep 'shell loads|direct remote|unavailable'
```

## Product walkthrough and documentation

Sign in with the demo account, then observe order loading, search/filter, open details, and simulate fulfillment. Use the fixture controls for an empty collection or API failure and recover with healthy demo data. Reserve inventory, navigate away, and return to see domain-owned state survive. Full browser reload resets domain fixtures while restoring an unexpired demo session marker in the same tab. There is no backend, persistent domain data, production authentication, or business SSE yet.

- `angular-microfrontend-guide.md`: revision guide and milestone history. Edit it, then run `npm run docs` to regenerate `angular-microfrontend-guide.html`.
- `pulseops-teaching.html`: startup, routing, signals, API boundaries, and federation teaching walkthrough, maintained directly as HTML. Chapter 19 traces remoteEntry loading; chapter 20 explains CLI setup and an optional Nx workflow; chapter 21 traces the implemented demo login and shared session; chapter 23 explains the concrete shared notification service. Nx is documented but has not been installed or used to migrate this repository.

Next: add a backend with server-side validation, then establish release compatibility checks and a demonstrated independent remote rollout/rollback.

When the usual remote ports are already occupied, production-artifact browser checks can use isolated ports without changing the checked-in host manifest:

```sh
PULSEOPS_E2E_ORDERS_ORIGIN=http://127.0.0.1:4401 PULSEOPS_E2E_INVENTORY_ORIGIN=http://127.0.0.1:4402 npm run test:e2e
```

The local verification server substitutes those URLs in its served manifest response; application build files remain unchanged.

## Engineering quality baseline

Use Node 24 (`.nvmrc`, minimum 24.14). Install dependencies once with `npm ci`.

```sh
npm run lint              # ESLint10 + type-aware TypeScript + Angular templates
npm run lint:fix          # Apply supported lint fixes
npm run typecheck         # Check application and test TypeScript
npm run format:check      # Prettier validation
npm run format            # Apply formatting
npm run test:coverage     # Original TypeScript coverage + explicit core gate
npm run quality           # Lint, types, formatting, boundaries, and unit coverage
npm run verify            # Quality, all production builds, and browser contracts
```

You can also run project-only lint checks with `npx ng lint mfe-shell`, `npx ng lint mfe-orders`, or `npx ng lint mfe-inventory`. The root `npm run lint` additionally checks shared code, scripts, and browser tests.

Install the workspace's recommended VS Code extensions: ESLint, Prettier, Angular Language Service, and SonarQube for IDE (formerly SonarLint). Sonar's editor plugin is feedback, not a replacement for CI. The repository includes source/test/coverage configuration and a scanner wrapper; no external Sonar project has been connected or scanned.

The full coverage report includes every runtime TypeScript source, including untested UI/session/bootstrap code. A separate 80% line-coverage gate applies to the seven exercised core rule/adapter/store/service files listed in `scripts/coverage-check.mjs`. It is not an 80% full-application coverage claim. HTML and LCOV reports are under `coverage/`. Long standalone teaching/revision documents are excluded from Prettier because they have their own rendering/validation workflow; application code and configuration are checked.

`.github/workflows/quality.yml` runs the quality checks, builds all three artifacts, and tests federation journeys using the Playwright-pinned Chromium. It retains reports/artifacts and uses SHA-pinned Actions with read-only repository permissions. GitHub must be configured to require this check before merge; a workflow file cannot enable branch protection itself. Dependabot configuration covers npm and Actions updates.

To enable optional server-side Sonar analysis, configure repository variables `SONAR_ENABLED=true`, `SONAR_HOST_URL`, `SONAR_PROJECT_KEY`, and (for Cloud) `SONAR_ORGANIZATION`; put `SONAR_TOKEN` in repository secrets. For a deliberate local scan, set the same connection/token environment variables and run `npm run test:coverage` followed by `npm run sonar:scan`. Do not store credentials in source, shell command arguments, or tracked editor settings. Connect the IDE to the real project through its connection UI. Server-side quality profiles and quality-gate thresholds must be configured on that server.

See [the production-readiness plan](docs/production-readiness.md) for architecture ownership, setup, and the prioritized work still needed for real authentication, backend authorization, tenant isolation, safe deployment, and observability. A passing tooling baseline does not make the demo production-ready.

Testing another branches rule set for another feature branch
