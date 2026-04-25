# better-schoolsoft

A better frontend for [SchoolSoft](https://www.schoolsoft.se/), built with [VitePlus](https://viteplus.dev/) + React + TypeScript.

## Features

- 🔐 **Authentication** using SchoolSoft's app login API (logintype 4)
- 📅 **Schedule** – weekly timetable with week navigation
- 🍽️ **Lunch menu** – weekly lunch menus, collapsible by week
- 📆 **Calendar** – upcoming events for the next 30 days
- 💾 Session persisted in `localStorage` (auto token refresh)

## Getting started

```bash
# Install dependencies
pnpm install

# Start the dev server (with CORS proxy to sms.schoolsoft.se)
pnpm dev

# Build for production
pnpm build

# Preview the production build
pnpm preview
```

## Authentication

Sign in with your normal SchoolSoft credentials. The **school** field is the subdomain in your SchoolSoft URL:

```
https://sms.schoolsoft.se/<school>/jsp/...
```

For example, if your URL is `https://sms.schoolsoft.se/nacka/jsp/…`, enter `nacka`.

## Tech stack

| Tool | Purpose |
|------|---------|
| [VitePlus](https://viteplus.dev/) | Unified build toolchain |
| [Vite](https://vitejs.dev/) | Dev server & bundler |
| [React 19](https://react.dev/) | UI framework |
| [React Router 7](https://reactrouter.com/) | Client-side routing |
| [TypeScript](https://www.typescriptlang.org/) | Type safety |

## Development notes

The dev server proxies all `/schoolsoft/*` requests to `https://sms.schoolsoft.se` to avoid CORS issues during development. The proxy is configured in `vite.config.ts`.

For Vercel deployments, `vercel.json` rewrites `/schoolsoft/*` to `https://sms.schoolsoft.se/*` so the same API path works in production.
