const express = require("express");
const { protectRoute } = require("../middleware/auth.middleware");
const { generateKey, redeemKey, checkStatus } = require("../controllers/premium.controller");

const router = express.Router();

router.post("/generate-key", protectRoute, generateKey);
router.post("/redeem", protectRoute, redeemKey);
router.get("/status", protectRoute, checkStatus);

module.exports = router;
