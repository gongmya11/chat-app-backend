const mongoose = require("mongoose");

const premiumKeySchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
    },
    isRedeemed: {
      type: Boolean,
      default: false,
    },
    redeemedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    redeemedAt: {
      type: Date,
      default: null,
    },
    durationDays: {
      type: Number,
      default: 1, // 1 day
    },
    isTestMode: {
      type: Boolean,
      default: false, // 2 minutes activation
    },
  },
  { timestamps: true }
);

const PremiumKey = mongoose.model("PremiumKey", premiumKeySchema);
module.exports = PremiumKey;
