# Security policy

If you discover a security vulnerability in this package, please report it
privately via [GitHub security advisories](https://github.com/OlivierZal/homey-kit/security/advisories/new)
instead of opening a public issue.

Only the latest published release receives security updates.

## What this package is, for triage

Unlike the tooling in the sibling repositories, this one is a
**production dependency** of the Homey apps that consume it: its
published output installs under `npm ci --omit=dev` and executes on the
device, inside the app process.

Two consequences for a report:

- A vulnerability here reaches **end-user hardware**, not just a build
  environment. The `./webview` and `./settings` subpaths additionally run
  inside phone webviews, so anything touching how they handle values
  crossing that boundary is in scope.
- The package declares **no runtime dependency**, by design. That keeps
  the reachable surface to this repository's own code — so a report about
  transitive risk is best directed at the consuming app, which owns the
  rest of its tree.
