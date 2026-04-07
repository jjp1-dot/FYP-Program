const mongoose = require('mongoose');

const AdminSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },   // plain text for testing
    role: { type: String, default: 'admin' }
});

module.exports = mongoose.model('Admin', AdminSchema);