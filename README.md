# better-schoolsoft

A faster, friendlier frontend for [SchoolSoft](https://www.schoolsoft.se/)'s guardian view, built with Vite, React and TypeScript and deployed on Vercel.

## Features

- **Home dashboard**: today's lessons with a "now / next up" banner, lunch menu, this week's assignments and plannings, the next calendar event, the latest news and your next booking
- **Schedule**: week view with week navigation
- **Calendar**: the next upcoming event
- **Subjects**: subject rooms with teachers, assignments, plannings and results
- **Absence**: report a full day or single lessons, with comments
- **Messages**: inbox, sent and trash, compose and reply, attachments
- **News**: read state, answers to questions, archive, attachments
- **Bookings**: reserve, confirm and cancel time slots
- **Assessments**: holistic assessments and subject warnings
- **Staff**: searchable directory with a role filter
- **School**: school information and the files & links library
- **Profile**: view and edit your contact details
- **Multiple children**: switch between siblings

See [docs/PARITY.md](docs/PARITY.md) for parity with the official apps.

## Signing in

Pick your school from the list and choose who you are signing in as. You're sent to SchoolSoft's own login page, so your password never touches this app, and then back here. This is the same OAuth flow the official "Vårdnadshavare" app uses; see [docs/auth.md](docs/auth.md) for details. Only guardian accounts can sign in for now.

## Getting started

Requires Node 24 (pinned in `mise.toml`) and pnpm.

```bash
pnpm install         # install dependencies
pnpm dev             # dev server, proxies /schoolsoft/* to sms.schoolsoft.se
pnpm run check       # format check + lint + type check
pnpm test            # unit tests (node --test)
pnpm build           # production build
pnpm preview         # serve the production build
```

### Mock mode

Open the dev server with `?mock=1` to use built-in fake data instead of a SchoolSoft account; `?mock=0` turns it off again. Mock mode is compiled out of production builds unless `VITE_ENABLE_MOCKS=1` is set at build time.

## How it reaches SchoolSoft

The browser never calls `sms.schoolsoft.se` directly. Every request goes to `/schoolsoft/*` on the app's own origin:

- In dev, the Vite proxy in `vite.config.ts` forwards it.
- In production, `vercel.json` rewrites it to the `api/schoolsoft.ts` function, which forwards only the paths and methods the app uses, re-scopes cookies onto our origin, and sandboxes responses.

The app uses two SchoolSoft APIs, Eva (bearer token) and the cookie-session REST API. [docs/auth.md](docs/auth.md) explains which to use when, and [docs/eva-api.md](docs/eva-api.md) documents the endpoints.

## Tech stack

| Tool                                               | Purpose              |
| -------------------------------------------------- | -------------------- |
| [Vite](https://vite.dev/)                          | Dev server & bundler |
| [React 19](https://react.dev/)                     | UI framework         |
| [React Router 7](https://reactrouter.com/)         | Client-side routing  |
| [Tailwind CSS 4](https://tailwindcss.com/)         | Styling              |
| [TypeScript](https://www.typescriptlang.org/)      | Type safety          |
| [Oxlint](https://oxc.rs/docs/guide/usage/linter)   | Linting (type-aware) |
| [Oxfmt](https://oxc.rs/docs/guide/usage/formatter) | Formatting           |
| [Vercel](https://vercel.com/)                      | Hosting + proxy      |
