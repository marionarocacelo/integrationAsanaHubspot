var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var asanaRouter = require('./routes/asana');
var logsRouter = require('./routes/logs');
var requestAsanaToHubspotRouter = require('./routes/requestAsanaToHubspot');

var app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/fromAsana', asanaRouter);
app.use('/logs', logsRouter);
app.use('/requestAsanaToHubspot', requestAsanaToHubspotRouter);

module.exports = app;
