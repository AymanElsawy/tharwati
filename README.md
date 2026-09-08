# Tharwati

Monorepo containing the Tharwati web and mobile apps plus the shared Supabase backend.

```
apps/
  web/       Vite + React + TypeScript + shadcn/ui  (deployed on Cloudflare Pages)
  mobile/    Flutter app
supabase/    Shared backend: migrations + edge functions (used by both apps)
docs/        Feature specs (kept in sync with code)
```

## Web (`apps/web`)

From the repo root (npm workspaces):

```bash
npm install          # installs apps/web deps
npm run dev          # vite dev server
npm run build        # tsc -b && vite build
npm run test         # vitest
npm run lint
npm run typecheck
```

`@db/*` resolves to the repo-root `supabase/` directory (see `apps/web/vite.config.ts` and `tsconfig.app.json`).

### shadcn/ui components

```bash
cd apps/web && npx shadcn@latest add button
```

## Mobile (`apps/mobile`)

Requires the Flutter SDK. From the repo root:

```bash
npm run mobile:get         # flutter pub get
npm run mobile:run         # flutter run
npm run mobile:test        # flutter test
npm run mobile:build:apk
npm run mobile:build:ios
```

## Deployment

The web app deploys on **Cloudflare Pages**:

- **Root directory** (project setting): `apps/web`
- **Build command**: `npm run build`
- **Build output directory**: `dist`
- SPA routing: Cloudflare Pages serves `index.html` for unmatched routes automatically (or add `apps/web/public/_redirects` with `/*  /index.html  200`).
