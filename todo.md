# Claireco — Next Steps

## Setup (requires local terminal)

- [ ] Log in to Zapier: `npx zapier-sdk login`
- [ ] List your connections: `npx zapier-sdk list-connections --owner me --json`
- [ ] Generate typed app bindings: `npx zapier-sdk add slack google-sheets` (use your actual connected apps)

## Build & Run

- [ ] Compile: `npm run build`
- [ ] Run the quickstart: `npm start`

## Explore

- [ ] List actions for a connected app: `npx zapier-sdk list-actions <APP_KEY>`
- [ ] Inspect input fields for an action: `npx zapier-sdk list-input-fields <APP_KEY> <ACTION_TYPE> <ACTION>`
- [ ] Run an action interactively: `npx zapier-sdk run-action`

## Ideas to Try

- [ ] Read data from one app, write to another (e.g. pull Jira issues and post a summary to Slack)
- [ ] Use the typed `zapier.apps` proxy for autocomplete and type-safe action calls
- [ ] Create client credentials for server-to-server auth: `npx zapier-sdk create-client-credentials`

## References

- CLI reference: https://docs.zapier.com/sdk/cli-reference
- SDK reference: https://docs.zapier.com/sdk/reference
- Quickstart: https://docs.zapier.com/sdk/quickstart
