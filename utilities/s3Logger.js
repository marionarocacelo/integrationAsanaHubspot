'use strict';

const https = require('https');
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { NodeHttpHandler } = require('@smithy/node-http-handler');

const BUCKET   = process.env.BUCKET;
const REGION   = process.env.REGION || 'auto';

// Normalise endpoint — ensure it has a scheme so the SDK can build a valid URL
const _rawEndpoint = process.env.ENDPOINT || '';
const ENDPOINT = _rawEndpoint && !_rawEndpoint.startsWith('http')
  ? 'https://' + _rawEndpoint
  : _rawEndpoint;
const FLUSH_INTERVAL_MS = 30_000;

const s3 = new S3Client({
  region: REGION,
  endpoint: ENDPOINT,
  credentials: {
    accessKeyId:     process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
  requestHandler: new NodeHttpHandler({
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
  }),
});

/** Returns 'YYYY-MM-DD' for today in UTC */
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

/** S3 object key for a given log type and date */
function s3Key(type, date) {
  return `logs/${date}/${type}.log`;
}

/** Convert a ReadableStream / AsyncIterable to a UTF-8 string */
async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

// In-memory buffers keyed by log type
const buffers = { access: [], error: [] };

// Track current date to detect midnight rollover
let currentDate = todayKey();

/**
 * Flush one buffer type to S3.
 * Downloads existing content, appends new lines, then PutObject.
 */
async function flushBuffer(type, date) {
  if (buffers[type].length === 0) return;
  const lines = buffers[type].splice(0); // drain atomically
  const key = s3Key(type, date);

  let existing = '';
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    existing = await streamToString(res.Body);
  } catch (e) {
    if (e.name !== 'NoSuchKey' && e.$metadata?.httpStatusCode !== 404) {
      // Re-queue lines so they are not lost on transient errors
      buffers[type].unshift(...lines);
      console.error('[s3Logger] GetObject error:', e.message);
      return;
    }
  }

  const updated = existing + lines.join('');
  try {
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: updated,
      ContentType: 'text/plain',
    }));
  } catch (e) {
    // Re-queue lines on upload failure
    buffers[type].unshift(...lines);
    console.error('[s3Logger] PutObject error:', e.message);
  }
}

/** Flush all buffers for the current date */
async function flushAll() {
  const date = currentDate;
  await Promise.all([
    flushBuffer('access', date),
    flushBuffer('error',  date),
  ]);
}

// Periodic flush — also handles midnight rollover
const timer = setInterval(async () => {
  const today = todayKey();
  if (today !== currentDate) {
    // Flush remaining lines for the old date before switching
    await flushAll();
    currentDate = today;
  }
  await flushAll();
}, FLUSH_INTERVAL_MS);

// Allow the event loop to exit even if timer is pending
if (timer.unref) timer.unref();

// Graceful shutdown
async function shutdown() {
  clearInterval(timer);
  await flushAll();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT',  shutdown);

module.exports = {
  s3,
  BUCKET,
  streamToString,
  /** Append a line to the access log buffer (called by morgan stream) */
  appendAccessLog(line) {
    buffers.access.push(line.endsWith('\n') ? line : line + '\n');
  },
  /** Append a line to the error log buffer (called by utilities/logs.js) */
  appendErrorLog(line) {
    buffers.error.push(line.endsWith('\n') ? line : line + '\n');
  },
  /**
   * Returns a writable-stream-compatible object for use as morgan's stream option.
   * morgan calls stream.write(line) for each request.
   */
  createAccessLogStream() {
    return {
      write(line) {
        buffers.access.push(line.endsWith('\n') ? line : line + '\n');
      },
    };
  },
  flushAll,
};
