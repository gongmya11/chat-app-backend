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
    })
      .populate({
        path: "replyTo",
        select: "text image sender isRecalled",
        populate: {
          path: "sender",
          select: "fullName profilePic"
        }
      })
      .sort({ createdAt: 1 });

    res.status(200).json(messages);
  } catch (error) {
    console.error("Lỗi trong getMessages controller:", error.message);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

// Gửi tin nhắn mới
const sendMessage = async (req, res) => {
  try {
    const { text, image, replyTo } = req.body;
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
      replyTo: replyTo || null,
    });

    // Cập nhật tin nhắn cuối cùng của cuộc hội thoại
    conversation.lastMessage = newMessage._id;

    // Lưu đồng thời tin nhắn và cuộc trò chuyện để tối ưu
    await Promise.all([newMessage.save(), conversation.save()]);

    // Populate replyTo
    await newMessage.populate({
      path: "replyTo",
      select: "text image sender isRecalled",
      populate: {
        path: "sender",
        select: "fullName profilePic"
      }
    });

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

// Ghim hoặc bỏ ghim tin nhắn
const togglePinMessage = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const myId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Không tìm thấy tin nhắn" });
    }

    message.isPinned = !message.isPinned;
    await message.save();

    // Tìm cuộc hội thoại để gửi socket event thông báo cho người nhận
    const conversation = await Conversation.findById(message.conversationId);
    if (conversation) {
      const receiverId = conversation.participants.find(
        (p) => p.toString() !== myId.toString()
      );
      if (receiverId) {
        const receiverSocketId = getReceiverSocketId(receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("messagePinned", {
            messageId,
            isPinned: message.isPinned,
            message,
          });
        }
      }
    }

    res.status(200).json(message);
  } catch (error) {
    console.error("Lỗi trong togglePinMessage:", error.message);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

// Chỉnh sửa tin nhắn
const editMessage = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const { text } = req.body;
    const myId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Không tìm thấy tin nhắn" });
    }

    if (message.sender.toString() !== myId.toString()) {
      return res.status(403).json({ message: "Bạn không có quyền chỉnh sửa tin nhắn này" });
    }

    if (message.isRecalled) {
      return res.status(400).json({ message: "Không thể chỉnh sửa tin nhắn đã bị thu hồi" });
    }

    message.text = text;
    message.isEdited = true;
    await message.save();

    // Populate replyTo if exists
    if (message.replyTo) {
      await message.populate({
        path: "replyTo",
        select: "text image sender isRecalled",
        populate: {
          path: "sender",
          select: "fullName profilePic"
        }
      });
    }

    // Gửi sự kiện Socket.io đến người nhận
    const conversation = await Conversation.findById(message.conversationId);
    if (conversation) {
      const receiverId = conversation.participants.find(
        (p) => p.toString() !== myId.toString()
      );
      if (receiverId) {
        const receiverSocketId = getReceiverSocketId(receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("messageEdited", message);
        }
      }
    }

    res.status(200).json(message);
  } catch (error) {
    console.error("Lỗi trong editMessage controller:", error.message);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

// Thu hồi tin nhắn
const recallMessage = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const myId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Không tìm thấy tin nhắn" });
    }

    if (message.sender.toString() !== myId.toString()) {
      return res.status(403).json({ message: "Bạn không có quyền thu hồi tin nhắn này" });
    }

    message.text = "";
    message.image = "";
    message.isRecalled = true;
    message.isPinned = false;
    await message.save();

    // Gửi sự kiện Socket.io đến người nhận
    const conversation = await Conversation.findById(message.conversationId);
    if (conversation) {
      const receiverId = conversation.participants.find(
        (p) => p.toString() !== myId.toString()
      );
      if (receiverId) {
        const receiverSocketId = getReceiverSocketId(receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("messageRecalled", { messageId });
        }
      }
    }

    res.status(200).json({ messageId });
  } catch (error) {
    console.error("Lỗi trong recallMessage controller:", error.message);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

module.exports = {
  getUsersForSidebar,
  getMessages,
  sendMessage,
  togglePinMessage,
  editMessage,
  recallMessage,
};
