// models/Media.js
const mongoose = require("mongoose");

const mediaSchema = new mongoose.Schema(
  {
    chatroomId: { type: String, required: true },
    senderId: { type: String, required: true },
    mediaUrl: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Media", mediaSchema);
