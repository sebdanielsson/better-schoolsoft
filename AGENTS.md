# Working in this repository

A React + TypeScript single-page app for [SchoolSoft](https://www.schoolsoft.se/), bundled with Vite and deployed to Vercel.

## Toolchain

| Tool                                               | Role                            | Config             |
| -------------------------------------------------- | ------------------------------- | ------------------ |
| [Vite](https://vite.dev/)                          | Dev server and production build | `vite.config.ts`   |
| [Oxlint](https://oxc.rs/docs/guide/usage/linter)   | Linting (type-aware)            | `oxlint.config.ts` |
| [Oxfmt](https://oxc.rs/docs/guide/usage/formatter) | Formatting                      | `oxfmt.config.ts`  |
| [TypeScript](https://www.typescriptlang.org/)      | Type checking                   | `tsconfig.json`    |
| `node --test`                                      | Test runner                     | —                  |
| [pnpm](https://pnpm.io/)                           | Package manager                 | `package.json`     |

Each tool is a direct devDependency and is invoked through the `package.json` scripts. There is no wrapper CLI — run `pnpm run <script>`, or `pnpm exec <tool>` for one-off flags.

## Commands

```bash
pnpm install         # install dependencies
pnpm dev             # dev server, proxies /schoolsoft/* to sms.schoolsoft.se
pnpm run check       # format check + lint + type check (what CI runs)
pnpm run format     # rewrite files with oxfmt
pnpm run lint        # oxlint, type-aware, warnings are errors
pnpm run typecheck   # tsc --noEmit
pnpm test            # node --test over src/ and api/
pnpm build           # tsc && vite build
pnpm preview         # serve the production build
```

## Notes

- Type-aware lint rules run through `oxlint-tsgolint`; it is a devDependency and needs no extra flags beyond `options.typeAware` in `oxlint.config.ts`.
- Tests use Node's built-in runner with native TypeScript type stripping, so Node >= 22.18 is required. `mise.toml` and `devEngines` both pin Node 24.
- Oxfmt sorts Tailwind classes using `src/index.css` as the v4 stylesheet entry point. Re-run `pnpm run format` after touching `className` strings.
- `.agents/` and `.claude/` hold vendored agent skills pinned by `skills-lock.json`. They are excluded from both oxfmt and oxlint — do not reformat them.

## Checklist

- [ ] Run `pnpm install` after pulling remote changes.
- [ ] Run `pnpm run check` and `pnpm test` before pushing.
