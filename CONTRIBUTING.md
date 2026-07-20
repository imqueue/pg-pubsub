# Contributing to @imqueue

Thanks for your interest in improving @imqueue! Contributions of all kinds are
welcome — bug fixes, features, tests, and documentation.

## Contribution terms — please read first

@imqueue is **dual-licensed**: it is free to everyone under **GPL-3.0**, and it is
also offered under **commercial licenses** for closed-source use. To make that
sustainable, contributions are accepted under the
**[@imqueue Contribution Terms](./CONTRIBUTION-TERMS.md)**.

**By opening a pull request — or otherwise contributing — you agree to those
terms.** In short:

- You **keep the copyright** in your contribution.
- Your contribution stays available to everyone under **GPL-3.0**.
- You grant the project owner the right to **also license your contribution
  commercially**, royalty-free — you will not receive a fee for it.

**If you do not agree, please do not contribute.** Read the full text in
[CONTRIBUTION-TERMS.md](./CONTRIBUTION-TERMS.md).

## How to contribute

1. **Open an issue first** for anything non-trivial, so we can agree on the
   approach before you invest time.
2. **Fork** the repository and create a topic branch from `master`
   (e.g. `fix/redis-reconnect` or `feat/lock-timeout`).
3. **Make your change**, following the existing code style. Keep pull requests
   focused — one logical change per PR.
4. **Add or update tests** so the change is covered, and make sure the full suite
   passes locally:
   ```bash
   npm ci
   npm test
   ```
5. **Write clear commit messages** and a descriptive PR title and summary.
6. **Open the pull request** against `master` and fill in the PR template,
   including the contribution-terms checkbox.

## Guidelines

- Match the existing TypeScript style and formatting already used in the file you
  are editing.
- Keep public API changes documented (doc-blocks / README as appropriate).
- Be respectful and constructive in reviews and discussions.

## Reporting security issues

Please **do not** open a public issue for security vulnerabilities. Report them
privately to the maintainers (see the repository's security policy or contact
address) so they can be addressed responsibly.

---

Questions about the terms or a larger/corporate contribution? Reach out before you
start and we'll help.
