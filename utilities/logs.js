const fs = require('fs');
const path = require('path');
const { sendErrorNotification } = require('./email');

const LOG_FILE = path.join(__dirname, '../logs/', 'logs', 'access.log');
const LOG_FILE_ERROR = path.join(__dirname, '../logs/', 'logs', 'error.log');

/**
 * Get "file:line" from the first stack frame of an error (or error-like object).
 * @returns {string|null} e.g. "changedReceived.js:85" or null
 */
function getErrorLocation(error) {
    const stack = error && (error.stack || error.stackTrace);
    if (!stack || typeof stack !== 'string') return null;
    let match = stack.match(/\(([^)]+):(\d+):\d+\)/);
    if (!match) match = stack.match(/\s+at\s+[^(]*([^:)]+):(\d+)/);
    if (!match) return null;
    const file = path.basename(match[1].trim());
    return `${file}:${match[2]}`;
}

/**
 * Get the full stack trace string from an error or error-like object.
 * @returns {string}
 */
function getErrorStack(error) {
    if (!error) return '';
    return (error.stack || error.stackTrace || '').trim();
}

/**
 * Format error message with file and line when available.
 * @returns {string} e.g. "Cannot read 'team' (changedReceived.js:85)" or just the message
 */
function formatErrorWithLocation(error) {
    if (!error) return '';
    const msg = error.message != null ? String(error.message) : String(error);
    const loc = getErrorLocation(error);
    return loc ? `${msg} (${loc})` : msg;
}

module.exports = {
    writeLogEntry,
    writeLogEntryError,
    getErrorLocation,
    getErrorStack,
    formatErrorWithLocation
}

function writeLogEntry(text, object) {

    let output = "";
    if(text) output += text;
    if(object) output += JSON.stringify(object);
    console.log(output);

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

function prettyJson(value) {
    if (value === undefined) return '(none)';
    try {
        return typeof value === 'object' && value !== null
            ? JSON.stringify(value, null, 2)
            : String(value);
    } catch {
        return String(value);
    }
}

function buildErrorEmailBody(timestamp, location, textWithLocation, fullStack, object, reqBody) {
    const sep = '\n' + '─'.repeat(60) + '\n';
    const section = (title, content) => content ? `\n▼ ${title}\n\n${content}\n` : '';

    let body = `🕐 ${timestamp}`;
    if (location) body += `\n📍 Location: ${location}`;
    body += sep;

    if (textWithLocation) {
        body += section('Error message', textWithLocation);
    }
    if (reqBody !== undefined) {
        body += section('Request body (req.body)', prettyJson(reqBody));
    }
    if (object !== undefined) {
        const details = object instanceof Error || (object && (object.message !== undefined || object.stack !== undefined))
            ? `Name: ${object.name || '(none)'}\nMessage: ${object.message || '(none)'}`
            : prettyJson(object);
        body += section('Error details', details);
    }
    if (fullStack) {
        body += section('Stack trace', fullStack);
    }

    return body.trim() || `[${timestamp}] Empty error log entry`;
}

function writeLogEntryError(text, object, context) {

    let output = "";
    if(text) output += text;
    if(object) output += JSON.stringify(object);
    console.log(output);

    
    const logDir = path.dirname(LOG_FILE_ERROR);
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const timestamp = new Date().toISOString();
    const reqBody = context && context.reqBody;

    const location = object && getErrorLocation(object);
    const locationPrefix = location ? `[${location}] ` : '';
    const textWithLocation = text !== undefined ? locationPrefix + text : text;

    let line = `${timestamp}\t`;
    if (textWithLocation !== undefined) line += `\t${textWithLocation}`;
    if (object !== undefined) line += `\t${serializeForLog(object)}`;

    if (text === undefined && object === undefined) line += `\t empty log entry`;

    line += `\n`;

    fs.appendFileSync(LOG_FILE_ERROR, line);

    const fullStack = object && getErrorStack(object);
    if (fullStack) {
        const stackOneLine = fullStack.replace(/\n/g, ' | ');
        fs.appendFileSync(LOG_FILE_ERROR, `${timestamp}\tSTACK\t${stackOneLine}\n`);
    }

    const emailBody = buildErrorEmailBody(timestamp, location, textWithLocation, fullStack, object, reqBody);
    sendErrorNotification('ERROR INTEGRACIÓ ASANA HUBSPOT - RAILWAY', emailBody).catch(() => {});
}

