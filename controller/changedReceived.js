const { writeLogEntry, writeLogEntryError, formatErrorWithLocation } = require("../utilities/logs");

const ASANA_TOKEN = process.env.ASANA_TOKEN;
const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN;



module.exports = async function (req, res, next) {
    try {
        writeLogEntry("--------------------------------");
        writeLogEntry("input object: ",req.body);

        console.log("--------------------------------");
        console.log("input object: ",req.body);

        let outputObject = {
            project_gid: undefined,
            team_gid: undefined,
            numChanges: undefined,
            hsDealId: undefined,
            changesToHubspot: {properties: {}}
        };

        let dealData = req.body;

        if(dealData?.events == undefined && (req.headers['x-hook-secret'] != undefined)) {

            const hookSecret = req.headers['x-hook-secret'];      
            // per exemple, validar-lo
            if (!hookSecret) {
              return res.status(400).send('Missing X-Hook-Secret header');
            }
            res.set('X-Hook-Secret', hookSecret); 
            return res.status(200).json({message: "handshaked!"});
        }
        //if(dealData?.events == undefined) throw new Error("dealData is empty");

        let { changes, changesUniqueFieldsGid, projectGid } = extractData(dealData);
        if(changes.length == 0) {
            return res.status(200).json({message: "no changes detected"});
        } 

        writeLogEntry("changes after "+JSON.stringify(changes));
        writeLogEntry("changesUniqueFieldsGid after "+JSON.stringify(changesUniqueFieldsGid));
        writeLogEntry("projectGid after "+projectGid);

        outputObject.project_gid = projectGid;

        let projectData = await getAsanaProject(projectGid);

        console.log("projectData after ", JSON.stringify(projectData));
        writeLogEntry("projectData after ", projectData);
        let hsDealId = getHubspotDealId(projectData);
        
        console.log("hsDealId after ", hsDealId);
        writeLogEntry("hsDealId after "+hsDealId);
        console.log("projectData after ", projectData);
        console.log("changesUniqueFieldsGid ", changesUniqueFieldsGid);
        let fieldsChanged = getAsanaChangedValues(projectData, changesUniqueFieldsGid);
        writeLogEntry("fieldsChanged after "+JSON.stringify(fieldsChanged));
        let asanaProjectStatus = await getAsanaProjectStatus(projectGid);
        let hubspotProjectStatus = await getHubspotProjectStatus(hsDealId);

        let objectHSFields = getHSFieldsObject(asanaProjectStatus, hubspotProjectStatus, fieldsChanged);
        //PREPARE OUTPUT OBJECT:
        outputObject.team_gid = projectData.data.team.gid;
        outputObject.numChanges = Object.keys(objectHSFields).length;
        outputObject.hsDealId = hsDealId;
        //mapping the rest of the modified fields to the output object:
        Object.keys(objectHSFields).forEach(key => outputObject.changesToHubspot.properties[key] = objectHSFields[key]);
        res.locals.outputObject = outputObject;
        //return res.status(200).json({"message": "tot bé"});

        writeLogEntry("changedReceived.js output object: ", outputObject);

        next();

    } catch (error) {
        console.error(error);
        writeLogEntryError(`changedReceived.js error: ${formatErrorWithLocation(error)}`, error, { reqBody: req.body });
        writeLogEntry(`ERROR! changedReceived.js error: ${formatErrorWithLocation(error)}`, error);

        return res.status(500).json({
            message: `Internal server error: ${formatErrorWithLocation(error)}`,
            name: error.name,
            stack: error.stack
        });
    }
}

