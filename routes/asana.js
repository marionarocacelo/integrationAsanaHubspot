var express = require('express');
var router = express.Router();
var changedReceived = require('../controller/changedReceived');
const filter = require('../controller/filter');
const updateDeal = require('../controller/updateDeal');

/* POST changes in Asana project. */
router.post('/changes', changedReceived, filter, updateDeal);

module.exports = router;
