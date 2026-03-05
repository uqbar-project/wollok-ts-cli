
# Changelog

The goal of this file is to document the changes to the Wollok language definition.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Since 0.4.0 version, the Wollok language adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## v1.0.3

- ⬆️ Wollok version 4.2.4
- 🌐 Run CLI without internet connection
- 🖼️ Fix assets paths declaration
- 🛥️ Support for Docker

## v1.0.2

- ⬆️ Wollok version 4.2.3
- 🐛 Another hotfix for wollok init

## v1.0.1

- ⬆️ Wollok version 4.2.3
- 🐛 Hotfix for wollok init

## v1.0.0

- ⬆️ Wollok version 4.2.3
- ⬆️ Wollok web tools version 1.1.10
- 🧬 CommonJS -> ESM migration, ts-node -> tsx compiler
- ⚡ chai/mocha/sinon migration to Vitest
- 🚍 lts/jod (Node 22)
- 🐛 Fix game assets
- 🌌 Fix wollok init calling wollok-ts-cli using npm


## v0.4.0

- ⬆️ Wollok version 4.2.3
- 🚥 Fixed codecov coverage report using a token by @fdodino
- 🌲 Added a `wollok ast` command to show Wollok parser nodes by @fdodino
- ✅ Added a `wollok lint` command to show Wollok validations by @fdodino
- 🌌 `wollok init` enhancements: avoid using special characters in project name, use Wollok version and fix package name when generating package.json
- 🖌️ asset folder set from cli params prior to package.json definition
- Starting CHANGELOG.md file