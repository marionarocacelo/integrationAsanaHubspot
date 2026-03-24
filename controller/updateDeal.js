const { writeLogEntry, writeLogEntryError, formatErrorWithLocation } = require("../utilities/logs");

const ASANA_TOKEN = process.env.ASANA_TOKEN;
const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN;


module.exports = async function (req, res) {
    
    try {
        writeLogEntry(`UPDATE DEAL MIDDLEWARE ${JSON.stringify(res.locals.outputObject)}`);

        let hsDealId = res.locals.outputObject.hsDealId;
        let url = `https://api.hubapi.com/crm/v3/objects/0-3/${hsDealId}`;

        writeLogEntry("HUBSPOT DEAL UPDATE URL: " + url);
        writeLogEntry("HUBSPOT DEAL UPDATE OPTIONS: " + JSON.stringify(res.locals.outputObject.changesToHubspot));

        let response = await fetch(url, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${HUBSPOT_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(res.locals.outputObject.changesToHubspot)
        });

        if(response.status != 200) {
            writeLogEntry("ERROR IN UPDATE DEAL (RETURN 500): " + JSON.stringify(response));
            throw new Error(JSON.stringify(response));
        }

        response = await response.json();

        writeLogEntry("UPDATE DEAL RESPONSE (return 200): " + JSON.stringify(response));
        return res.status(200).json(res.locals.outputObject);

    } catch (error) {
        writeLogEntryError(`${res.locals.outputObject.project_gid} updateDeal.js error: ${formatErrorWithLocation(error)}`, error, { reqBody: req.body });
        writeLogEntry(`ERROR! ${res.locals.outputObject.project_gid} updateDeal.js error: ${formatErrorWithLocation(error)}`, error);
        //SEND EMAIL TO ADMIN
        await sendErrorNotification(
            "IntegracioRailway: error in updateDeal middleware",
            `Project gid: ${res.locals?.outputObject?.project_gid}\n\n${formatErrorWithLocation(error)}\n\nRequest body:\n${JSON.stringify(req.body)}`
        );
        return res.status(200).json({
            message: `Internal server error: ${formatErrorWithLocation(error)}`,
            name: error.name,
            stack: error.stack
        });
    }
}