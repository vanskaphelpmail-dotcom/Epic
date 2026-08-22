import { errorResponse, ok } from '@/lib/errors';
import { getSessionUser, logout } from '@/services/auth.service';

export async function POST() {
  try {
    const user = await getSessionUser();
    await logout(user?.id, user?.storeId);
    return ok({ message: 'Logged out' });
  } catch (error) {
    return errorResponse(error);
  }
}
