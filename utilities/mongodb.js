const { MongoClient } = require("mongodb");

let client;
let db;

async function getDb() {
    if (db) return db;

    const uri = (process.env.MONGODB_URI || "").trim();
    if (!uri) {
        throw new Error("Missing MONGODB_URI environment variable");
    }

    const dbName = (process.env.MONGODB_DB_NAME || "integraciorailway").trim();

    client = new MongoClient(uri);
    await client.connect();
    db = client.db(dbName);

    return db;
}

module.exports = { getDb };
