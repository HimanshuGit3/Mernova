import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { CATEGORIES, ROLES } from '../utils/constants.js';

const BCRYPT_COST = 10;

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'student', required: true },
    department: { type: String, trim: true, maxlength: 80, default: '' },
    skills: { type: [{ type: String, enum: CATEGORIES }], default: [] },
    fcmTokens: { type: [String], default: [], select: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

userSchema.index({ role: 1, isActive: 1 });

userSchema.methods.setPassword = async function setPassword(password) {
  this.passwordHash = await bcrypt.hash(password, BCRYPT_COST);
};

userSchema.methods.checkPassword = function checkPassword(password) {
  return bcrypt.compare(password, this.passwordHash);
};

userSchema.set('toJSON', {
  transform(_doc, ret) {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    delete ret.passwordHash;
    delete ret.fcmTokens;
    return ret;
  },
});

export const User = mongoose.models.User ?? mongoose.model('User', userSchema);

/** Constant-time-ish dummy compare so unknown emails take as long as wrong passwords. */
export const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', BCRYPT_COST);
