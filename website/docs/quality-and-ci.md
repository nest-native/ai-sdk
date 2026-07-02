# Quality and CI

The repository ships the same review posture as its sibling `@nest-native`
packages, using `node:test` and `c8`.

## Gates

- Package build, typecheck, and tests on Node.js **22** (the supported line).
- Coverage with `c8`, enforced at **100%** for statements, branches, functions,
  and lines on the package source.
- Cognitive complexity enforced with SonarJS at a threshold of **15** per source
  function.
- Package tarball validation and README/docs link validation.
- Sample version sync — every `sample/*` pins `@nest-native/ai-sdk` to the
  package version.
- High-severity supply-chain audit.
- Docusaurus site build.
- Sample matrix — the showcase and every focused sample boot and assert behavior.

## Running The Gate Locally

```bash
npm run ci
```

This runs typecheck, coverage, complexity check and report, the release checks,
the supply-chain audit, and the sample matrix. The docs build runs in CI via the
`docs-site` job and can be run locally with:

```bash
npm run ci:docs
```

## PR Reports

Pull requests get sticky comments for:

- **Coverage** — per-file coverage with a diff against the base branch.
- **Test performance** — test-step duration against the base branch.
- **Cognitive complexity** — per-function complexity against the base branch.

## Coverage Philosophy

100% is enforced, not aspirational. Every branch is covered — every `??`, every
option path, every error path. Coverage is never lowered to merge; tests are
added instead. Complexity is never reduced by weakening enhancer integration,
AbortSignal correctness, or test coverage.

## Supply Chain

The published package keeps `"dependencies": {}` empty. Every dependency change is
reviewed for legitimacy, lifecycle scripts are inspected, and unpinned Git/URL
dependencies are flagged. The AI SDK is a fast-moving peer; its changelog is
reviewed at every bump. See [Security](security.md).
