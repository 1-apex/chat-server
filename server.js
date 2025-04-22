const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const Message = require('./models/Message'); // from previous step

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // you can restrict to your Kotlin app
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log("MongoDB Connected"))
  .catch(err => console.error(err));

// Socket.IO events
io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('join_room', (chatroomId) => {
        socket.join(chatroomId);
        console.log(`User joined chatroom: ${chatroomId}`);
    });

    socket.on('send_message', async (data) => {
        const { chatroomId, senderId, content } = data;

        const message = new Message({ chatroomId, senderId, content });
        await message.save();

        io.to(chatroomId).emit('receive_message', message);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// REST API to fetch messages for a chatroom
app.get('/messages/:chatroomId', async (req, res) => {
    const messages = await Message.find({ chatroomId: req.params.chatroomId }).sort({ timestamp: 1 });
    res.json(messages);
});

const PORT = 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
