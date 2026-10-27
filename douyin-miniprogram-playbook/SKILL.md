# Douyin Miniprogram Playbook

Build, migrate, test, launch, and promote a Douyin mini app from a reusable template.

## Operating rules

- Treat `templates/miniprogram/core/` and `templates/server/core/` as read-only mechanism code. Put project-specific code in `business/` and `server/services/`.
- Keep non-sensitive project values in the two `template.config.js` files. Keep secrets in `setup/.secrets.local.json`, which must never be committed.
- Translate every new requirement into `templates/docs/product-spec.md` first. Ask for confirmation before changing business code.
- Never place real identity documents, private keys, openids, phone numbers, or payment credentials in this skill or a project repository.
- Start platform reviews early, then develop in parallel. Collect user-only actions (scan, verification code, face check, agreement signature, payment) into one blocking checklist.

## Route by user scenario

1. New Douyin mini app: follow `templates/docs/product-spec.md`, then `references/value-map.md`, `references/platform-tasks.md`, and the setup scripts.
2. WeChat migration: copy mechanism files as a unit, use `templates/server/core/wx-compat.js`, and check `references/node-sdk-pitfalls.md`.
3. Payment: read `references/payment-protocol.md`; configure products and secrets, then run the payment checks in `setup/doctor.js`.
4. Wrong environment or no traffic: verify `getEnvInfoSync().microapp.envType` routing and the deployment order in `checklists/launch-checklist.md`.
5. Refund or after-sales: use `scripts/refund-order.js` and the refund section of `references/payment-protocol.md`.
6. Launch review: use `checklists/launch-checklist.md`.
7. Promotion and mounting: use `checklists/promotion-setup.md` and the matching platform task cards.
8. Error diagnosis: check `references/node-sdk-pitfalls.md` and payment error notes.
9. Continue a previous project: run `node setup/doctor.js`, then reconcile the waiting list before collecting approved values.

## First run

1. Copy `templates/miniprogram/` into the new app's `miniprogram/` directory.
2. Copy `templates/server/` into `douyin-cloud/server/`.
3. Edit only the two config files and create `setup/.secrets.local.json` from its example.
4. Run the setup scripts in this order: `doctor.js`, `setup-secrets.js`, `init-collections.js`, and `import-data.js` when seed data is ready.
5. Run `scripts/e2e-smoke.js` with a mock database before real credentials are available.

## Subject profile boundary

`templates/subject-profile/` contains only a checklist. Real files belong outside every Git repository at `~/subject-profile/`, split into the five documented folders. Platform pages may be read only after the user supplies an authorized console entry and completes any required login or verification. Do not guess or request credentials in chat.

## Acceptance gate

Before committing, scan for `{{` placeholders, source-project business words, real credentials, and TODOs. Confirm that every route above points to a concrete file and that core code remains unchanged.