function extractData(dealData) {

    let changesUniqueFieldsGid = [];

    let changes = dealData.events.filter(event => {
        if (event.action == 'changed' && event.resource?.resource_type == 'project' && event.change) {
            if (event.change.field == "name") {
                return true;
            } else if (event.change.field == "custom_fields" && event?.change?.new_value != undefined) {
                return true;
            } else {
                return false;
            }
        } else {
            return false;
        }
    }).map(event => {

        let field_gid = undefined;

        if (event.change.new_value && event.change.new_value.gid && !changesUniqueFieldsGid.includes(event.change.new_value.gid)) {
            changesUniqueFieldsGid.push(event.change.new_value.gid);
            field_gid = event.change.new_value.gid;
        } else if (event.change.field == "name" && !changesUniqueFieldsGid.includes("name")) {
            changesUniqueFieldsGid.push("name");
            field_gid = "name";
        }
        return {
            change_field_gid: field_gid,
            project_gid: event.resource.gid
        }
    });

    let projectGid = changes[0]?.project_gid;

    if (projectGid == undefined) {
        let events = dealData.events.filter(event => event.action == "added" && (event.resource?.resource_type == 'project' || event.parent.resource_type == 'project'));
        if (events.length > 0) {
            if (events[0].resource?.resource_type == 'project') {
                projectGid = events[0].resource?.gid;
            } else if (events[0].parent?.resource_type == 'project') {
                projectGid = events[0].parent?.gid;
            }
        }
    }

    if(changes.length == 0) {
        throw new Error("no changes detected");
    } else if (projectGid == undefined) {
        throw new Error("no project gid found");
    }

    return {
        changes,
        changesUniqueFieldsGid,
        projectGid
    }

}

