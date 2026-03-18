const { writeLogEntry, writeLogEntryError, formatErrorWithLocation } = require("../utilities/logs");

const ASANA_TOKEN = process.env.ASANA_TOKEN;
const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN;


module.exports = async function (req, res) {
    
    try {

        writeLogEntry(`${res.locals.outputObject.project_gid} updateDeal.js data: `, res.locals.outputObject);
        let hsDealId = res.locals.outputObject.hsDealId;
        let url = `https://api.hubapi.com/crm/v3/objects/0-3/${hsDealId}`;

        writeLogEntry("url " + url);
        writeLogEntry("options " + JSON.stringify(res.locals.outputObject.changesToHubspot));
        writeLogEntry("HUBSPOT_TOKEN " + HUBSPOT_TOKEN);

        //return res.status(200).json({ message: "test" });
        let response = await fetch(url, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${HUBSPOT_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(res.locals.outputObject.changesToHubspot)
        });

        console.log("response before ", response);
        console.log("response status ", response.status);

        writeLogEntry("updateDeal.js response: " + JSON.stringify(response));

        if(response.status != 200) {
            console.log("response status not 200 ", response);
            throw new Error(JSON.stringify(response));
        }

        response = await response.json();

        writeLogEntry(`${res.locals.outputObject.project_gid} updateDeal.js url: (${url})`);
        writeLogEntry(`${res.locals.outputObject.project_gid} updateDeal.js body: (${JSON.stringify(res.locals.outputObject.changesToHubspot)})`);
        writeLogEntry(`${res.locals.outputObject.project_gid} updateDeal.js response: ${JSON.stringify(response)}`);

        console.log("response after ", response);

        return res.status(200).json(res.locals.outputObject);

    } catch (error) {
        writeLogEntryError(`${res.locals.outputObject.project_gid} updateDeal.js error: ${formatErrorWithLocation(error)}`, error, { reqBody: req.body });
        writeLogEntry(`ERROR! ${res.locals.outputObject.project_gid} updateDeal.js error: ${formatErrorWithLocation(error)}`, error);
        return res.status(500).json({
            message: `Internal server error: ${formatErrorWithLocation(error)}`,
            name: error.name,
            stack: error.stack
        });
    }
}