const config = require("../templates/server/template.config");
for (const collection of config.collections || []) console.log(`declare ${config.collectionPrefix}${collection.name}`, collection.indexes || []);
console.log("Collection creation is intentionally environment-bound; review the declaration before connecting credentials.");
