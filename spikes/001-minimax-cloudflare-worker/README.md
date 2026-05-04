# 001: MiniMax Music 2.6 via Cloudflare Workers AI

Question: can this worktree generate a fresh instrumental focus sample with MiniMax Music 2.6 using the existing Cloudflare Wrangler OAuth login, without needing a separate MiniMax API key?

Given the account has Wrangler AI write access,
When a temporary Worker with an AI binding calls `env.AI.run('minimax/music-2.6', ...)`,
Then we should receive a real generated-audio result we can download and verify.

Artifacts created in this spike:
- `src/index.js` + `wrangler.jsonc`: temporary Cloudflare Worker route for `env.AI.run(...)` checks.
- `focus-prompt-v1.txt`: Kimi-shaped prompt for non-organ instrumental focus music.
- `minimax_direct_generate.py`: direct MiniMax API harness using `MINIMAX_API_KEY` and the free/premium model names from the official OpenAPI schema.

Status: in progress.
