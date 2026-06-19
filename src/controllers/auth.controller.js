const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { generateToken } = require("../lib/utils");

const signup = async (req, res) => {
  const { username, email, password } = req.body;

  try {
    if (!username || !email || !password) {
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Mật khẩu phải chứa ít nhất 6 ký tự" });
    }

    const userExists = await User.findOne({ $or: [{ email }, { username }] });
    if (userExists) {
      return res.status(400).json({ message: "Email hoặc Tên tài khoản đã tồn tại" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      username,
      email,
      password: hashedPassword,
    });

    if (newUser) {
      // Generate JWT token and set cookie
      generateToken(newUser._id, res);
      await newUser.save();

      res.status(201).json({
        _id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        avatar: newUser.avatar,
        createdAt: newUser.createdAt,
      });
    } else {
      res.status(400).json({ message: "Dữ liệu người dùng không hợp lệ" });
    }
  } catch (error) {
    console.error("Lỗi trong signup controller:", error.message);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Thông tin tài khoản hoặc mật khẩu không chính xác" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(400).json({ message: "Thông tin tài khoản hoặc mật khẩu không chính xác" });
    }

    generateToken(user._id, res);

    res.status(200).json({
      _id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      createdAt: user.createdAt,
    });
  } catch (error) {
    console.error("Lỗi trong login controller:", error.message);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

const logout = (req, res) => {
  try {
    res.cookie("jwt", "", { maxAge: 0 });
    res.status(200).json({ message: "Đăng xuất thành công" });
  } catch (error) {
    console.error("Lỗi trong logout controller:", error.message);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

const checkAuth = (req, res) => {
  try {
    res.status(200).json(req.user);
  } catch (error) {
    console.error("Lỗi trong checkAuth controller:", error.message);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

module.exports = { signup, login, logout, checkAuth };
