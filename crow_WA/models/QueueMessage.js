const mongoose = require('mongoose');

const queueMessageSchema = new mongoose.Schema({
  messageId: { type: String, required: true, unique: true },
  clientPhoneE164: { type: String, required: true, index: true },
  phoneE164: { type: String, required: true },
  message: { type: String, required: true },
  priority: { type: String, enum: ['high', 'normal', 'low'], default: 'normal' },
  attempts: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 5 },
  nextRetry: { type: Date, default: Date.now },
  timestamp: { type: Date, default: Date.now },
  status: { type: String, enum: ['pending', 'processing', 'sent', 'failed'], default: 'pending' },
  lastError: { type: String }
}, {
  timestamps: true,
  collection: 'queue_messages'
});

queueMessageSchema.index({ clientPhoneE164: 1, nextRetry: 1 });
queueMessageSchema.index({ clientPhoneE164: 1, priority: 1, nextRetry: 1 });

module.exports = mongoose.model('QueueMessage', queueMessageSchema);
