/**
 * Create (or re-activate) an admin account on a fresh deployment, without seeding demo data.
 *   ADMIN_PASSWORD='a long password' npm run create-admin -w server -- --email admin@college.edu --name "Estate Office"
 */
import mongoose from 'mongoose';
import { connectDb, disconnectDb } from '../config/db.js';
import { User } from '../models/User.js';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

const email = arg('email')?.trim().toLowerCase();
const name = arg('name')?.trim() || 'Administrator';
const password = process.env.ADMIN_PASSWORD;

if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
  console.error(
    'Usage: ADMIN_PASSWORD=... npm run create-admin -w server -- --email you@college.edu [--name "Your Name"]',
  );
  process.exit(1);
}
if (!password || password.length < 8) {
  console.error(
    'Set ADMIN_PASSWORD (at least 8 characters) in the environment; it is never passed on the command line.',
  );
  process.exit(1);
}

try {
  await connectDb();
  let user = await User.findOne({ email });
  if (user && user.role !== 'admin') {
    console.error(`${email} already exists as a ${user.role}; refusing to change its role.`);
    process.exitCode = 1;
  } else {
    user ??= new User({ email, name, role: 'admin' });
    user.isActive = true;
    await user.setPassword(password);
    await user.save();
    console.log(`Admin ready: ${user.name} <${user.email}>`);
  }
} catch (err) {
  console.error('Failed:', err.message);
  process.exitCode = 1;
} finally {
  if (mongoose.connection.readyState) await disconnectDb();
}
