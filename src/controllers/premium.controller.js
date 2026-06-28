const crypto = require("crypto");
const PremiumKey = require("../models/PremiumKey");
const User = require("../models/User");

const generateRandomKey = () => {
  return "DARK-" + crypto.randomBytes(6).toString("hex").toUpperCase().match(/.{1,4}/g).join("-");
};

const generateKey = async (req, res) => {
  try {
    const { method, amount, isTestMode } = req.body;

    // Giả lập kiểm tra số tiền chuyển khoản (phải tối thiểu 50.000đ hoặc $2)
    const minAmount = method === "visa" ? 2 : 50000;
    if (!amount || amount < minAmount) {
      return res.status(400).json({ message: "Số tiền thanh toán không đủ $2 hoặc 50.000đ" });
    }

    const keyString = generateRandomKey();
    
    const newKey = new PremiumKey({
      key: keyString,
      isTestMode: !!isTestMode,
      durationDays: 1,
    });

    await newKey.save();

    res.status(201).json({
      success: true,
      key: newKey.key,
      isTestMode: newKey.isTestMode,
      durationDays: newKey.durationDays,
      message: "Tạo mã kích hoạt thành công từ giao dịch giả lập",
    });
  } catch (error) {
    console.error("Lỗi trong generateKey controller:", error.message);
    res.status(500).json({ message: "Lỗi hệ thống khi tạo key" });
  }
};

const redeemKey = async (asyncReq, res) => {
  try {
    const { key } = asyncReq.body;
    const userId = asyncReq.user._id;

    if (!key) {
      return res.status(400).json({ message: "Vui lòng cung cấp mã kích hoạt" });
    }

    const foundKey = await PremiumKey.findOne({ key });

    if (!foundKey) {
      return res.status(400).json({ message: "Mã kích hoạt không chính xác" });
    }

    if (foundKey.isRedeemed) {
      return res.status(400).json({ message: "Mã kích hoạt này đã được sử dụng trước đó" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    // Tính toán thời gian hết hạn mới
    // Nếu còn thời hạn premium thì cộng dồn, nếu không thì tính từ hiện tại
    const baseTime = (user.premiumUntil && new Date(user.premiumUntil) > new Date())
      ? new Date(user.premiumUntil).getTime()
      : Date.now();

    // Test mode: 2 phút, Normal mode: 24 giờ
    const durationMs = foundKey.isTestMode ? 2 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const newPremiumUntil = new Date(baseTime + durationMs);

    // Cập nhật User
    user.premiumUntil = newPremiumUntil;
    await user.save();

    // Cập nhật Key
    foundKey.isRedeemed = true;
    foundKey.redeemedBy = userId;
    foundKey.redeemedAt = new Date();
    await foundKey.save();

    res.status(200).json({
      _id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      createdAt: user.createdAt,
      premiumUntil: user.premiumUntil,
      message: `Kích hoạt premium thành công! Thời hạn của bạn đến: ${newPremiumUntil.toLocaleString()}`,
    });
  } catch (error) {
    console.error("Lỗi trong redeemKey controller:", error.message);
    res.status(500).json({ message: "Lỗi hệ thống khi kích hoạt key" });
  }
};

const checkStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    const now = new Date();
    const isPremiumActive = !!(user.premiumUntil && new Date(user.premiumUntil) > now);
    const timeLeftMs = isPremiumActive ? new Date(user.premiumUntil).getTime() - now.getTime() : 0;

    res.status(200).json({
      isPremiumActive,
      premiumUntil: user.premiumUntil,
      timeLeftMs,
    });
  } catch (error) {
    console.error("Lỗi trong checkStatus controller:", error.message);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

module.exports = {
  generateKey,
  redeemKey,
  checkStatus,
};
