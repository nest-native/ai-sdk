# Contributing

Contributions are welcome. The full workflow lives in
[`CONTRIBUTING.md`](https://github.com/nest-native/ai-sdk/blob/main/CONTRIBUTING.md)
at the repository root; this page summarizes the expectations.

## Before You Start

- Read the project constitution,
  [`GUIDELINES_NEST_AI_SDK.md`](https://github.com/nest-native/ai-sdk/blob/main/GUIDELINES_NEST_AI_SDK.md).
  It is the governing document for this package.
- Read the [Introduction](introduction.md) and [Why Native](why-native.md) to
  understand the design bar.

## Quality Bar

Every PR must keep the gates green:

- **100% coverage** on the package source — every new branch needs a test.
- **Cognitive complexity ≤ 15** per source function (SonarJS).
- Build and tests pass on Node.js 20 and 22.
- `"dependencies": {}` stays empty in `packages/ai-sdk/package.json` — runtime
  libraries are peers, build/test tools are devDependencies.

Run the full gate before pushing:

```bash
npm run ci
```

## PR Expectations

- Every PR includes an explicit **Security Review** and **Dependency Review**
  section (see the pull request template).
- Library changes and sample changes follow the repository's separation rules.
- Documentation follows Nest-style clarity without claiming official NestJS or
  Vercel AI SDK status.

## Scope Discipline

This package is **streaming integration**, not orchestration. Agent frameworks,
tool execution, provider abstractions, prompt management, embedding/RAG, and MCP
are explicitly out of scope. See the [Roadmap](roadmap.md). A contribution that
expands the scope into those areas will be declined.

## Guideline Evolution

The constitution can evolve when a real inconsistency surfaces between it, the
brief, and implementation reality. Such changes go in a focused commit, quote the
before/after in the PR body, and require maintainer review. The Security, Release
Sync, and Cognitive Complexity sections are not weakened without explicit
maintainer instruction.
