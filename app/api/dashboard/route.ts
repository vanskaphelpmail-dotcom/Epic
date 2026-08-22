import { errorResponse, ok } from '@/lib/errors';
import { requireAnyPermission } from '@/services/auth.service';
import { getDashboardSummary } from '@/services/dashboard.service';

export async function GET() {
  try {
    const user = await requireAnyPermission('DASHBOARD_VIEW', 'POS_ACCESS');
    const data = await getDashboardSummary(user);
    return ok(data);
  } catch (error) {
    return errorResponse(error);
  }
}
