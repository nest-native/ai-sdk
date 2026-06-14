# Security Policy

Thank you for helping keep `@nest-native/ai-sdk` safe for NestJS and Vercel AI
SDK applications.

## Supported Versions

Security fixes target the current published package line.

| Package | Supported |
| --- | --- |
| `@nest-native/ai-sdk` latest minor | Yes |
| Older unpublished branches | No |

## Reporting A Vulnerability

Please do not open a public issue for vulnerabilities or suspected secret
leakage.

Use GitHub's private vulnerability reporting for this repository when available:

<https://github.com/nest-native/ai-sdk/security/advisories/new>

If private reporting is unavailable, contact the maintainer through the GitHub
profile and include only the minimum information needed to establish a private
channel. Do not send exploit details, credentials, API keys, model provider
tokens, or customer data in public comments.

## What To Include

Private reports are most useful when they include:

- Affected package version or commit.
- NestJS, Vercel AI SDK (`ai`), and HTTP adapter (Express/Fastify) versions.
- The smallest reproduction or vulnerable code path.
- Expected impact, such as authorization bypass through `@AiStream`, prompt
  injection paths from request input, secret leakage in streaming responses,
  dependency confusion, or incorrect pre-stream vs in-stream error behavior.
- Whether the issue affects package code, samples, docs, CI, or release
  automation.

Please redact secrets, hostnames, tokens, API keys, and private customer data.

## Project Security Boundaries

This package is a Nest integration layer around the Vercel AI SDK's streaming
surface. Applications still own:

- Model provider credentials and API keys.
- Prompt construction and input handling.
- Authorization and tenant selection.
- Rate limiting, cost controls, and max-token guards.
- Validation choices such as class-validator or app-owned Zod schemas.

Security fixes in this repository focus on package behavior — especially that
pre-stream guard checks run before the first byte, that client disconnect
propagates an AbortSignal to the AI SDK call, and that streaming responses never
leak secrets — alongside samples, docs, release automation, and patterns that
could encourage unsafe usage.

## Disclosure

The maintainer will acknowledge valid private reports as soon as practical,
coordinate a fix when the issue is in scope, and publish release notes or an
advisory when public disclosure is appropriate.
