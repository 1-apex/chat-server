const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const { GridFsStorage } = require("multer-gridfs-storage");
const Grid = require("gridfs-stream");
const path = require("path");
const { Server } = require("socket.io");
const Message = require("./models/Message");
const Media = require("./models/Media");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

// Message Routes (assuming message routes are correctly defined in the 'messages.js' file)
const messageRoutes = require("./routes/messages");
app.use("/api/messages", messageRoutes);

// GridFS Setup
let gfs;
const conn = mongoose.createConnection(process.env.MONGO_URI);

conn.once("open", () => {
  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection("uploads");
  console.log("GridFS initialized");
});

// GridFS Storage config
const storage = new GridFsStorage({
  url: process.env.MONGO_URI,
  file: (req, file) => {
    // const allowedTypes = [
    //   "image/jpeg",
    //   "image/png",
    //   "image/gif",
    //   "application/pdf",
    //   "application/msword",
    //   "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    // ];

    // if (!allowedTypes.includes(file.mimetype)) {
    //   return null;
    // }

    return {
      filename: `${Date.now()}-${file.originalname}`,
      bucketName: "uploads",
    };
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// Upload endpoint
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { chatroomId, senderId } = req.body;

    // Check if required fields are present
    if (!chatroomId || !senderId) {
      return res.status(400).json({ error: "ChatroomId and SenderId are required" });
    }

    const fileId = req.file.id; // Get the file id from the uploaded file
    const fileMetadata = await gfs.files.findOne({ _id: fileId });

    if (!fileMetadata) {
      return res.status(500).json({ error: "File not found in GridFS" });
    }

    const media = new Media({
      chatroomId,
      senderId,
      mediaUrl: `/file/${req.file.filename}`,
    });

    await media.save();
    io.to(chatroomId).emit("receive_media", media);

    res.status(200).json({ message: "File uploaded to database", media });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "File upload failed", details: err.message });
  }
});



// Serve file from GridFS
app.get("/file/:filename", async (req, res) => {
  try {
    console.log("Requested file:", req.params.filename);  // Debugging the filename
    gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
      if (err || !file) {
        return res.status(404).json({ error: "File not found" });
      }

      const readstream = gfs.createReadStream(file.filename);
      res.set("Content-Type", file.contentType);
      readstream.pipe(res);
    });
  } catch (err) {
    res.status(500).json({ error: "Error retrieving file", details: err.message });
  }
});

// Regular Mongoose Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Mongoose connected"))
  .catch((err) => console.error("Mongoose connection error:", err));

// Socket.IO setup
io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("join_room", (chatroomId) => {
    socket.join(chatroomId);
    console.log(`Socket ${socket.id} joined chatroom: ${chatroomId}`);
  });

  socket.on("send_message", async (data) => {
    try {
      console.log("Received message:", data);
      const { chatroomId, senderId, senderName, content } = data;

      if (!content) {
        return;  // Do not send empty messages
      }

      const message = new Message({ chatroomId, senderId, content, senderName });
      await message.save();
      io.to(chatroomId).emit("receive_message", message);
    } catch (err) {
      console.error("Error sending message:", err);
    }
  });

  socket.on("send_media", async (data) => {
    try {
      const { chatroomId, senderId, mediaUrl } = data;

      const media = new Media({ chatroomId, senderId, mediaUrl });
      await media.save();
      io.to(chatroomId).emit("receive_media", media);
    } catch (err) {
      console.error("Error sending media:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
