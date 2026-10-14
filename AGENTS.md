<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## School Connect architecture
- Keep the supported TanStack Start web application at the monorepo root and provider-independent domain types and mock repositories in `packages/school-core`; this allows future clients to reuse the same domain contracts without changing the preview bootstrap.
- Keep all module presentation under `src/features/school` and give named modules their own leaf routes; this preserves direct links and module parity across desktop and mobile web.
- Share one in-memory mock repository through the root provider; prototype role switching must see the same state without creating production authorisation or persistence.
- Replace mock repositories with Convex adapters and Clerk integration outside this frontend prototype; components must not call providers directly.
