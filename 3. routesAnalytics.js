//3.
//routesAnalytics.js
const express = require('express');
const router = express.Router();
const Response = require('../models/Response');

router.get('/summary', async (req, res) => {
  try {
    const stats = await Response.aggregate([
      { $group: { _id: "$resultTrack", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: "Could not fetch analytics" });
  }
});

module.exports = router;