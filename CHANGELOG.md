
# Changelog

The goal of this file is to document the changes to the Wollok language definition.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Since 3.4.0 version, the Wollok language adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## v1.0.0

- ESM migration
- using tsx compiler instead of ts-node
- TODO: Vitest instead of chai/mocha/sinon
- lts/jod (Node 22)
- removing pkg

## v0.4.0

- ⬆️ Wollok version 4.2.3
- 🚥 Fixed codecov coverage report using a token by @fdodino
- 🌲 Added a `wollok ast` command to show Wollok parser nodes by @fdodino
- ✅ Added a `wollok lint` command to show Wollok validations by @fdodino
- 1️⃣ `wollok init` enhancements: avoid using special characters in project name, use Wollok version and fix package name when generating package.json
- 🖌️ asset folder set from cli params prior to package.json definition
- Starting CHANGELOG.md file