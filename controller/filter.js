const { writeLogEntryError, writeLogEntry, formatErrorWithLocation } = require("../utilities/logs");
const { sendErrorNotification } = require("../utilities/email");

const ASANA_TOKEN = process.env.ASANA_TOKEN;
const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN;


module.exports = async function (req, res, next) {
    
    try {
        let teamGid = res.locals.outputObject.team_gid; 

        if(teamGid != "1208390775021649") {
            writeLogEntry(`INCORRECT TEAM GID: ${res.locals.outputObject.project_gid} (RETURN 403: Unauthorized)`);
            return res.status(403).json({ message: "Unauthorized" });
        } else if(res.locals.outputObject.numChanges == undefined || res.locals.outputObject.numChanges == 0) {
            writeLogEntry(`NO CHANGE TO APPLY (RETURN 400: no change to apply)`);
            return res.status(400).json({ message: "no change to apply" });
        } else {
            writeLogEntry(`FILTER MIDDLEWARE: ${res.locals.outputObject.project_gid}`);
            next();
        }

    } catch (error) {
        writeLogEntryError(`${res.locals.outputObject.project_gid} filter.js error: ${formatErrorWithLocation(error)}`, error, { reqBody: req.body });
        writeLogEntry(`ERROR! ${res.locals.outputObject.project_gid} filter.js error: ${formatErrorWithLocation(error)}`, error);
        //SEND EMAIL TO ADMIN
        await sendErrorNotification(
            "IntegracioRailway: error in filter middleware",
            `Project gid: ${res.locals?.outputObject?.project_gid}\n\n${formatErrorWithLocation(error)}\n\nRequest body:\n${JSON.stringify(req.body)}`
        );
        return res.status(200).json({
            message: `Internal server error: ${formatErrorWithLocation(error)}`,
            name: error.name,
            stack: error.stack
        });
    }
}