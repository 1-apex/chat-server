const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    chatroomId: {
        type: String, // Use Firestore chatroom ID
        required: true
    },
    senderId: {
        type: String,
        required: true
    },
    senderName: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Message', messageSchema);
