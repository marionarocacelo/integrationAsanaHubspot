const { ObjectId } = require("mongodb");
const { getDb } = require("../utilities/mongodb");

const COLLECTION_NAME = "requestAsanaToHubspot";
const VALID_STATUS = new Set([-1, 0, 1]);

function toNonEmptyString(value) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function validateStatus(status) {
    if (status === undefined) return undefined;
    if (!Number.isInteger(status) || !VALID_STATUS.has(status)) {
        throw new Error("status must be one of: -1, 0, 1");
    }
    return status;
}

function normalizeRequestResent(requestResent) {
    if (requestResent === undefined || requestResent === null || requestResent === "") {
        return null;
    }

    const asString = String(requestResent).trim();
    if (!ObjectId.isValid(asString)) {
        throw new Error("request_resent must be a valid MongoDB ObjectId");
    }

    return new ObjectId(asString);
}

function mapDocument(doc) {
    if (!doc) return null;
    return {
        id: doc._id.toString(),
        date: doc.date,
        asana_project_gid: doc.asana_project_gid,
        hubspot_deal_id: doc.hubspot_deal_id,
        field_GID: doc.field_GID,
        field_name: doc.field_name,
        field_value: doc.field_value,
        status: doc.status,
        request_resent: doc.request_resent ? doc.request_resent.toString() : null
    };
}

module.exports.initCollection = async function (req, res) {
    try {
        const db = await getDb();
        const existing = await db.listCollections({ name: COLLECTION_NAME }).toArray();

        if (existing.length === 0) {
            await db.createCollection(COLLECTION_NAME);
        }

        return res.status(200).json({
            message: "Collection ready",
            collection: COLLECTION_NAME,
            created: existing.length === 0
        });
    } catch (error) {
        return res.status(500).json({
            message: `Internal server error: ${error.message}`,
            name: error.name
        });
    }
};

module.exports.insert = async function (req, res) {
    try {
        const payload = req.body || {};

        const asanaProjectGid = toNonEmptyString(payload.asana_project_gid);
        const hubspotDealId = toNonEmptyString(payload.hubspot_deal_id);
        const fieldGid = toNonEmptyString(payload.field_GID);
        const fieldName = toNonEmptyString(payload.field_name);
        const fieldValue = toNonEmptyString(payload.field_value);
        const status = validateStatus(payload.status);
        const requestResent = normalizeRequestResent(payload.request_resent);

        if (!asanaProjectGid || !hubspotDealId || !fieldGid || !fieldName || !fieldValue || status === undefined) {
            return res.status(400).json({
                message: "Missing required fields: asana_project_gid, hubspot_deal_id, field_GID, field_name, field_value, status"
            });
        }

        const db = await getDb();
        const collection = db.collection(COLLECTION_NAME);

        const doc = {
            date: payload.date ? new Date(payload.date) : new Date(),
            asana_project_gid: asanaProjectGid,
            hubspot_deal_id: hubspotDealId,
            field_GID: fieldGid,
            field_name: fieldName,
            field_value: fieldValue,
            status,
            request_resent: requestResent
        };

        if (Number.isNaN(doc.date.getTime())) {
            return res.status(400).json({ message: "date must be a valid date" });
        }

        const result = await collection.insertOne(doc);
        const created = await collection.findOne({ _id: result.insertedId });
        return res.status(201).json(mapDocument(created));
    } catch (error) {
        return res.status(500).json({
            message: `Internal server error: ${error.message}`,
            name: error.name
        });
    }
};

module.exports.edit = async function (req, res) {
    try {
        const id = req.params.id;
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid ID" });
        }

        const payload = req.body || {};
        const update = {};

        if (payload.date !== undefined) {
            const date = new Date(payload.date);
            if (Number.isNaN(date.getTime())) {
                return res.status(400).json({ message: "date must be a valid date" });
            }
            update.date = date;
        }
        if (payload.asana_project_gid !== undefined) update.asana_project_gid = toNonEmptyString(payload.asana_project_gid);
        if (payload.hubspot_deal_id !== undefined) update.hubspot_deal_id = toNonEmptyString(payload.hubspot_deal_id);
        if (payload.field_GID !== undefined) update.field_GID = toNonEmptyString(payload.field_GID);
        if (payload.field_name !== undefined) update.field_name = toNonEmptyString(payload.field_name);
        if (payload.field_value !== undefined) update.field_value = toNonEmptyString(payload.field_value);
        if (payload.status !== undefined) update.status = validateStatus(payload.status);
        if (payload.request_resent !== undefined) update.request_resent = normalizeRequestResent(payload.request_resent);

        const hasInvalidString = [
            "asana_project_gid",
            "hubspot_deal_id",
            "field_GID",
            "field_name",
            "field_value"
        ].some((key) => payload[key] !== undefined && !update[key]);

        if (hasInvalidString) {
            return res.status(400).json({ message: "Updated string fields cannot be empty" });
        }

        if (Object.keys(update).length === 0) {
            return res.status(400).json({ message: "No fields provided to update" });
        }

        const db = await getDb();
        const collection = db.collection(COLLECTION_NAME);

        const objectId = new ObjectId(id);
        const result = await collection.updateOne(
            { _id: objectId },
            { $set: update }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: "Register not found" });
        }

        const updated = await collection.findOne({ _id: objectId });
        return res.status(200).json(mapDocument(updated));
    } catch (error) {
        return res.status(500).json({
            message: `Internal server error: ${error.message}`,
            name: error.name
        });
    }
};
