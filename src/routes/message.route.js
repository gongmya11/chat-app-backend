const express = require("express");
const { protectRoute } = require("../middleware/auth.middleware");
const { getUsersForSidebar, getMessages, sendMessage, togglePinMessage, editMessage, recallMessage } = require("../controllers/message.controller");

const router = express.Router();

router.get("/users", protectRoute, getUsersForSidebar);
router.get("/:id", protectRoute, getMessages);
router.post("/send/:id", protectRoute, sendMessage);
router.put("/pin/:id", protectRoute, togglePinMessage);
router.put("/edit/:id", protectRoute, editMessage);
router.put("/recall/:id", protectRoute, recallMessage);

module.exports = router;
