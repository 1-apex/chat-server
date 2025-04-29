const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const { GridFsStorage } = require("multer-gridfs-storage");
const Grid = require("gridfs-stream");
const { GridFSBucket } = require("mongodb");
const path = require("path");
const { Server } = require("socket.io");
const Message = require("./models/Message");
const { Readable } = require("stream");
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


const mediaRoutes = require('./routes/media');
app.use("/api/media", mediaRoutes);

// GridFS Setup
let gfs;
const conn = mongoose.createConnection(process.env.MONGO_URI);

conn.once("open", () => {
  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection("uploads");
  console.log("GridFS initialized");
});

// GridFS Storage config
// const storage = new GridFsStorage({
//   url: process.env.MONGO_URI,
//   file: (req, file) => {
//     return new Promise((resolve, reject) => {
//       const filename = `${Date.now()}-${file.originalname}`;
//       const fileInfo = {
//         filename: filename,
//         bucketName: 'uploads',
//       };
//       resolve(fileInfo);
//     });
//   }
// });
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});


app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const { chatroomId, senderId } = req.body;
    const fileBuffer = req.file.buffer;
    const filename = `${Date.now()}-${req.file.originalname}`;

    const bucket = new GridFSBucket(mongoose.connection.db, {
      bucketName: "uploads",
    });

    const uploadStream = bucket.openUploadStream(filename, {
      contentType: req.file.mimetype,
    });

    const readable = Readable.from(fileBuffer);
    readable.pipe(uploadStream)
      .on("error", (error) => {
        console.error("Upload error:", error);
        res.status(500).json({ error: "Upload failed" });
      })
      .on("finish", async (uploadResult) => {
        const media = new Media({
          chatroomId,
          senderId,
          mediaUrl: `/file/${filename}`,  // Use the filename variable defined earlier
        });

        await media.save();
        io.to(chatroomId).emit("receive_media", media);
        res.status(200).json({ message: "File uploaded", media });
      });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Unexpected error", details: err.message });
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