async function getAsanaProject(projectGid) {
    let asanaProjectResp = await fetch(`https://app.asana.com/api/1.0/projects/${projectGid}`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${ASANA_TOKEN}`,
            Accept: "application/json",
            "Content-Type": "application/json"
        }
    });
    console.log("asanaProjectResp ", asanaProjectResp);
    writeLogEntry("url ", `https://app.asana.com/api/1.0/projects/${projectGid}`);
    writeLogEntry("headers ", {
        Authorization: `Bearer ${ASANA_TOKEN}`,
        Accept: "application/json",
        "Content-Type": "application/json"
    });
    writeLogEntry("asanaProjectResp ", asanaProjectResp);
    if(asanaProjectResp.statusText == "Not Found") {
        throw new Error("Asana project not found");
    }

    return await asanaProjectResp.json();
}

function getHubspotDealId(projectData) {
    console.log("projectData ", projectData);
    writeLogEntry("projectData ", projectData);
    let hsDealId = projectData.data.custom_fields.find(field => field.gid == '1213203026130633');
    console.log("hsDealId ", hsDealId);
    writeLogEntry("hsDealId "+hsDealId)
    if (!hsDealId) {
        throw new Error("HS deal id not found");
    } else {
        return hsDealId.number_value;
    }
}

function getAsanaProjectName(projectData) {
    return projectData.data.name;
}

function mapFieldToHubspot(asanaField) {
    const mappingAsanaHubspotFields = {
        "1213203026130633": "hubspot_deal_id",
        "1208558718128128": "facades_project_type",    //Project Type
        "1208374617355825": "facades_num_project",    //Nº Proyecto
        "1206055807118474": "hs_priority",     //Priority
        "1208399481596849": "facades_estimated_value", //facades_estimated_value
        "1208528692979299": "facades_square_meters", //facades_square_meters
        "1208374617355829": "facades_system", //facades_system
        "1208400629324582": "facades_spain_regions", //facades_spain_regions
        "1207072033866527": "facades_building_type", //facades_building_type
        "1207072033866543": "facades_cladding_type", //facades_cladding_type
        "1206280864518068": "facades_customer_type", //facades_customer_type
        "1209195703707398": "facades_sales_channel", //facades_sales_channel
        "1209494363832080": "facades_probability", //facades_probability
        "1206280864223915": "sales_asana_id",
        "1213413950618209": "facades_country", //iso country
        "1207072033866510": "facades_first_contact", //first_contact
        "1210067042557817": "facades_has_calculadora_quotation", //web calculadora
        "1208687394444478": "facades_project_phase", //Fase Proyecto (fase inicial)
        //"1213360859742931": "dealstage", --> només de hs a asana
        "1209494526985078": "facades_prob_estimated_value",
        "1206280864223915": "deal_owner",
        "name": "dealname"  //dealname
        //descartades: region (national,international), país sense iso, constructor, distributor, installer, 
    };

    return mappingAsanaHubspotFields[asanaField];
}

function getAsanaChangedValues(asanaProjectData, changesUniqueFieldsGid) {
    let fieldsChanged = asanaProjectData.data.custom_fields.filter(custom_field => changesUniqueFieldsGid.includes(custom_field.gid)).map(custom_field => {
        let value;
        if (custom_field.type == "enum") {
            value = custom_field.enum_value.gid;
        } else {
            value = custom_field.display_value;
        }

        if (mapFieldToHubspot(custom_field.gid) == "hs_priority") {
            if (value == "1206055807118475") value = "high";
            else if (value == "1206055807118476") value = "medium";
            else if (value == "1206055807118477") value = "low";
            else value = undefined;
        }

        if (mapFieldToHubspot(custom_field.gid) == "deal_owner") {
            if (value == "1206280864223916") value = "31053720" //jose
            else if (value == "1207021468306728") value = "29522313" //edu
            else value = undefined
        }

        return {
            value,
            field_gid: custom_field.gid,
            field_hubspot_name: mapFieldToHubspot(custom_field.gid),
        }
    });

    //check changes in name
    if (changesUniqueFieldsGid.includes("name")) {
        fieldsChanged.push({
            value: getAsanaProjectName(asanaProjectData),
            field_gid: "name",
            field_hubspot_name: mapFieldToHubspot("name"),
        });
    }
    if(fieldsChanged.length == 0) {
        throw new Error("no fields changed");
    }
    return fieldsChanged;
}

async function getAsanaProjectStatus(projectGid) {
    let response = await fetch(`https://app.asana.com/api/1.0/projects/${projectGid}?opt_fields=current_status_update.status_type`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${ASANA_TOKEN}`,
            'Content-Type': 'application/json'
        }
    })
    response = await response.json();
    if(response.statusText == "Not Found") {
        throw new Error("Asana project status not found");
    }
    let asanaProjectStatus = response?.data?.current_status_update?.status_type ? response.data.current_status_update.status_type : undefined; //últim valor
    return asanaProjectStatus;
}

async function getHubspotProjectStatus(hsDealId) {
    let responseHubspot = await fetch(`https://api.hubapi.com/crm/v3/objects/0-3/${hsDealId}?properties=facades_technical_status`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${HUBSPOT_TOKEN}`,
            'Content-Type': 'application/json'
        }
    })

    if (responseHubspot.statusText == "Not Found") {
        throw new Error("Hubspot deal not found");
    } else {
        let responseHubspotData = await responseHubspot.json();
        return responseHubspotData?.properties?.facades_technical_status ? responseHubspotData?.properties?.facades_technical_status : undefined;
    }
}

function getHSFieldsObject(asanaProjectStatus, hubspotProjectStatus, fieldsChanged) {
    let objectHSFields = {};

    if (asanaProjectStatus != hubspotProjectStatus) {
        objectHSFields["facades_technical_status"] = asanaProjectStatus;
    }

    fieldsChanged.forEach(field => {
        if (field.field_hubspot_name != undefined && field.value != undefined) objectHSFields[field.field_hubspot_name] = field.value;
    });

    return objectHSFields;
}



    /*
    let testReturn = {
      hubspot_deal_id: "123",
      facades_project_type: "123",
      facades_num_project: "123",
      hs_priority: "123",
      facades_estimated_value: "123",
      facades_square_meters: "123",
      facades_system: "123",
      facades_spain_regions: "123",
      facades_building_type: "123",
      facades_cladding_type: "123",
      facades_customer_type: "123",
      facades_sales_channel: "123",
      facades_probability: "123",
      sales_asana_id: "123",
      facades_country: "123",
      facades_first_contact: "123",
      facades_has_calculadora_quotation: "123",
      facades_project_phase: "123",
      facades_prob_estimated_value: "123",
      deal_owner: "123",
      dealname: "123",
      facades_technical_status: "123"
    }*/