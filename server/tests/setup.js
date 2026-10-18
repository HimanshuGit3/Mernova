import { afterAll, beforeAll } from 'vitest';
import mongoose from 'mongoose';
import { connectDb } from '../config/db.js';
import { env } from '../config/env.js';

// Each test file starts from an empty test database (env.js guarantees the name contains "test").
beforeAll(async () => {
  await connectDb(env.MONGODB_URI);
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
});

afterAll(async () => {
  await mongoose.disconnect();
});
