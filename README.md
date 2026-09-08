# CLA signatures

This branch stores the CLA Assistant signature file (`signatures/version1/cla.json`)
and nothing else. It carries no code and is never merged into `master`.

It exists because the signature file is written by a bot, with a direct commit and
no pull request. `master` is covered by a ruleset that requires a status check on
every push, which a bot commit cannot satisfy — so storing signatures there made
every signature fail to record, and no outside contribution could be merged. The
action's own guidance is that the signature branch must not be protected.

Do not add branch protection or a ruleset covering this branch.

Configured in [`.github/workflows/cla.yml`](../blob/master/.github/workflows/cla.yml).
