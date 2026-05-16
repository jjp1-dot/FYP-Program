//4.
//index.js
const express = require('express');
const mongoose = require('mongoose');
const app = express();

app.use(express.json());

// 1. Connect to DB (Make sure MongoDB is running!)
mongoose.connect('mongodb://localhost:27017/fyp_db')
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error("Could not connect", err));

// 2. Setup Routes
app.use('/api/responses', require('./routes/responses'));
app.use('/api/analytics', require('./routes/analytics'));

app.listen(3000, () => console.log('Server running on port 3000'));