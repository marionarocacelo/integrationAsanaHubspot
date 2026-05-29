var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var s3Logger = require('./utilities/s3Logger');

var indexRouter = require('./routes/index');
var asanaRouter = require('./routes/asana');
var logsRouter = require('./routes/logs');
var requestAsanaToHubspotRouter = require('./routes/requestAsanaToHubspot');

var app = express();

app.use(logger('dev'));
// S3 access log — Apache Combined Log Format, daily rotating files in S3
app.use(logger('combined', { stream: s3Logger.createAccessLogStream() }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/fromAsana', asanaRouter);
app.use('/logs', logsRouter);
app.use('/requestAsanaToHubspot', requestAsanaToHubspotRouter);

module.exports = app;
