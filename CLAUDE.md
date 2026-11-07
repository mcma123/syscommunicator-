<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

All Convex code lives in `packages/backend/convex/` (run Convex CLI commands from
`packages/backend`). When working on Convex code, **always read
`packages/backend/convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills are installed at the repository root (`.claude/skills`,
`.agents/skills`). Refresh guidelines with `npx convex ai-files install` from
`packages/backend`, then delete the duplicate skill folders it creates there.

<!-- convex-ai-end -->
