'use strict';

var express = require('express');
var router = express.Router();
var { GetObjectCommand } = require('@aws-sdk/client-s3');
var { s3, BUCKET, BUCKET_ROOT, streamToString } = require('../utilities/s3Logger');

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

async function serveLog(req, res, next, type) {
  var date = req.query.date || todayDate();
  // Basic validation: YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).send('Invalid date format. Use YYYY-MM-DD.\n');
  }
  var key = BUCKET_ROOT + '/logs/' + date + '/' + type + '.log';
  try {
    var result = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    var content = await streamToString(result.Body);
    res.type('text/plain').send(content);
  } catch (e) {
    if (e.name === 'NoSuchKey' || (e.$metadata && e.$metadata.httpStatusCode === 404)) {
      return res.status(200).send('No ' + type + ' log found for ' + date + '.\n');
    }
    next(e);
  }
}

router.get('/access', function (req, res, next) {
  return serveLog(req, res, next, 'access');
});

router.get('/error', function (req, res, next) {
  return serveLog(req, res, next, 'error');
});

module.exports = router;

