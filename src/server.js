require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);
const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const connectDB = require("./db");
const authRoutes = require("./routes/auth.route");
const messageRoutes = require("./routes/message.route");
const premiumRoutes = require("./routes/premium.route");
const { app, server } = require("./lib/socket");

app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, true);
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/premium", premiumRoutes);

app.get("/", (req, res) => res.send("API đang chạy"));

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  server.listen(PORT, () => console.log(`Server đang chạy ở port ${PORT}`));
});
