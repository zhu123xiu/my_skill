# Node SDK pitfalls

1. `where().update()` may return `{ updated: 1 }`, not `{ stats: { updated: 1 } }`. Use a compatibility counter.
2. `doc().get()` can return `{ data: [document] }`; the compatibility layer normalizes it.
3. Low-level `set`, `update`, and `add` receive plain payloads. Do not accidentally write a nested `{ data: ... }` field.
4. A `set` payload must not include `_id` when the SDK reserves the document id.
5. Missing documents may produce an empty array rather than an exception in the Node SDK.
6. `doc(id).update()` can silently return `updated: 0` for a missing document. Use an unconditional upsert or explicitly fall back to `set`.
7. Read successfully before replacing a document; a failed read must never become an empty overwrite.
8. AK/SK init must be `cloudbase.init({ env, secretId, secretKey })` (same as `server/core/db.js`). The `{ envId, credentials: { private_key_id, private_key } }` form is certificate-based auth and silently fails with AK/SK keys.
9. `database()` exposes only `collection` / `createCollection` (and `doc/add/aggregate` on a collection). There is **no** `listCollections`, `runCommand`, or `createIndex`. To test connectivity or collection existence, call `collection(name).count()` and treat a `ResourceNotFound` error as "absent but reachable". Create collections with `db.createCollection(name)`; indexes must be created in the CloudBase console or CLI, not via this SDK.
10. Douyin `client_token` (`POST https://developer.toutiao.com/api/apps/v2/token`) requires `grant_type: "client_credential"` in the body alongside `appid` and `secret`. Omitting it returns `err_no 40020 / bad grant_type` even when the appSecret is valid.
