import mongoose from 'mongoose';
import { NOTIFICATION_TYPES } from '../utils/constants.js';

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true, maxlength: 120 },
    body: { type: String, maxlength: 300, default: '' },
    issue: { type: mongoose.Schema.Types.ObjectId, ref: 'Issue', default: null },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

notificationSchema.index({ user: 1, readAt: 1, createdAt: -1 });
notificationSchema.index({ user: 1, createdAt: -1 });

notificationSchema.set('toJSON', {
  transform(_doc, ret) {
    ret.id = String(ret._id);
    ret.issue = ret.issue ? String(ret.issue) : null;
    ret.user = String(ret.user);
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const Notification =
  mongoose.models.Notification ?? mongoose.model('Notification', notificationSchema);
