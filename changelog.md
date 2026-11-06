# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Maintenance

- Refresh development dependencies, including shared-config 8.14 and `@vscode/vsce` 4.1, update pnpm to 12.16.1, and remove expired dependency release-age exceptions.
- Align repository Node.js engine metadata with `^22.19.0 || ^24.0.0 || >=26.0.0`.
- Use pnpm's native skill installation instead of the standalone `skills` dependency and prepare hook.
- Remove the `.claude` exemption from `clean-deep` cleanup.
- Run dependency-update automation monthly instead of weekly and refresh CI and release actions, including the GitHub release action's v3 upgrade.
- Make CI link checks skip loopback URLs and accept empty link sets.

## [1.0.2] - 2026-10-06

### Documentation

- Generate the README settings table from the extension manifest, clarify preview width units as logical points, and refresh the version badge.

### Maintenance

- Update development dependencies, including `@kitschpatrol/shared-config` 8, TypeScript 6, Mocha 12, `@vscode/test-electron` 3, `@vscode/vsce` 4, and bumpp 12.
- Migrate to pnpm 12.9.1 and set the development Node.js requirement to `^24.16.0 || >=26.3.0`.
- Refactor path scanning and query parsing for stricter lint rules, update tests and compiler configuration, and target ES2024 builds.
- Add weekly repository and homepage link checks and dependency-update pull requests, and refresh SHA-pinned CI and release actions.
- Add automatic contributor-skill synchronization during package preparation and rename the `clean` script to `clean-deep`.

## [1.0.1] - 2026-05-18

### Changed

- List the extension in the Visual Studio Marketplace's Visualization category.

### Documentation

- Update the README's MIT license link.

### Maintenance

- Refresh development dependencies and migrate to pnpm 11.1.2, moving pnpm settings and build approvals into the workspace configuration; declare Node.js 22.22.2 or later for development.
- Update CI actions, switch installs to `pnpm ci`, and correct quoting and environment handling in the GitHub release workflow.

## [1.0.0] - 2026-04-27

### Added

- Add hover thumbnails and open-file links for cached drawings referenced by absolute or document-relative `.tldr` paths in JavaScript, TypeScript, JSX, TSX, Markdown, MDX, HTML, Astro, and Svelte on VS Code 1.105 or later.
- Match rendering variants from query parameters, ignore the `tldr` and `tldraw` import markers, and fall back to the base cached drawing.
- Add `tldraw-preview.manifestPath` for absolute or workspace-relative cache manifests and `tldraw-preview.maxWidth` for preview sizing, defaulting to 300 logical points.
- Show hover warnings with build instructions when a drawing is uncached or its rendered output is missing.

### Documentation

- Document Marketplace installation, the unplugin-tldraw prerequisite, preview-only behavior, settings, query examples, supported file types, and contribution guidance.

### Maintenance

- Set up TypeScript builds, VS Code integration tests, cross-platform CI, shared linting, and VSIX packaging and release automation.

[Unreleased]: https://github.com/kitschpatrol/vscode-tldraw-preview/compare/v1.0.2...HEAD
[1.0.0]: https://github.com/kitschpatrol/vscode-tldraw-preview/releases/tag/v1.0.0
[1.0.1]: https://github.com/kitschpatrol/vscode-tldraw-preview/compare/v1.0.0...v1.0.1
[1.0.2]: https://github.com/kitschpatrol/vscode-tldraw-preview/compare/v1.0.1...v1.0.2
