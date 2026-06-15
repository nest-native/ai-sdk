# Contributing

Thanks for helping improve `@nest-native/ai-sdk`.

## Project Status

The initial `0.x` release covers the surface below, released as `0.2.0` (the
public API may still change before `1.0`). `@AiStream` streams AI SDK
results on both Express and Fastify while preserving the full Nest enhancer
pipeline; `@AiAbortSignal` cancels the AI SDK call when the client disconnects
mid-stream; `@AiContext` injects request-scoped context (`{ request, response,
signal }`) for AI SDK tool `execute` closures; pre-stream vs in-stream errors
are mapped correctly; and the sample catalog covers `streamText`, `streamObject`,
the v5 generative-UI equivalent of `streamUI`, and request-scoped tool context.
The workspace builds, typechecks, tests at 100% coverage, and is CI-green.
Contributions now focus on keeping that surface correct across NestJS minors and
AI SDK majors.

## Sample Work Must Stay Separate From Library Fixes

Once samples exist, sample PRs are allowed to change sample code, docs, CI
wiring, and release checks that are directly needed for samples. They must not
include changes under `packages/ai-sdk/**`.

If a sample exposes a package bug, stop the sample PR and use this workflow:

1. Stash the sample and docs work, including untracked files:

   ```bash
   git stash push -u -m "sample work before library fix"
   ```

2. Create a separate library-fix branch from `main`.
3. Fix the package bug with focused regression tests.
4. Run the package validation commands for that fix.
5. Open and merge the library-fix PR first.
6. Return to the sample branch and re-apply the stash:

   ```bash
   git stash pop
   ```

7. Before committing the sample PR, verify the touched package files list is
   empty:

   ```bash
   git diff --name-only main...HEAD -- packages/ai-sdk
   git diff --cached --name-only -- packages/ai-sdk
   ```

If either command prints files, split those package changes into a dedicated
library-fix PR before continuing the sample PR.

## Local Validation

Run the full local gate before opening a PR:

```bash
npm run ci
```

This runs typecheck, coverage (enforced at 100%), cognitive complexity checks,
release checks (README links and package tarball), and the supply-chain audit.

## Library-Fix PR Checklist

- The PR includes a regression test under `packages/ai-sdk/test`.
- The PR does not include sample implementation work.
- `npm run test:cov` passes at 100% coverage.
- `npm run complexity:check` and `npm run complexity:report` pass when package
  source files are touched.
- The PR body includes a short security pass, reviewing any dependency or
  `peerDependencies` changes (the published `dependencies` must stay `{}`).
