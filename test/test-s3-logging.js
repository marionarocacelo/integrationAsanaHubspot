'use strict';
require('dotenv').config();

/**
 * S3 Logging Test Scenarios
 * Run: node test-s3-logging.js
 *
 * Tests:
 *  1. Direct buffer write + flush → verify line appears in S3 access log
 *  2. writeLogEntryError → verify NDJSON appears in S3 error log
 *  3. Live HTTP request → verify Combined Log Format line appears in S3 access log
 */

const http = require('http');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const s3Logger = require('../utilities/s3Logger');
const { writeLogEntryError } = require('../utilities/logs');

const BUCKET = process.env.BUCKET;
const TODAY  = new Date().toISOString().slice(0, 10);

// ─── helpers ──────────────────────────────────────────────────────────────────

function pass(label) { console.log(`  ✔  ${label}`); }
function fail(label, reason) { console.error(`  ✘  ${label}\n     ${reason}`); }
function section(title) { console.log(`\n── ${title} ─────────────────────────────`); }

async function readS3Log(type) {
  const key = `logs/${TODAY}/${type}.log`;
  const res = await s3Logger.s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  return await s3Logger.streamToString(res.Body);
}

async function assertS3Contains(type, substring, label) {
  try {
    const content = await readS3Log(type);
    if (content.includes(substring)) {
      pass(label);
    } else {
      fail(label, `Expected S3 ${type}.log to contain: "${substring}"\nActual content (last 300 chars):\n${content.slice(-300)}`);
    }
  } catch (e) {
    fail(label, `Could not read S3 ${type}.log: ${e.message}`);
  }
}

// ─── Test 1: Direct buffer write ──────────────────────────────────────────────

async function test1_directBufferWrite() {
  section('Test 1: Direct buffer write → S3 access log');

  const marker = `TEST1-DIRECT-${Date.now()}`;
  s3Logger.appendAccessLog(`${marker} direct buffer write check\n`);

  console.log('  Flushing buffer to S3...');
  await s3Logger.flushAll();

  await assertS3Contains('access', marker, 'Marker line appears in S3 access log');
}

// ─── Test 2: writeLogEntryError → NDJSON in S3 error log ──────────────────────

async function test2_errorLogger() {
  section('Test 2: writeLogEntryError → NDJSON in S3 error log');

  const marker = `TEST2-ERROR-${Date.now()}`;
  const fakeError = new Error(`${marker} something went wrong`);
  fakeError.name = 'TestError';

  writeLogEntryError(
    `${marker} test error message`,
    fakeError,
    { reqBody: { taskId: 'task_123', project: 'proj_456' } }
  );

  console.log('  Flushing buffer to S3...');
  await s3Logger.flushAll();

  // Verify the NDJSON line was written
  await assertS3Contains('error', marker, 'Marker appears in S3 error log');

  // Verify it is valid NDJSON with expected fields
  try {
    const content = await readS3Log('error');
    const matchingLine = content.split('\n').find(l => l.includes(marker) && l.trim().startsWith('{'));
    if (!matchingLine) {
      fail('Error log line is NDJSON', 'No JSON line found containing the marker');
      return;
    }
    const parsed = JSON.parse(matchingLine);
    const checks = [
      ['has timestamp',  typeof parsed.timestamp === 'string'],
      ['level = error',  parsed.level === 'error'],
      ['has message',    parsed.message && parsed.message.includes(marker)],
      ['has location',   typeof parsed.location === 'string'],
      ['has error.name', parsed.error && parsed.error.name === 'TestError'],
      ['has error.stack',parsed.error && typeof parsed.error.stack === 'string'],
      ['has reqBody',    parsed.reqBody && parsed.reqBody.taskId === 'task_123'],
    ];
    checks.forEach(([label, ok]) => ok ? pass(label) : fail(label, `Value: ${JSON.stringify(parsed[label])}`));
  } catch (e) {
    fail('NDJSON is valid JSON', e.message);
  }
}

// ─── Test 3: Live HTTP request → Combined Log Format in S3 access log ─────────

async function test3_httpRequest() {
  section('Test 3: Live HTTP request → Combined Log Format in S3 access log');

  // Dynamically require app so dotenv is already loaded
  const app = require('../app');
  const server = http.createServer(app);

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  console.log(`  Server listening on port ${port}`);

  // Make a test request to a known route
  await new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}/fromAsana/test`, res => {
      res.resume(); // drain
      resolve();
    }).on('error', reject);
  });
  pass('HTTP GET /fromAsana/test returned a response');

  server.close();

  console.log('  Flushing buffer to S3...');
  await s3Logger.flushAll();

  // Combined Log Format contains the method and path
  await assertS3Contains('access', 'GET /fromAsana/test', 'Combined Log Format line in S3 access log');
}

// ─── runner ───────────────────────────────────────────────────────────────────

(async () => {
  console.log(`\nS3 Logging Tests — bucket: ${BUCKET} — date: ${TODAY}`);

  if (!BUCKET || !process.env.ACCESS_KEY_ID || !process.env.SECRET_ACCESS_KEY) {
    console.error('\n  ERROR: Missing S3 env vars. Check your .env file.\n');
    process.exit(1);
  }

  try {
    await test1_directBufferWrite();
    await test2_errorLogger();
    await test3_httpRequest();
  } catch (e) {
    console.error('\nUnhandled error during tests:', e);
  }

  console.log('\nDone.\n');
  process.exit(0);
})();
