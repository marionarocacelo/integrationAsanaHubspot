var express = require("express");
var router = express.Router();
var requestAsanaToHubspotController = require("../controller/requestAsanaToHubspot");

/* POST create collection requestAsanaToHubspot */
router.post("/init", requestAsanaToHubspotController.initCollection);

/* POST create register in requestAsanaToHubspot collection */
router.post("/", requestAsanaToHubspotController.insert);

/* PATCH update register by id */
router.patch("/:id", requestAsanaToHubspotController.edit);

module.exports = router;
