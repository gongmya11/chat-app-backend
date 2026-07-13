const Notification = require("../models/Notification");

// Lấy danh sách thông báo của người dùng hiện tại
const getNotifications = async (req, res) => {
  try {
    const myId = req.user._id;
    const notifications = await Notification.find({ receiver: myId })
      .populate("sender", "username avatar")
      .sort({ createdAt: -1 });

    res.status(200).json(notifications);
  } catch (error) {
    console.error("Lỗi trong getNotifications controller:", error.message);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

// Đánh dấu một thông báo cụ thể là đã đọc
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const myId = req.user._id;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, receiver: myId },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: "Không tìm thấy thông báo" });
    }

    res.status(200).json(notification);
  } catch (error) {
    console.error("Lỗi trong markAsRead controller:", error.message);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

// Đánh dấu tất cả thông báo là đã đọc
const markAllAsRead = async (req, res) => {
  try {
    const myId = req.user._id;

    await Notification.updateMany(
      { receiver: myId, isRead: false },
      { isRead: true }
    );

    res.status(200).json({ message: "Đã đánh dấu tất cả thông báo là đã đọc" });
  } catch (error) {
    console.error("Lỗi trong markAllAsRead controller:", error.message);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

// Xóa tất cả thông báo
const clearNotifications = async (req, res) => {
  try {
    const myId = req.user._id;

    await Notification.deleteMany({ receiver: myId });

    res.status(200).json({ message: "Đã xóa tất cả thông báo" });
  } catch (error) {
    console.error("Lỗi trong clearNotifications controller:", error.message);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  clearNotifications
};
