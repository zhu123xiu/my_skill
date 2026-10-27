# Node SDK pitfalls

1. `where().update()` may return `{ updated: 1 }`, not `{ stats: { updated: 1 } }`. Use a compatibility counter.
2. `doc().get()` can return `{ data: [document] }`; the compatibility layer normalizes it.
3. Low-level `set`, `update`, and `add` receive plain payloads. Do not accidentally write a nested `{ data: ... }` field.
4. A `set` payload must not include `_id` when the SDK reserves the document id.
5. Missing documents may produce an empty array rather than an exception in the Node SDK.
6. `doc(id).update()` can silently return `updated: 0` for a missing document. Use an unconditional upsert or explicitly fall back to `set`.
7. Read successfully before replacing a document; a failed read must never become an empty overwrite.
