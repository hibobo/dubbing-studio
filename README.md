# Dubbing Studio

Dubbing Studio is an editable video dubbing workspace for transcript editing, speaker assignment, waveform review, timeline alignment, voice preview, background mixing, and version rollback.

This repository contains the WebDev full-stack source used by the application:

- `client/` — React + Vite editor UI;
- `server/` — Express + tRPC API, authentication, upload proxy, processing-node proxy;
- `drizzle/` — MySQL schema and migrations;
- `shared/` — shared types and constants.

## Features

- Video upload with resumable chunk sessions;
- Transcript and translated-text editing;
- Waveform timeline with draggable segments and zoom control;
- Per-segment voice gain adjustment;
- Single-sentence cloned-voice preview with progress, cancellation, and browser cache;
- Remote version history and rollback;
- Background-audio mixing controls;
- Final export task and download link through an external processing node.

## Requirements

- Node.js 22 or later;
- pnpm 10;
- MySQL/TiDB database for production use;
- Manus OAuth environment variables for authentication;
- A GPT-SoVITS processing adapter for real voice synthesis and final export.

The processing adapter is maintained separately at:

<https://github.com/hibobo/gpt-sovits-processing-node>

Its API documentation is in that repository's `docs/API.md`.

## Local development

```bash
pnpm install
pnpm check
pnpm test
pnpm dev
```

The development server uses the environment variables provided by the WebDev runtime. Do not commit `.env` files or any access token.

## Processing node configuration

Configure these variables on the **server side**:

```dotenv
PROCESSING_NODE_URL=https://voice-node.example.com
PROCESSING_NODE_TOKEN=the-adapter-token
```

`PROCESSING_NODE_TOKEN` must never be exposed to the browser. The server verifies the logged-in Manus user before forwarding preview, export, status, or cancellation requests.

## Production validation

```bash
pnpm check
pnpm test
pnpm build
```

## Security notes

The repository is public by design, so it contains source code only. Runtime credentials, database URLs, OAuth secrets, storage credentials, uploaded media, generated audio, and exported videos must be provided through deployment secrets or environment variables.

The current editor page can render before login, but feature APIs are protected server-side. If the product requires the entire page to be invisible to anonymous visitors, add a route-level authentication guard before deployment.
