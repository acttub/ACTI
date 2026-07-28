# Repository Guidelines

## Project Structure & Module Organization

This repository is the deployable Vite + React + TypeScript app for acti (acti.acttub.com). `outputs/` stores the planning deliverables by stage; the app itself lives at the repository root.

Inside `src/`, use `components/` for reusable UI, `pages/` for routed screens, `content/` for questions and type copy, `lib/` for scoring, storage, sharing, analytics, and Kakao helpers, and `styles/globals.css` for shared tokens and base styles. Static assets live in `public/`, including character images under `public/characters/` and share previews under `public/og/`. Build-time scripts live in `scripts/`.

## Build, Test, and Development Commands

Run commands from the repository root:

- `pnpm install` installs dependencies from `pnpm-lock.yaml`.
- `pnpm dev` starts the local Vite server at `http://localhost:5173`.
- `pnpm build` type-checks, bundles into `dist/`, then prerenders the 16 result pages for share crawlers (`scripts/prerender-og.mjs`).
- `pnpm preview` serves the built app locally for release checks.
- `pnpm lint` runs ESLint across the app.
- `pnpm test` runs Vitest once; `pnpm test:watch` starts watch mode.

⚠️ **푸시 전에 `pnpm build`를 반드시 돌린다.** `pnpm test`·`pnpm lint`·`tsc --noEmit`을 전부 통과해도
빌드에서만 터지는 오류가 있다. 빌드의 `tsc -b`는 테스트 파일까지 프로젝트 참조로 엄격하게 검사해서,
예를 들어 `vi.fn(() => ...)` 로 만든 mock 의 `mock.calls[0][1]` 은 빈 튜플 인덱싱(TS2493)이 된다
(고치는 법: `vi.fn<typeof fetch>(...)` 처럼 mock 에 함수 타입을 못박는다).
푸시가 곧 배포라 여기서 놓치면 Vercel 배포가 ERROR 로 끝나고, 사이트는 옛 버전 그대로 남는다.

## Coding Style & Naming Conventions

Use TypeScript and React function components. Follow the existing style: two-space indentation, single quotes, semicolons in TS/TSX files, and explicit exported types where they clarify module contracts. Name React components and files in PascalCase, such as `PrimaryButton.tsx`; name utilities in camelCase, such as `sendResult.ts`. Keep component-specific CSS beside the component or page it styles.

The app uses ESLint with TypeScript, React Hooks, and React Refresh rules. Run `pnpm lint` before submitting changes.

## Testing Guidelines

Vitest with `jsdom` is configured in `vite.config.ts`; setup runs through `src/test-setup.ts`. Place tests next to the code they cover using `*.test.ts` or `*.test.tsx`, for example `src/lib/scoring.test.ts`. Add or update tests for scoring rules, storage behavior, analytics, content invariants, and any user-visible logic changes. Run `pnpm test` before opening a PR.

## Commit & Pull Request Guidelines

Recent commits use short conventional-style messages such as `fix(analytics): ...` and `content(questions): ...`. Prefer `type(scope): summary`, with scopes like `questions`, `analytics`, `ui`, or `share`.

Pull requests should include a concise description, linked issue or context, test results, and screenshots or recordings for UI changes. Call out any environment variable changes, especially `VITE_KAKAO_APP_KEY`, `VITE_SITE_URL`, `VITE_GA_MEASUREMENT_ID`.

## Security & Configuration Tips

Do not commit `.env.local` or service keys. Start from `.env.example`, and keep production secrets in the deployment provider. Kakao sharing and GA can be disabled by leaving their public Vite variables blank.

## 측정 (Vercel Web Analytics)

`index.html`에 `/_vercel/insights/script.js`를 넣어 유입처를 집계한다.
link.acttub.com에서 몇 명이 넘어오는지를 Referrers에서 보는 것이 목적이다.

⚠️ **`vercel.json`의 SPA 폴백 리라이트에서 `_vercel/`을 제외해야 한다.**

```json
{ "source": "/((?!api/|_vercel/).*)", "destination": "/index.html" }
```

`_vercel/`을 빼먹으면 스크립트 요청이 index.html로 리라이트돼 **200 text/html**을
받는다. 404가 아니라 200이라 정상으로 보이지만 집계는 하나도 안 된다.
실제로 이 함정에 걸렸었다. 확인은 상태 코드가 아니라 content-type으로 한다.

```bash
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" \
  https://acti.acttub.com/_vercel/insights/script.js   # 200 application/javascript 여야 한다
```

## Agent Workflow Instructions

Use Superpowers by default. At the start of each task, check whether a Superpowers skill applies and follow it before editing code or asking follow-up questions. Match the workflow to the task: use planning skills for multi-step work, systematic debugging for bugs, TDD for behavior changes when practical, and verification-before-completion before claiming a fix is done.

Bring in gstack expertise at the appropriate stage instead of relying on a single generic review:

- Strategy, scope, or product ambition: use `plan-ceo-review`.
- UI/UX plans or visual design changes: use `plan-design-review` before implementation and `design-review` after implementation when a live screen exists.
- Architecture, data flow, edge cases, or test strategy: use `plan-eng-review`.
- Developer-facing APIs, docs, onboarding, or tooling: use `plan-devex-review` or `devex-review`.
- Browser QA or release confidence: use `qa`, `qa-only`, `review`, or `ship` as appropriate.

When a meaningful mistake, regression, failed assumption, or repeated debugging pattern is discovered and resolved, run Compound Engineering `ce-compound` to record the learning while context is fresh. Prefer `ce-compound mode:headless` for non-interactive follow-up documentation. Capture the symptom, root cause, failed attempts, final fix, prevention rule, and any tests added so future agents can avoid repeating the same mistake.
