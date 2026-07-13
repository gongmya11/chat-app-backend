const User = require("../models/User");
const FriendRequest = require("../models/FriendRequest");
const Notification = require("../models/Notification");
const { getReceiverSocketId, io } = require("../lib/socket");

// Tìm kiếm người dùng bằng email hoặc username
const searchUsers = async (req, res) => {
  try {
    const { query } = req.query;
    const myId = req.user._id;

    if (!query) {
      return res.status(400).json({ message: "Vui lòng nhập từ khóa tìm kiếm" });
    }

    // Tìm các user khớp username hoặc email, ngoại trừ chính mình
    const matchedUsers = await User.find({
      _id: { $ne: myId },
      $or: [
        { username: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } }
      ]
    }).select("-password");

    // Lấy thông tin về mối quan hệ giữa mình và các user tìm được
    const usersWithStatus = await Promise.all(
      matchedUsers.map(async (user) => {
        // Kiểm tra xem đã là bạn bè chưa
        const isFriend = req.user.friends && req.user.friends.some(
          (friendId) => friendId.toString() === user._id.toString()
        );

        let status = "none";
        let requestId = null;

        if (isFriend) {
          status = "friends";
        } else {
          // Kiểm tra yêu cầu kết bạn đang chờ xử lý
          const request = await FriendRequest.findOne({
            $or: [
              { sender: myId, receiver: user._id },
              { sender: user._id, receiver: myId }
            ],
            status: "pending"
          });

          if (request) {
            requestId = request._id;
            if (request.sender.toString() === myId.toString()) {
              status = "sent_pending"; // Mình gửi
            } else {
              status = "received_pending"; // Họ gửi
            }
          }
        }

        return {
          ...user.toObject(),
          friendshipStatus: status,
          requestId
        };
      })
    );

    res.status(200).json(usersWithStatus);
  } catch (error) {
    console.error("Lỗi trong searchUsers controller:", error.message);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

// Gửi lời mời kết bạn
const sendFriendRequest = async (req, res) => {
  try {
    const { id: receiverId } = req.params;
    const myId = req.user._id;

    if (myId.toString() === receiverId.toString()) {
      return res.status(400).json({ message: "Bạn không thể kết bạn với chính mình" });
    }

    // Kiểm tra xem receiver có tồn tại không
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    // Kiểm tra xem đã là bạn bè chưa
    const isFriend = req.user.friends && req.user.friends.some(
      (friendId) => friendId.toString() === receiverId.toString()
    );
    if (isFriend) {
      return res.status(400).json({ message: "Hai người đã là bạn bè" });
    }

    // Kiểm tra xem có yêu cầu kết bạn nào đang chờ xử lý không
    let request = await FriendRequest.findOne({
      $or: [
        { sender: myId, receiver: receiverId },
        { sender: receiverId, receiver: myId }
      ]
    });

    if (request) {
      if (request.status === "pending") {
        return res.status(400).json({ message: "Yêu cầu kết bạn đang chờ xử lý" });
      }
      if (request.status === "accepted") {
        return res.status(400).json({ message: "Hai người đã là bạn bè" });
      }
      
      // Nếu đã từng từ chối, đặt lại trạng thái về pending và cập nhật người gửi/nhận
      request.sender = myId;
      request.receiver = receiverId;
      request.status = "pending";
      await request.save();
    } else {
      // Tạo yêu cầu mới
      request = new FriendRequest({
        sender: myId,
        receiver: receiverId,
        status: "pending"
      });
      await request.save();
    }

    // Tạo thông báo cho người nhận
    const notification = new Notification({
      sender: myId,
      receiver: receiverId,
      type: "friend_request",
      relatedId: request._id,
      onModel: "FriendRequest"
    });
    await notification.save();

    // Gửi sự kiện Socket thời gian thực tới người nhận
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      const populatedNotification = await notification.populate("sender", "username avatar");
      io.to(receiverSocketId).emit("new_notification", populatedNotification);
    }

    res.status(200).json({ message: "Đã gửi lời mời kết bạn thành công", request });
  } catch (error) {
    console.error("Lỗi trong sendFriendRequest controller:", error.message);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

// Chấp nhận lời mời kết bạn
const acceptFriendRequest = async (req, res) => {
  try {
    const { id: senderId } = req.params; // ID của người gửi yêu cầu kết bạn
    const myId = req.user._id;

    const request = await FriendRequest.findOne({
      sender: senderId,
      receiver: myId,
      status: "pending"
    });

    if (!request) {
      return res.status(404).json({ message: "Không tìm thấy yêu cầu kết bạn đang chờ" });
    }

    request.status = "accepted";
    await request.save();

    // Cập nhật danh sách bạn bè của cả hai
    await User.findByIdAndUpdate(myId, { $addToSet: { friends: senderId } });
    await User.findByIdAndUpdate(senderId, { $addToSet: { friends: myId } });

    // Xóa tất cả thông báo yêu cầu kết bạn cũ giữa hai người để tránh rác
    await Notification.deleteMany({
      receiver: myId,
      sender: senderId,
      type: "friend_request"
    });

    // Tạo thông báo mới cho người gửi ban đầu để họ biết yêu cầu được chấp nhận
    const notification = new Notification({
      sender: myId,
      receiver: senderId,
      type: "friend_accept",
      relatedId: request._id,
      onModel: "FriendRequest"
    });
    await notification.save();

    // Gửi socket thông báo kết bạn và cập nhật sidebar cho cả hai
    const senderSocketId = getReceiverSocketId(senderId);
    if (senderSocketId) {
      const populatedNotification = await notification.populate("sender", "username avatar");
      io.to(senderSocketId).emit("new_notification", populatedNotification);
      io.to(senderSocketId).emit("friend_updated");
    }

    const mySocketId = getReceiverSocketId(myId);
    if (mySocketId) {
      io.to(mySocketId).emit("friend_updated");
    }

    res.status(200).json({ message: "Đã chấp nhận lời mời kết bạn", request });
  } catch (error) {
    console.error("Lỗi trong acceptFriendRequest controller:", error.message);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

// Từ chối lời mời kết bạn
const declineFriendRequest = async (req, res) => {
  try {
    const { id: senderId } = req.params;
    const myId = req.user._id;

    const request = await FriendRequest.findOne({
      sender: senderId,
      receiver: myId,
      status: "pending"
    });

    if (!request) {
      return res.status(404).json({ message: "Không tìm thấy yêu cầu kết bạn" });
    }

    request.status = "declined";
    await request.save();

    // Xóa thông báo yêu cầu kết bạn liên quan
    await Notification.deleteMany({
      receiver: myId,
      sender: senderId,
      type: "friend_request"
    });

    res.status(200).json({ message: "Đã từ chối lời mời kết bạn" });
  } catch (error) {
    console.error("Lỗi trong declineFriendRequest controller:", error.message);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

// Hủy kết bạn
const unfriend = async (req, res) => {
  try {
    const { id: friendId } = req.params;
    const myId = req.user._id;

    // Xóa khỏi danh sách bạn bè của cả hai
    await User.findByIdAndUpdate(myId, { $pull: { friends: friendId } });
    await User.findByIdAndUpdate(friendId, { $pull: { friends: myId } });

    // Xóa quan hệ trong FriendRequest
    await FriendRequest.deleteMany({
      $or: [
        { sender: myId, receiver: friendId },
        { sender: friendId, receiver: myId }
      ]
    });

    // Xóa tất cả các thông báo liên quan giữa 2 người
    await Notification.deleteMany({
      $or: [
        { sender: myId, receiver: friendId },
        { sender: friendId, receiver: myId }
      ]
    });

    // Phát sự kiện socket để cập nhật lại giao diện (mất bạn bè trong danh sách)
    const friendSocketId = getReceiverSocketId(friendId);
    if (friendSocketId) {
      io.to(friendSocketId).emit("friend_updated");
    }

    const mySocketId = getReceiverSocketId(myId);
    if (mySocketId) {
      io.to(mySocketId).emit("friend_updated");
    }

    res.status(200).json({ message: "Đã hủy kết bạn thành công" });
  } catch (error) {
    console.error("Lỗi trong unfriend controller:", error.message);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

// Lấy danh sách bạn bè
const getFriendsList = async (req, res) => {
  try {
    const myId = req.user._id;
    const user = await User.findById(myId).populate("friends", "username email avatar bio gender dob phone");
    
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    res.status(200).json(user.friends);
  } catch (error) {
    console.error("Lỗi trong getFriendsList controller:", error.message);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

// Lấy thông tin cá nhân của một user bằng ID và kiểm tra quan hệ bạn bè
const getUserProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const myId = req.user._id;

    const user = await User.findById(id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    // Kiểm tra xem đã là bạn bè chưa
    const isFriend = req.user.friends && req.user.friends.some(
      (friendId) => friendId.toString() === user._id.toString()
    );

    let status = "none";
    let requestId = null;

    if (isFriend) {
      status = "friends";
    } else {
      const request = await FriendRequest.findOne({
        $or: [
          { sender: myId, receiver: user._id },
          { sender: user._id, receiver: myId }
        ],
        status: "pending"
      });

      if (request) {
        requestId = request._id;
        status = request.sender.toString() === myId.toString() ? "sent_pending" : "received_pending";
      }
    }

    res.status(200).json({
      ...user.toObject(),
      friendshipStatus: status,
      requestId
    });
  } catch (error) {
    console.error("Lỗi trong getUserProfile controller:", error.message);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

module.exports = {
  searchUsers,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  unfriend,
  getFriendsList,
  getUserProfile
};
