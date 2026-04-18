<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Dev workflow gotchas

## Always use Node 22

Jest 30 and Next 16 require Node 18+, and `.nvmrc` pins Node 22. If a command fails with module-resolution or SWC errors that don't make sense, check `node -v` first. Start bash invocations with:

```
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use 22 >/dev/null
```

## The ANTHROPIC_API_KEY shell-override trap

The developer's shell profile exports `ANTHROPIC_API_KEY=""` (empty) and `ANTHROPIC_BASE_URL=https://api.anthropic.com`. Next prioritizes `process.env` over `.env.local`, so these shell values win — `/api/process-transcript` will silently return 500 `missing_api_key` even though `.env.local` has a valid key.

**Before running `npm run dev` (or any command that hits the route), unset both:**

```
unset ANTHROPIC_API_KEY ANTHROPIC_BASE_URL && npm run dev
```

This is not a bug in the route handler — the route correctly treats empty-string as missing. It's purely a local-dev shell-env issue. If you see `missing_api_key` and the `.env.local` file does contain a real key, this is almost certainly the cause. Verify with `echo "${#ANTHROPIC_API_KEY}"` (should be 0 from the shell).

Jest tests mock the SDK and set the key per-test, so this trap only affects the live dev server.

## Updating plan.md is part of every commit

See `plan.md` → Documentation. Tick the shipped checkboxes, update the phase tracker, and note deviations in the same commit that ships the work. A commit that changes code without updating `plan.md` is incomplete.
