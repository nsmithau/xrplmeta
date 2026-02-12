# The XRPL Meta Node

This is a JavaScript (ES modules) implementation of the [XRPL Meta](https://xrplmeta.org) project.

XRPL Meta collects metadata about digital assets on the XRP Ledger and exposes it via a **JSON REST and WebSocket API** (documented at [xrplmeta.org/docs](https://xrplmeta.org/docs)). It connects to one or more [rippled](https://github.com/XRPLF/rippled) or [clio](https://github.com/XRPLF/clio) nodes, tracks the ledger in real time, backfills history, and enriches data by scraping external metadata sources.

## Technical Overview

**Startup order:** On launch, the ledger app runs first (required): it creates or resumes a full snapshot of the latest ledger, then syncs with the live stream and starts backfilling older ledgers. Once the node is “in sync,” the crawl app and cache app start in parallel. The server always starts and serves the API (even if crawl or cache fail). Use `--only-server` to skip ledger/crawl/cache and run only the server (assumes existing databases).

**Databases:** Two SQLite databases (StructDB) live in the config data directory: **core.db** holds ledger and asset state (accounts, tokens, tokenProps, NFT state, offers, derivatives such as market cap and holders). **cache.db** holds merged metadata and icons produced by the cache workers, plus a todo queue for cache tasks.

**Ledger pipeline:** A pool of WebSocket connections to `[[LEDGER.SOURCE]]` URLs supplies ledger data. The snapshot pulls `ledger_data` in chunks; sync consumes the live stream and applies ledger events and state from transactions; backfill does the same in reverse from the first stored ledger down to `backfill_to_ledger`.

**Crawlers** (each can be disabled via config) add metadata from external sources:

- **Trustlists** – TOML trustlists (e.g. xrplmeta, Xaman) with token metadata (XLS-26)
- **Domains** – For issuers with a Domain set, fetches `/.well-known/xrp-ledger.toml` (XLS-26)
- **XRP Scan** – Usernames, social links, verifications for accounts
- **Gravatar** – Avatars using account EmailHash
- **Xaman** – Curated assets, KYC, avatars (API key required)
- **Bithomp** – Icons, usernames, links (API key required)
- **X (Twitter)** – Icons, display names, links (bearer token required)

**Cache workers:** A meta cache worker refreshes merged token/account props, token exchanges, and token metrics (trustlines, holders). An icon cache worker processes and stores icon assets. Merging respects the config **source_ranking** for conflict resolution between sources.



## The Config File

When starting the node for the first time, it will automatically create a directory called `.xrplmeta` in the user's home directory. A copy of the [default configuration file](https://github.com/xrplmeta/node/blob/develop/config.template.toml) will be put there, and used.

Alternatively, you can specify which config file to use using

    node src/run --config /path/to/config.toml

The config file uses stanzas for each component (e.g. server in `src/srv`, crawlers in `src/crawl/crawlers`). Delete or comment a stanza to disable that component. Review the comments in `config.template.toml` for parameter details.



## API Documentation

https://xrplmeta.org/docs

The node will listen for incoming HTTP connections on the port specified in the config file. These can either serve a REST query, or be upgraded to a WebSocket connection.



## Install for production use

Install the public NPM package:

    npm install -g xrplmeta

This will add the `xrplmeta` command to your PATH. Simply run this command to start the server. A template configuration file will be placed in your user directory. It is recommended to adjust this config.



## Install for development

Clone this repository and install the dependencies:

    npm install

The development node can be started using:

    node src/run

**Other commands:**

- `node src/run rebuild-cache` – Rebuild the cache database from core data.
- `node src/run backup <path>` – Write a backup to the given file path.

On `npm install`, the postinstall script builds the native SQLite XFL extension in `deps/` (node-gyp).

## Testing

- **Unit tests:** `npm test` (Mocha; runs `test/unit/*.test.js`).
- **Live tests:** `npm run livetest` (runs `test/live/run.js` and cases under `test/live/cases/`).

## Requirements

- Node.js version +14

- An internet connection

- More than 3 GB of disk storage