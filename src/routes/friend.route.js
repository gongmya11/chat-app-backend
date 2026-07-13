const express = require("express");
const { protectRoute } = require("../middleware/auth.middleware");
const {
  searchUsers,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  unfriend,
  getFriendsList,
  getUserProfile
} = require("../controllers/friend.controller");

const router = express.Router();

router.get("/search", protectRoute, searchUsers);
router.post("/request/:id", protectRoute, sendFriendRequest);
router.post("/accept/:id", protectRoute, acceptFriendRequest);
router.post("/decline/:id", protectRoute, declineFriendRequest);
router.post("/unfriend/:id", protectRoute, unfriend);
router.get("/list", protectRoute, getFriendsList);
router.get("/profile/:id", protectRoute, getUserProfile);

module.exports = router;
