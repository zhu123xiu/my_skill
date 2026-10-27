# Customize a new project

1. Copy `templates/miniprogram/` and `templates/server/` into the project.
2. Replace placeholders in the two `template.config.js` files.
3. Copy `setup/.secrets.local.json.example` to `setup/.secrets.local.json`; keep it ignored.
4. Describe the product in `docs/product-spec.md`, confirm it, then add business pages and service handlers.
5. Run `node setup/doctor.js`, then `setup-secrets.js`, `init-collections.js`, and the smoke test.
6. Keep `core/` unchanged and run the acceptance scans before committing.
