import { AppError, errorResponse, ok } from '@/lib/errors';
import { getSessionUser } from '@/services/auth.service';
import { getDashboardSummary } from '@/services/dashboard.service';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) throw new AppError('AUTH_REQUIRED', 'Authentication required', 401);
    const dashboard = await getDashboardSummary(user);
    return ok({ user, dashboard });
  } catch (error) {
    return errorResponse(error);
  }
}
