/**
 * Development seed data (SPEC phase 3).
 *   npm run seed -w server          (always runs with --reset)
 *   node scripts/seed.js            (refuses to touch an already seeded database)
 *   node scripts/seed.js --reset    (wipes users, locations, issues, notifications and uploads first)
 *   node scripts/seed.js --reset --with-ai   (also stores CLIP embeddings; downloads the model once)
 */
import fs from 'node:fs/promises';
import sharp from 'sharp';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { connectDb, disconnectDb } from '../config/db.js';
import { User } from '../models/User.js';
import { Location } from '../models/Location.js';
import { Issue } from '../models/Issue.js';
import { Notification } from '../models/Notification.js';
import { computeDueAt, refreshSla, isOverdue } from '../services/sla.js';
import { saveImage } from '../services/storage.js';
import { artSvg } from './seedArt.js';

const args = new Set(process.argv.slice(2));
const RESET = args.has('--reset');
const WITH_AI = args.has('--with-ai');
const HOUR = 36e5;
const DAY = 24 * HOUR;

if (env.NODE_ENV === 'production') {
  console.error('Refusing to seed in production.');
  process.exit(1);
}
if (!env.SEED_PASSWORD || env.SEED_PASSWORD.length < 8) {
  console.error('Set SEED_PASSWORD (at least 8 characters) in server/.env before seeding.');
  process.exit(1);
}

// Deterministic randomness so every seed looks the same
let state = 20261018;
const rand = () => {
  state = (state * 1103515245 + 12345) % 2147483648;
  return state / 2147483648;
};
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (a, b) => a + rand() * (b - a);

// ---------------------------------------------------------------- campus

const M_PER_DEG_LAT = 111320;
function offset(lat, lng, northM, eastM) {
  return [
    lng + eastM / (M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180)),
    lat + northM / M_PER_DEG_LAT,
  ];
}

const BUILDINGS = [
  {
    name: 'Academic Block A',
    prefix: 'A',
    north: 90,
    east: -130,
    rooms: [
      ['1', '101', 'Lecture Hall 1'],
      ['1', '104', 'Tutorial Room'],
      ['2', '201', 'MCA Classroom'],
      ['2', '204', 'Seminar Hall'],
      ['3', '305', 'Faculty Cabin'],
    ],
  },
  {
    name: 'Academic Block B',
    prefix: 'B',
    north: 130,
    east: 60,
    rooms: [
      ['1', '102', 'Classroom'],
      ['2', '204', 'Smart Classroom'],
      ['2', '210', 'Project Lab'],
      ['3', '301', 'Classroom'],
      ['3', '312', 'Staff Room'],
    ],
  },
  {
    name: 'Central Library',
    prefix: 'L',
    north: -40,
    east: 10,
    rooms: [
      ['G', '001', 'Reading Hall'],
      ['G', '010', 'Circulation Desk'],
      ['1', '101', 'Digital Library'],
      ['1', '115', 'Group Study Room'],
      ['2', '201', 'Reference Section'],
    ],
  },
  {
    name: 'Engineering Labs',
    prefix: 'E',
    north: -20,
    east: 190,
    rooms: [
      ['G', '005', 'Electronics Lab'],
      ['G', '012', 'Workshop'],
      ['1', '103', 'Networks Lab'],
      ['1', '110', 'AI Lab'],
      ['2', '204', 'Robotics Lab'],
    ],
  },
  {
    name: 'Student Hostel',
    prefix: 'H',
    north: -170,
    east: -210,
    rooms: [
      ['G', '002', 'Common Room'],
      ['G', '020', 'Mess Hall'],
      ['1', '118', 'Laundry'],
      ['2', '214', 'Study Room'],
      ['3', '307', 'Washroom Block'],
    ],
  },
  {
    name: 'Food Court',
    prefix: 'F',
    north: -190,
    east: 120,
    rooms: [
      ['G', '001', 'Main Counter'],
      ['G', '004', 'Seating Area'],
      ['G', '008', 'Washroom'],
      ['1', '101', 'Cafe Terrace'],
      ['1', '106', 'Juice Bar'],
    ],
  },
];

