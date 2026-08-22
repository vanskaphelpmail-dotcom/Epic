import { AppError, errorResponse, ok } from '@/lib/errors';
import { getSessionUser } from '@/services/auth.service';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) throw new AppError('AUTH_REQUIRED', 'Authentication required', 401);
    return ok({ user });
  } catch (error) {
    return errorResponse(error);
  }
}
