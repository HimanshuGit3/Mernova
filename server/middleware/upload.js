import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';
import { sniffImageType } from '../services/storage.js';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/jpg'];

const multerSingle = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 30, fieldSize: 8 * 1024 },
  fileFilter(_req, file, cb) {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      return cb(
        ApiError.badRequest('Photo must be a JPEG or PNG image', undefined, 'INVALID_FILE'),
      );
    }
    cb(null, true);
  },
}).single('photo');

/**
 * Optional single `photo` field (NFR-06): JPEG/PNG only, max 5 MB, kept in memory.
 * The declared MIME type is checked by multer, the real content by magic bytes here;
 * sharp re-encodes it later in the storage service.
 */
export function photoUpload(req, res, next) {
  multerSingle(req, res, (err) => {
    if (err) return next(err);
    if (req.file && !sniffImageType(req.file.buffer)) {
      return next(
        ApiError.badRequest('Photo must be a JPEG or PNG image', undefined, 'INVALID_FILE'),
      );
    }
    next();
  });
}