const STAFF = [
  { name: 'Arun Das', email: 'admin@fixit.campus', role: 'admin', department: 'Estate Office' },
  {
    name: 'Ravi Kumar',
    email: 'ravi.tech@fixit.campus',
    role: 'technician',
    department: 'Maintenance',
    skills: ['electrical', 'network'],
  },
  {
    name: 'Suresh Babu',
    email: 'suresh.tech@fixit.campus',
    role: 'technician',
    department: 'Maintenance',
    skills: ['plumbing', 'cleanliness'],
  },
  {
    name: 'Anil Sharma',
    email: 'anil.tech@fixit.campus',
    role: 'technician',
    department: 'Maintenance',
    skills: ['furniture', 'other', 'safety'],
  },
  {
    name: 'Deepa Nair',
    email: 'deepa.tech@fixit.campus',
    role: 'technician',
    department: 'IT Services',
    skills: ['network', 'electrical', 'safety'],
  },
];

const STUDENTS = [
  ['Asha Rao', 'MCA'],
  ['Rahul Verma', 'MCA'],
  ['Sneha Iyer', 'BCA'],
  ['Karthik Reddy', 'B.Tech CSE'],
  ['Fatima Khan', 'MBA'],
  ['Arjun Das', 'MCA'],
  ['Meera Pillai', 'B.Tech ECE'],
  ['Vikram Singh', 'BBA'],
];

const TITLES = {
  electrical: [
    'Projector flickering in {code}',
    'Tube light not working in {code}',
    'Power socket sparking in {code}',
    'Ceiling fan very noisy in {code}',
    'AC not cooling in {code}',
  ],
  plumbing: [
    'Water leaking under the washbasin',
    'Tap not closing in {building} washroom',
    'Blocked drain in {code}',
    'Water cooler leaking on floor {floor}',
  ],
  furniture: [
    'Broken chair in {code}',
    'Wobbly desk in {code}',
    'Whiteboard stand damaged in {code}',
    'Cupboard door off its hinge in {code}',
  ],
  network: [
    'Wi-Fi dead zone in {code}',
    'LAN port not working in {code}',
    'Very slow Wi-Fi in {building}',
    'Access point blinking red in {code}',
  ],
  cleanliness: [
    'Overflowing dustbin near {label}',
    'Washroom needs cleaning in {building}',
    'Litter on the stairs, floor {floor}',
  ],
  safety: [
    'Exposed wires near {code}',
    'Fire extinguisher missing on floor {floor}',
    'Wet floor without warning sign in {code}',
    'Emergency exit blocked in {building}',
  ],
  other: [
    'Crack in the wall of {code}',
    'Notice board falling off in {building}',
    'Door lock jammed in {code}',
  ],
};

const DESCRIPTIONS = {
  electrical: 'Noticed during the morning lecture. It keeps happening and is distracting everyone.',
  plumbing: 'Water is collecting on the floor and it is slippery. Please send someone soon.',
  furniture: 'One leg is broken and it is not safe to sit on. Several students have complained.',
  network: 'Devices connect but nothing loads. Tried on laptop and phone, same problem.',
  cleanliness: 'Has not been cleared for a couple of days and it smells.',
  safety: 'This looks dangerous, especially with so many people walking past.',
  other: 'Getting worse every week. Reporting so it can be checked.',
};

// status plan: how many issues end in each status
const PLAN = [
  ['open', 12],
  ['assigned', 9],
  ['in_progress', 8],
  ['resolved', 9],
  ['closed', 14],
  ['reopened', 4],
  ['rejected', 4],
];
const SEVERITY_WEIGHTS = [
  ['low', 0.2],
  ['medium', 0.4],
  ['high', 0.28],
  ['critical', 0.12],
];
const CATEGORIES = Object.keys(TITLES);

