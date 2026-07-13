const express = require("express");
const { protectRoute } = require("../middleware/auth.middleware");
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  clearNotifications
} = require("../controllers/notification.controller");

const router = express.Router();

router.get("/", protectRoute, getNotifications);
router.put("/read/:id", protectRoute, markAsRead);
router.put("/read-all", protectRoute, markAllAsRead);
router.delete("/clear", protectRoute, clearNotifications);

module.exports = router;
