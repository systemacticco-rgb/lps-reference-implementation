# LPS Survival-Test Tool

The LPS Survival-Test Tool is a reviewer-facing demo for testing whether an embedded provenance signal survives ordinary copy/paste and editor round trips.

Paste text into the tool, sign it with the demo key, copy the signed output into another editor such as Word, Notion, Slack, or iMessage, then paste it back into the verifier. The report shows whether the embedded signal survived and whether the provenance signature is still intact.

## Demo Key Only

This tool uses a separate demo private key and demo certificate. It never uses the project's real production signing key.

Manifests signed by this tool are labeled:

```text
lps-demo-tool-v0.1
```

Do not treat output from this tool as output from the real LPS reference implementation.

## Content Warning

Do not paste confidential, private, regulated, or sensitive text into this tool. It is a public demo tool intended for evaluation, not a secure production service.

## Disclaimer

A signature from this tool attests only to provenance: whether the signed text still matches the embedded provenance manifest.

It does not say the content is accurate, safe, lawful, complete, or appropriate to use.

## Run Locally

From the repository root:

```sh
npm install
```

The demo keypair must already exist at:

```text
survival-test-tool/demo-keys/demo-private.pem
survival-test-tool/demo-keys/demo-cert.pem
```

Do not use production key material with this tool.

Set the frontend origin that is allowed to call the server:

```sh
export SURVIVAL_TOOL_FRONTEND_ORIGIN="http://localhost:8080"
```

Optionally choose a server port:

```sh
export SURVIVAL_TOOL_PORT="8787"
```

Start the backend:

```sh
node survival-test-tool/server/server.mjs
```

Then serve or open the frontend from:

```text
survival-test-tool/frontend/index.html
```

The sign and verify endpoints are available at:

```text
POST /sign
POST /verify
```

## What This Does Not Do

- No registry lookup.
- No production key access.
- No PROPOSAL 005 recovery states.
- No claim about whether the text itself is true, safe, or appropriate.

This tool is scoped strictly to sign, embed, verify, and report whether the provenance signal survived.
