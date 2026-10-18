import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Photo storage on local disk (D10). Everything outside this file only sees
 * paths like `/uploads/2026/10/<random>.jpg`, so a cloud bucket can replace it later.
 */

export const MAX_SIDE = 1600;
export const THUMB_SIDE = 400;

/** JPEG starts with FF D8 FF, PNG with 89 50 4E 47 0D 0A 1A 0A. */
export function sniffImageType(buffer) {
  if (!buffer || buffer.length < 8) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg';
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((b, i) => buffer[i] === b)) return 'png';
  return null;
}

function datedDir(now = new Date()) {
  const y = String(now.getFullYear());
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return { rel: `${y}/${m}`, abs: path.join(env.UPLOAD_PATH, y, m) };
}

/**
 * Re-encode an uploaded image (strips metadata such as GPS EXIF), store it at max 1600 px
 * plus a 400 px thumbnail, and return their public paths.
 * @returns {Promise<{ photoPath: string, thumbPath: string, buffer: Buffer }>} buffer = re-encoded full image
 */
export async function saveImage(input, { now } = {}) {
  if (!sniffImageType(input)) {
    throw ApiError.badRequest('Photo must be a JPEG or PNG image', undefined, 'INVALID_FILE');
  }
  let full;
  let thumb;
  try {
    const base = sharp(input, { failOn: 'error' }).rotate(); // apply EXIF orientation, then drop EXIF
    full = await base
      .clone()
      .resize(MAX_SIDE, MAX_SIDE, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
    thumb = await base
      .clone()
      .resize(THUMB_SIDE, THUMB_SIDE, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 76, mozjpeg: true })
      .toBuffer();
  } catch {
    throw ApiError.badRequest('Photo could not be read as an image', undefined, 'INVALID_FILE');
  }
  const dir = datedDir(now);
  await fs.mkdir(dir.abs, { recursive: true });
  const name = crypto.randomBytes(16).toString('hex');
  await Promise.all([
    fs.writeFile(path.join(dir.abs, `${name}.jpg`), full),
    fs.writeFile(path.join(dir.abs, `${name}_thumb.jpg`), thumb),
  ]);
  return {
    photoPath: `/uploads/${dir.rel}/${name}.jpg`,
    thumbPath: `/uploads/${dir.rel}/${name}_thumb.jpg`,
    buffer: full,
  };
}

/** Resolve a public `/uploads/...` path to an absolute file path (or null if outside the upload dir). */
export function absolutePathOf(publicPath) {
  if (!publicPath?.startsWith('/uploads/')) return null;
  const abs = path.resolve(env.UPLOAD_PATH, publicPath.slice('/uploads/'.length));
  return abs.startsWith(path.resolve(env.UPLOAD_PATH)) ? abs : null;
}

export async function readImage(publicPath) {
  const abs = absolutePathOf(publicPath);
  return abs ? fs.readFile(abs) : null;
}

export async function removeImages(...publicPaths) {
  await Promise.all(
    publicPaths.map(async (p) => {
      const abs = absolutePathOf(p);
      if (abs) await fs.rm(abs, { force: true });
    }),
  );
}