function weightedSeverity() {
  let x = rand();
  for (const [s, w] of SEVERITY_WEIGHTS) {
    if ((x -= w) <= 0) return s;
  }
  return 'medium';
}

function fill(template, loc) {
  return template
    .replace('{code}', loc.code)
    .replace('{building}', loc.building)
    .replace('{floor}', loc.floor)
    .replace('{label}', loc.label.toLowerCase());
}

async function photo(category, variant, fixed, at) {
  const svg = artSvg(category, variant, { fixed });
  const jpg = await sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toBuffer();
  return saveImage(jpg, { now: at });
}

// ---------------------------------------------------------------- main

async function main() {
  await connectDb();
  const seeded = await User.exists({ email: STAFF[0].email });
  if (seeded && !RESET) {
    console.log(
      'Database already seeded. Run with --reset to wipe and reseed (npm run seed -w server).',
    );
    return;
  }
  if (RESET) {
    await Promise.all([
      User.deleteMany({}),
      Location.deleteMany({}),
      Issue.deleteMany({}),
      Notification.deleteMany({}),
    ]);
    await fs.rm(env.UPLOAD_PATH, { recursive: true, force: true });
    console.log('Reset: cleared users, locations, issues, notifications and uploads.');
  }
  await Promise.all([User, Location, Issue, Notification].map((m) => m.syncIndexes()));

  let ai = null;
  if (WITH_AI) {
    const { createClipService } = await import('../services/clip.js');
    ai = createClipService();
    console.log('Loading CLIP model for embeddings (first run downloads ~150 MB)...');
    await ai.warmup();
  }

  // users
  const users = {};
  for (const s of STAFF) {
    const u = new User({ ...s, skills: s.skills ?? [] });
    await u.setPassword(env.SEED_PASSWORD);
    await u.save();
    users[s.email] = u;
  }
  const students = [];
  for (const [name, department] of STUDENTS) {
    const email = `${name.split(' ')[0].toLowerCase()}@student.fixit.campus`;
    const u = new User({ name, email, role: 'student', department });
    await u.setPassword(env.SEED_PASSWORD);
    await u.save();
    students.push(u);
  }
  const admin = users[STAFF[0].email];
  const technicians = STAFF.filter((s) => s.role === 'technician').map((s) => users[s.email]);

  // locations
  const locations = [];
  for (const b of BUILDINGS) {
    for (const [i, [floor, room, label]] of b.rooms.entries()) {
      const [lng, lat] = offset(
        env.CAMPUS_CENTER_LAT,
        env.CAMPUS_CENTER_LNG,
        b.north + (i - 2) * 9,
        b.east + ((i % 2) * 2 - 1) * 12,
      );
      locations.push(
        await Location.create({
          code: `${b.prefix}-${room}`,
          building: b.name,
          floor,
          room,
          label,
          point: { type: 'Point', coordinates: [lng, lat] },
        }),
      );
    }
  }

  // issues
  const now = Date.now();
  const statuses = PLAN.flatMap(([s, n]) => Array(n).fill(s));
  const created = [];
  const notifications = [];
  let variant = 0;

  for (const [index, status] of statuses.entries()) {
    const category = CATEGORIES[index % CATEGORIES.length];
    const severity = index < 3 ? 'critical' : weightedSeverity();
    const loc = locations[Math.floor(rand() * locations.length)];
    const reporter = index % 4 === 0 ? students[0] : pick(students); // Asha (demo student) has plenty
    const skilled = technicians.filter((t) => t.skills.includes(category));
    const tech = pick(skilled.length ? skilled : technicians);

    // Ages: finished issues are older; active ones are aged against their SLA so that
    // about 30% are overdue; a few are from today for the Live Booth.
    const slaMs = computeDueAt(0, severity).getTime();
    let age;
    if (['closed', 'rejected'].includes(status)) age = between(4, 30) * DAY;
    // resolved issues stay inside the AUTO_CLOSE_HOURS window, so the job does not close them at start-up
    else if (status === 'resolved') age = between(0.6, 2.4) * DAY;
    else if (status === 'reopened') age = between(2, 12) * DAY;
    else if (index % 11 === 0) age = between(0.1, 0.6) * Math.min(slaMs, 6 * HOUR);
    else age = Math.min(20 * DAY, slaMs * (rand() < 0.3 ? between(1.1, 2.5) : between(0.1, 0.85)));
    const createdAt = new Date(now - age);
    const history = [{ status: 'open', changedBy: reporter._id, at: createdAt, note: 'Reported' }];
    // Advance the issue's clock by ~`hours`, but never past "now" (recent issues get
    // proportionally shorter gaps so every event stays in the past).
    let t = createdAt.getTime();
    const step = (hours) => {
      const remaining = now - 5 * 60 * 1000 - t;
      t += Math.max(0, Math.min(hours * HOUR, remaining * 0.4));
      return new Date(t);
    };

    const doc = {
      title: fill(pick(TITLES[category]), loc),
      description: DESCRIPTIONS[category],
      category,
      severity,
      status,
      point: loc.point,
      locationRef: loc._id,
      reportedBy: reporter._id,
      supporters: [],
      createdAt,
      slaStartedAt: createdAt,
      dueAt: computeDueAt(createdAt, severity),
      ai:
        rand() < 0.75
          ? {
              suggestedCategory: category,
              confidence: Math.round(between(0.55, 0.95) * 100) / 100,
              accepted: true,
            }
          : undefined,
    };

    const chain = ['assigned', 'in_progress', 'resolved', 'closed', 'reopened'].includes(status);
    if (chain) {
      doc.assignedTo = tech._id;
      doc.assignedAt = step(between(0.3, 5));
      history.push({
        status: 'assigned',
        changedBy: admin._id,
        at: doc.assignedAt,
        note: `Assigned to ${tech.name}`,
      });
    }
    if (['in_progress', 'resolved', 'closed', 'reopened'].includes(status)) {
      doc.startedAt = step(between(0.3, 8));
      history.push({ status: 'in_progress', changedBy: tech._id, at: doc.startedAt, note: '' });
    }
    if (['resolved', 'closed', 'reopened'].includes(status)) {
      doc.resolvedAt = step(between(1, 36));
      doc.resolutionNote = pick([
        'Replaced the faulty part.',
        'Fixed and tested.',
        'Repaired; working normally now.',
        'Cleaned and checked.',
      ]);
      history.push({
        status: 'resolved',
        changedBy: tech._id,
        at: doc.resolvedAt,
        note: doc.resolutionNote,
      });
    }
    if (status === 'closed') {
      doc.closedAt = step(between(2, 40));
      const bySystem = rand() < 0.3;
      history.push({
        status: 'closed',
        changedBy: bySystem ? null : reporter._id,
        at: doc.closedAt,
        note: bySystem ? 'Closed automatically' : 'Confirmed fixed',
      });
    }
    if (status === 'reopened') {
      const at = step(between(4, 30));
      history.push({
        status: 'reopened',
        changedBy: reporter._id,
        at,
        note: 'Problem came back the next day',
      });
      doc.resolvedAt = null;
      doc.slaStartedAt = at;
      doc.dueAt = computeDueAt(at, severity);
    }
    if (status === 'rejected') {
      const at = step(between(0.5, 10));
      doc.rejectionReason = pick([
        'Duplicate of an existing report',
        'Not a maintenance issue; forwarded to the department',
      ]);
      history.push({ status: 'rejected', changedBy: admin._id, at, note: doc.rejectionReason });
    }
    doc.statusHistory = history;

    // supporters on some active issues ("Me too")
    if (['open', 'assigned', 'in_progress', 'reopened'].includes(status) && rand() < 0.45) {
      const n = 1 + Math.floor(rand() * 5);
      doc.supporters = students
        .filter((s) => !s._id.equals(reporter._id))
        .sort(() => rand() - 0.5)
        .slice(0, n)
        .map((s) => s._id);
    }

    // photos (before, and after for anything that was resolved)
    variant += 1;
    const before = await photo(category, variant, false, createdAt);
    doc.photoPath = before.photoPath;
    doc.thumbPath = before.thumbPath;
    if (ai) doc.embedding = (await ai.embed(before.buffer)) ?? undefined;
    if (['resolved', 'closed', 'reopened'].includes(status)) {
      const after = await photo(category, variant, true, createdAt);
      doc.resolutionPhotoPath = after.photoPath;
      doc.resolutionThumbPath = after.thumbPath;
    }

    const issue = new Issue({ ...doc, updatedAt: history.at(-1).at });
    if (isOverdue(issue, new Date(now))) issue.escalatedAt = new Date(issue.dueAt.getTime() + HOUR);
    refreshSla(issue, new Date(now));
    await issue.save({ timestamps: false });
    created.push(issue);

    // inbox entries that make the demo feel lived-in
    if (index % 5 === 0) {
      notifications.push({
        user: admin._id,
        type: 'issue_created',
        title: `New ${category} issue`,
        body: `${issue.title} · ${loc.code}, ${loc.building}`,
        issue: issue._id,
        createdAt,
        readAt: index > 20 ? createdAt : null,
      });
    }
    if (issue.escalatedAt) {
      notifications.push({
        user: admin._id,
        type: 'sla_overdue',
        title: 'SLA breached',
        body: `${issue.title} · ${severity}`,
        issue: issue._id,
        createdAt: issue.escalatedAt,
        readAt: null,
      });
    }
    if (doc.assignedAt) {
      notifications.push({
        user: tech._id,
        type: 'issue_assigned',
        title: 'New job assigned to you',
        body: `${issue.title} · ${loc.code}`,
        issue: issue._id,
        createdAt: doc.assignedAt,
        readAt: status === 'assigned' ? null : doc.assignedAt,
      });
    }
    if (doc.resolvedAt || status === 'closed') {
      notifications.push({
        user: reporter._id,
        type: 'status_changed',
        title: 'Fixed! Please confirm',
        body: `"${issue.title}" was marked resolved.`,
        issue: issue._id,
        createdAt: doc.resolvedAt ?? history.at(-1).at,
        readAt: status === 'closed' ? history.at(-1).at : null,
      });
    }
  }
  await Notification.insertMany(notifications.filter((n) => n.createdAt));

  const counts = Object.fromEntries(
    PLAN.map(([s]) => [s, created.filter((i) => i.status === s).length]),
  );
  const overdue = created.filter((i) => isOverdue(i, new Date(now))).length;
  console.log(
    `\nSeeded ${locations.length} locations in ${BUILDINGS.length} buildings, ${Object.keys(users).length + students.length} users, ${created.length} issues (${overdue} overdue).`,
  );
  console.log('Issues by status:', counts);
  console.log(`\nDemo accounts (password for all: ${env.SEED_PASSWORD})`);
  console.table([
    ...STAFF.map((s) => ({
      role: s.role,
      name: s.name,
      email: s.email,
      skills: (s.skills ?? []).join(', '),
    })),
    ...students
      .slice(0, 3)
      .map((s) => ({ role: 'student', name: s.name, email: s.email, skills: '' })),
  ]);
  console.log(
    `(+ ${students.length - 3} more students: ${students
      .slice(3)
      .map((s) => s.email)
      .join(', ')})`,
  );
  if (!WITH_AI)
    console.log(
      'Tip: add --with-ai to store CLIP embeddings so duplicate detection works on seed photos.',
    );
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) await disconnectDb();
  });
