const mongoose = require('mongoose');

const DeviceSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, 
  token: { type: String, required: true },            
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: { type: String, default: 'Smart Node' },
  createdAt: { type: Date, default: Date.now },
  thinkspeakChannel: { type: String, default: '3288449' }
});

module.exports = mongoose.model('Device', DeviceSchema);