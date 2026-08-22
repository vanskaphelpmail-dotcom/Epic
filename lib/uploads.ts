import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { v2 as cloudinary } from 'cloudinary';
import { AppError } from '@/lib/errors';
import { assertNoPathTraversal, isAllowedPdfRemoteUrl, resolvePublicUploadPath } from '@/lib/safe-files';

export const MAX_IMAGE_BYTES = 500 * 1024; // 500KB
const ALLOWED = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

function cloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_URL ||
      (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
  );
}

function configureCloudinary() {
  if (process.env.CLOUDINARY_URL) {
    cloudinary.config({ secure: true });
    return;
  }
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
}

async function uploadToCloudinary(buffer: Buffer, filename: string) {
  configureCloudinary();
  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'the-ouds/products',
        public_id: filename.replace(/\.[^.]+$/, ''),
        resource_type: 'image',
        overwrite: false
      },
      (error, result) => {
        if (error || !result?.secure_url) {
          reject(error || new Error('Cloudinary upload failed'));
          return;
        }
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

export async function saveOptionalProductImage(file?: File | null) {
  if (!file || file.size === 0) return undefined;
  if (!ALLOWED.has(file.type)) {
    throw new AppError('INVALID_FILE', 'Only JPG, PNG, or WEBP images are allowed');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new AppError('INVALID_FILE', 'Image must be 500KB or smaller');
  }

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const filename = `${Date.now()}-${randomBytes(4).toString('hex')}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  if (cloudinaryConfigured()) {
    return uploadToCloudinary(buffer, filename);
  }

  if (process.env.VERCEL) {
    throw new AppError(
      'UPLOAD_CONFIG',
      'Set CLOUDINARY_URL in Vercel so product photos can be saved.'
    );
  }

  const dir = path.join(process.cwd(), 'public', 'uploads', 'products');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), buffer);
  return `/uploads/products/${filename}`;
}

async function readValidPdf(file: File) {
  if (!file || file.size === 0) {
    throw new AppError('INVALID_FILE', 'Choose a PDF to save in this directory');
  }
  const nameOk = file.name.toLowerCase().endsWith('.pdf');
  const mimeOk = !file.type || file.type === 'application/pdf' || file.type === 'application/octet-stream';
  if (!nameOk || !mimeOk) {
    throw new AppError('INVALID_FILE', 'Only PDF files are allowed. Images, Word, ZIP and other files are rejected.');
  }
  if (file.size > 500 * 1024) {
    throw new AppError('INVALID_FILE', 'PDF must be 500KB or smaller (recommended 100–500 KB)');
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.subarray(0, 4).toString('utf8') !== '%PDF') {
    throw new AppError('INVALID_FILE', 'File is not a valid PDF');
  }
  return buffer;
}

async function uploadPdfToCloudinary(buffer: Buffer, relativePath: string) {
  configureCloudinary();
  const safe = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  const folder = `the-ouds/documents/${path.posix.dirname(safe)}`.replace(/\/\.$/, '');
  const publicId = path.posix.basename(safe).replace(/\.pdf$/i, '');
  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: 'raw',
        format: 'pdf',
        overwrite: true
      },
      (error, result) => {
        if (error || !result?.secure_url) {
          reject(error || new Error('Cloudinary PDF upload failed'));
          return;
        }
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

async function persistPdf(buffer: Buffer, relativePath: string) {
  const safe = relativePath.replace(/[^A-Za-z0-9._/-]/g, '-');
  assertNoPathTraversal(safe);
  if (cloudinaryConfigured()) {
    return uploadPdfToCloudinary(buffer, safe);
  }
  if (process.env.VERCEL) {
    throw new AppError('UPLOAD_CONFIG', 'Set CLOUDINARY_URL in Vercel so PDFs can be saved.');
  }
  const dir = path.join(process.cwd(), 'public', 'uploads', 'documents', path.dirname(safe));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(process.cwd(), 'public', 'uploads', 'documents', safe), buffer);
  return `/uploads/documents/${safe}`;
}

export async function saveDocumentPdf(file: File, directory: string, year: number, month: number, preferredName?: string) {
  const buffer = await readValidPdf(file);
  const safeDir = String(directory || 'OTHERS').replace(/[^A-Z0-9_-]/gi, '');
  const folder = `${year}-${String(month).padStart(2, '0')}`;
  const filename = (preferredName || `${Date.now()}-${randomBytes(4).toString('hex')}.pdf`).replace(/[^\w.-]/g, '-');
  return persistPdf(buffer, `${safeDir}/${folder}/${filename}`);
}

export async function saveEmployeeRequestPdf(file: File, relativeName: string) {
  const buffer = await readValidPdf(file);
  return persistPdf(buffer, relativeName);
}

export async function readStoredPdf(fileUrl: string) {
  const url = String(fileUrl || '').trim();
  if (!url) throw new AppError('NOT_FOUND', 'File is not available', 404);
  if (/^https?:\/\//i.test(url)) {
    if (!isAllowedPdfRemoteUrl(url)) {
      throw new AppError('NOT_FOUND', 'File is not available', 404);
    }
    const remote = await fetch(url);
    if (!remote.ok) throw new AppError('NOT_FOUND', 'File is not available', 404);
    return Buffer.from(await remote.arrayBuffer());
  }
  const full = resolvePublicUploadPath(url);
  if (!fs.existsSync(full)) throw new AppError('NOT_FOUND', 'File is not available', 404);
  return fs.readFileSync(full);
}
