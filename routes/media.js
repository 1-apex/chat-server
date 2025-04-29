const express = require('express');
const router = express.Router();
const Media = require('../models/Media');

// GET all media for a specific chatroom
router.get('/chatroom/:chatroomId', async (req, res) => {
    const { chatroomId } = req.params;
    try {
        const mediaMessages = await Media.find({ chatroomId: chatroomId }).sort({ createdAt: 1 });
        console.log("Media: ", mediaMessages);
        res.json(mediaMessages);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
