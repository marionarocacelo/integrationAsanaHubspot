var express = require('express');
var fs = require('fs');
var path = require('path');

var router = express.Router();

var ACCESS_LOG_PATH = path.join(__dirname, '..', 'logs', 'logs', 'access.log');
var ERROR_LOG_PATH = path.join(__dirname, '..', 'logs', 'logs', 'error.log');

router.get('/access', function (req, res, next) {
  fs.readFile(ACCESS_LOG_PATH, 'utf8', function (err, data) {
    if (err) {
      if (err.code === 'ENOENT') {
        return res.status(200).send('access.log file not found.\n');
      }
      return next(err);
    }
    res.type('text/plain').send(data);
  });
});

router.get('/error', function (req, res, next) {
  fs.readFile(ERROR_LOG_PATH, 'utf8', function (err, data) {
    if (err) {
      if (err.code === 'ENOENT') {
        return res.status(200).send('error.log file not found.\n');
      }
      return next(err);
    }
    res.type('text/plain').send(data);
  });
});

module.exports = router;

