const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protectRoute = async (req, res, next) => {
  try {
    const token = req.cookies.jwt;

    if (!token) {
      return res.status(401).json({ message: "Không có quyền truy cập - Không tìm thấy token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded) {
      return res.status(401).json({ message: "Không có quyền truy cập - Token không hợp lệ" });
    }

    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Lỗi trong protectRoute middleware:", error.message);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

module.exports = { protectRoute };
