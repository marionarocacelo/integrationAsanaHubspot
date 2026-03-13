const { writeLogEntryError, writeLogEntry, formatErrorWithLocation } = require("../utilities/logs");

const ASANA_TOKEN = process.env.ASANA_TOKEN;
const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN;


module.exports = function (req, res, next) {
    
    try {
        let teamGid = res.locals.outputObject.team_gid; 

        if(teamGid != "1208390775021649") {
            return res.status(403).json({ message: "Unauthorized" });
        } else if(res.locals.outputObject.numChanges == undefined || res.locals.outputObject.numChanges == 0) {
            return res.status(400).json({ message: "no change to apply" });
        } else {
            writeLogEntry(`${res.locals.outputObject.project_gid} passed filter`);
            next();
        }

    } catch (error) {
        writeLogEntryError(`${res.locals.outputObject.project_gid} filter.js error: ${formatErrorWithLocation(error)}`, error, { reqBody: req.body });
        writeLogEntry(`ERROR! ${res.locals.outputObject.project_gid} filter.js error: ${formatErrorWithLocation(error)}`, error);
        return res.status(500).json({
            message: `Internal server error: ${formatErrorWithLocation(error)}`,
            name: error.name,
            stack: error.stack
        });
    }
}