import mongoose from 'mongoose';

export const QR_PREFIX = 'FIXIT:LOC:';

const pointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point', required: true },
    coordinates: {
      type: [Number], // [lng, lat]
      required: true,
      validate: {
        validator: (c) => c.length === 2 && Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90,
        message: 'Invalid coordinates',
      },
    },
  },
  { _id: false },
);

const locationSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 20,
    },
    building: { type: String, required: true, trim: true, maxlength: 60 },
    floor: { type: String, trim: true, maxlength: 20, default: '' },
    room: { type: String, trim: true, maxlength: 40, default: '' },
    label: { type: String, trim: true, maxlength: 80, default: '' },
    point: { type: pointSchema, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

locationSchema.index({ building: 1, code: 1 });
locationSchema.index({ point: '2dsphere' });

locationSchema.set('toJSON', {
  transform(_doc, ret) {
    ret.id = String(ret._id);
    ret.lng = ret.point?.coordinates?.[0];
    ret.lat = ret.point?.coordinates?.[1];
    ret.qr = `${QR_PREFIX}${ret.code}`;
    delete ret._id;
    delete ret.__v;
    delete ret.point;
    return ret;
  },
});

export { pointSchema };
export const Location = mongoose.models.Location ?? mongoose.model('Location', locationSchema);
