const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '../logs/', 'logs', 'access.log');
const LOG_FILE_ERROR = path.join(__dirname, '../logs/', 'logs', 'error.log');

module.exports = {
    writeLogEntry,
    writeLogEntryError
}

function writeLogEntry(text, object) {
    const logDir = path.dirname(LOG_FILE);
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const timestamp = new Date().toISOString();

    let line = `${timestamp}\t`;
    if(text != undefined ) line += `\t${text}`;
    if(typeof object == 'object' && Object.keys(object).length > 0 ) line += `\t${JSON.stringify(object)}`;

    if(text == undefined && object == undefined ) line += `\t empty log entry`;

    line += `\n`;

    fs.appendFileSync(LOG_FILE, line);
}

function serializeForLog(value) {
    if (value instanceof Error) {
        return JSON.stringify({
            name: value.name,
            message: value.message,
            stack: value.stack
        });
    }
    if (typeof value === 'object' && value !== null) {
        return JSON.stringify(value);
    }
    return JSON.stringify(value);
}

function writeLogEntryError(text, object) {
    const logDir = path.dirname(LOG_FILE_ERROR);
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const timestamp = new Date().toISOString();

    let line = `${timestamp}\t`;
    if (text !== undefined) line += `\t${text}`;
    if (object !== undefined) line += `\t${serializeForLog(object)}`;

    if (text === undefined && object === undefined) line += `\t empty log entry`;

    line += `\n`;

    fs.appendFileSync(LOG_FILE_ERROR, line);
}

