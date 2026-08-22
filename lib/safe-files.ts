import path from 'path';
import { AppError } from '@/lib/errors';

const UPLOADS_ROOT = path.resolve(process.cwd(), 'public', 'uploads');

export function assertNoPathTraversal(relativePath: string) {
  const parts = String(relativePath || '').split(/[/\\]/);
  if (parts.some((part) => part === '..')) {
    throw new AppError('INVALID_FILE', 'Invalid file path', 400);
  }
}

export function resolvePublicUploadPath(localPath: string) {
  const rel = String(localPath || '')
    .replace(/^\/+/, '')
    .replace(/^public[/\\]/, '');
  assertNoPathTraversal(rel);
  const full = path.resolve(process.cwd(), 'public', rel);
  const uploads = path.resolve(UPLOADS_ROOT);
  if (full !== uploads && !full.startsWith(uploads + path.sep)) {
    throw new AppError('NOT_FOUND', 'File is not available', 404);
  }
  return full;
}

export function isAllowedPdfRemoteUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    return parsed.hostname === 'res.cloudinary.com' || parsed.hostname.endsWith('.cloudinary.com');
  } catch {
    return false;
  }
}
