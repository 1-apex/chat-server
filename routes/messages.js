const express = require('express');
const router = express.Router();
const Message = require('../models/Message');

// GET all messages for a specific chatroom
router.get('/chatroom/:chatroomId', async (req, res) => {
    const { chatroomId } = req.params;
    try {
        const messages = await Message.find({ chatroomId: chatroomId }).sort({ timestamp: 1 });
        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
