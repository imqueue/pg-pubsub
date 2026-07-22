# Security Policy

## Reporting a vulnerability

If you believe you have found a security vulnerability in **@imqueue/pg-pubsub** (or
any `@imqueue/*` package), please report it **privately** — do not open a public
issue, pull request, or discussion for it.

Two private channels:

- **GitHub** — use *Security → Report a vulnerability* on this repository to open a
  private advisory (preferred; it keeps the report and the fix coordinated in one
  place).
- **Email** — <support@imqueue.com> with the details below.

Please include:

- the affected package and version(s);
- a description of the issue and its impact;
- steps to reproduce, or a proof of concept, where possible.

## What to expect

- We aim to acknowledge a report within a few business days.
- We'll confirm the issue, keep you updated on progress, and coordinate a fix and a
  disclosure timeline with you.
- Once a fix is released we'll credit the reporter in the advisory unless you prefer
  to remain anonymous.

## Supported versions

Security fixes land on the latest published release line of each `@imqueue/*`
package on npm. Please make sure you can reproduce an issue against the current
release before reporting.

## Scope

The `@imqueue` framework is open source under GPL-3.0. This policy covers the code
in the `@imqueue/*` packages. Vulnerabilities in third-party dependencies should be
reported to those projects, though we're glad to help coordinate an upgrade.
