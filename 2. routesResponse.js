//2.
//routesResponse.js
const express = require('express');
const router = express.Router();
const Response = require('../models/Response');

router.post('/submit', async (req, res) => {
  try {
    const { userName, userEmail, answers } = req.body;
    const counts = { A: 0, B: 0, C: 0, D: 0, E: 0 };
    answers.forEach(ans => { counts[ans.selectedOption]++; });
    const topCategory = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);

    const newResponse = new Response({
      userName, userEmail, answers, resultTrack: topCategory 
    });

    await newResponse.save();
    res.status(201).json({ message: "Assessment complete!", track: topCategory });
  } catch (error) {
    res.status(500).json({ error: "Failed to save response" });
  }
});

module.exports = router;