import mongoose from 'mongoose';
import { CATEGORIES, SEVERITIES, STATUSES } from '../utils/constants.js';
import { pointSchema } from './Location.js';

const { ObjectId } = mongoose.Schema.Types;

const historySchema = new mongoose.Schema(
  {
    status: { type: String, enum: STATUSES, required: true },
    // null means the system (jobs) made the change
    changedBy: { type: ObjectId, ref: 'User', default: null },
    at: { type: Date, required: true, default: Date.now },
    note: { type: String, maxlength: 500, default: '' },
  },
  { _id: false },
);

const issueSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    category: { type: String, enum: CATEGORIES, required: true },
    severity: { type: String, enum: SEVERITIES, default: 'medium', required: true },

    photoPath: { type: String, default: null },
    thumbPath: { type: String, default: null },
    resolutionPhotoPath: { type: String, default: null },
    resolutionThumbPath: { type: String, default: null },
    resolutionNote: { type: String, maxlength: 500, default: '' },

    point: { type: pointSchema, default: undefined },
    locationRef: { type: ObjectId, ref: 'Location', default: null },
    landmark: { type: String, trim: true, maxlength: 120, default: '' },

    status: { type: String, enum: STATUSES, default: 'open', required: true },
    reportedBy: { type: ObjectId, ref: 'User', required: true },
    assignedTo: { type: ObjectId, ref: 'User', default: null },
    supporters: { type: [{ type: ObjectId, ref: 'User' }], default: [] },

    priorityScore: { type: Number, default: 0 },
    // SLA clock start: creation, or the latest reopen (DECISIONS D-07)
    slaStartedAt: { type: Date, required: true },
    dueAt: { type: Date, required: true },
    escalatedAt: { type: Date, default: null },
    assignedAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },

    ai: {
      suggestedCategory: { type: String, enum: [...CATEGORIES, null], default: null },
      confidence: { type: Number, min: 0, max: 1, default: null },
      accepted: { type: Boolean, default: null },
    },
    embedding: { type: [Number], select: false, default: undefined },

    duplicateOf: { type: ObjectId, ref: 'Issue', default: null },
    rejectionReason: { type: String, maxlength: 500, default: '' },
    clientRequestId: { type: String, default: undefined },

    statusHistory: { type: [historySchema], default: [] },
  },
  { timestamps: true },
);

issueSchema.index({ status: 1, priorityScore: -1 });
issueSchema.index({ status: 1, createdAt: -1 });
issueSchema.index({ assignedTo: 1, status: 1 });
issueSchema.index({ reportedBy: 1, createdAt: -1 });
issueSchema.index({ supporters: 1 });
issueSchema.index({ locationRef: 1, createdAt: -1 });
issueSchema.index({ status: 1, resolvedAt: -1 });
issueSchema.index({ point: '2dsphere' });
issueSchema.index({ clientRequestId: 1 }, { unique: true, sparse: true });

export const Issue = mongoose.models.Issue ?? mongoose.model('Issue', issueSchema);
