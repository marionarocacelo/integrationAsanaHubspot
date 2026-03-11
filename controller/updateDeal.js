const { writeLogEntry, writeLogEntryError } = require("../utilities/logs");

const ASANA_TOKEN = process.env.ASANA_TOKEN;
const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN;


module.exports = async function (req, res) {
    
    try {

        writeLogEntry(`${res.locals.outputObject.project_gid} updateDeal.js data: `, res.locals.outputObject);
        let hsDealId = res.locals.outputObject.hsDealId;
        let url = `https://api.hubapi.com/crm/v3/objects/0-3/${hsDealId}`;

        console.log("url ", url);
        console.log("options ", res.locals.outputObject.changesToHubspot);

        //return res.status(200).json({ message: "test" });
        let response = await fetch(url, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${HUBSPOT_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(res.locals.outputObject.changesToHubspot)
        });

        response = await response.json();

        writeLogEntry(`${res.locals.outputObject.project_gid} updateDeal.js url: (${url})`);
        writeLogEntry(`${res.locals.outputObject.project_gid} updateDeal.js body: (${res.locals.outputObject.changesToHubspot})`);
        writeLogEntry(`${res.locals.outputObject.project_gid} updateDeal.js response: ${JSON.stringify(response)}`);

        if(response.status != 200) {
            throw new Error(JSON.stringify(response));
        }

        return res.status(200).json(res.locals.outputObject);

    } catch (error) {
        writeLogEntryError(`${res.locals.outputObject.project_gid} updateDeal.js error: ${error}`);
        writeLogEntry(`ERROR! ${res.locals.outputObject.project_gid} updateDeal.js error: ${error}`);
        return res.status(500).json({ message: `Internal server error: ${JSON.stringify({
            name: error.name,
            message: error.message,
            stack: error.stack
        })}` });
    }
}