import { AppError } from '@/lib/errors';

export function assertSameStore(
  user: { role?: string | null; storeId?: string | null },
  recordStoreId?: string | null,
  notFoundMessage = 'Not found'
) {
  if (!recordStoreId) return;
  if (user.role === 'ADMIN' && !user.storeId) return;
  if (user.storeId && user.storeId !== recordStoreId) {
    throw new AppError('NOT_FOUND', notFoundMessage, 404);
  }
}
