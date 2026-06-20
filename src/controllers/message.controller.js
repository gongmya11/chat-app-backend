const User = require("../models/User");
const Message = require("../models/Message");
const Conversation = require("../models/Conversation");
const { getReceiverSocketId, io } = require("../lib/socket");

// Lấy danh sách tất cả user khác cho sidebar
const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const filteredUsers = await User.find({ _id: { $ne: loggedInUserId } }).select("-password");

    res.status(200).json(filteredUsers);
  } catch (error) {
    console.error("Lỗi trong getUsersForSidebar controller:", error.message);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

// Lấy tin nhắn giữa user hiện tại và user khác
const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id;

    // Tìm cuộc trò chuyện chứa cả 2 thành viên
    const conversation = await Conversation.findOne({
      participants: { $all: [myId, userToChatId] },
    });

    if (!conversation) {
      return res.status(200).json([]);
    }

    const messages = await Message.find({
      conversationId: conversation._id,
    }).sort({ createdAt: 1 });

    res.status(200).json(messages);
  } catch (error) {
    console.error("Lỗi trong getMessages controller:", error.message);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

// Gửi tin nhắn mới
const sendMessage = async (req, res) => {
  try {
    const { text, image } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    // Tìm xem cuộc trò chuyện đã tồn tại chưa
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId] },
    });

    // Nếu chưa tồn tại thì tạo mới
    if (!conversation) {
      conversation = new Conversation({
        participants: [senderId, receiverId],
      });
      await conversation.save();
    }

    // Tạo tin nhắn mới
    const newMessage = new Message({
      sender: senderId,
      conversationId: conversation._id,
      text,
      image,
    });

    // Cập nhật tin nhắn cuối cùng của cuộc hội thoại
    conversation.lastMessage = newMessage._id;

    // Lưu đồng thời tin nhắn và cuộc trò chuyện để tối ưu
    await Promise.all([newMessage.save(), conversation.save()]);

    // Gửi sự kiện thời gian thực bằng Socket.io đến người nhận nếu họ đang online
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.error("Lỗi trong sendMessage controller:", error.message);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

module.exports = {
  getUsersForSidebar,
  getMessages,
  sendMessage,
};
