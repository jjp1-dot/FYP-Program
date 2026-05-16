//1.
//modelsResponse.js
const mongoose = require('mongoose');

const responseSchema = new mongoose.Schema({
  userName: String,
  userEmail: String,
  answers: [{ questionId: Number, selectedOption: String }],
  resultTrack: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Response', responseSchema);