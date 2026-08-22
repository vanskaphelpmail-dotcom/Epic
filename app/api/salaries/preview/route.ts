import { AppError, errorResponse, ok } from '@/lib/errors';
import { requirePermission } from '@/services/auth.service';
import { previewSalary } from '@/services/salary.service';

export async function GET(req: Request) {
  try {
    const actor = await requirePermission('SALARY_VIEW');
    const params = new URL(req.url).searchParams;
    const userId = params.get('userId');
    if (!userId) throw new AppError('VALIDATION_ERROR', 'userId is required');

    const preview = await previewSalary({
      userId,
      storeId: actor.storeId,
      baseSalary: Number(params.get('baseSalary') || 0),
      periodType: params.get('periodType') === 'month' ? 'month' : 'week',
      periodAnchor: params.get('periodAnchor') || params.get('from') || null,
      expectedHours: params.get('expectedHours')
        ? Number(params.get('expectedHours'))
        : undefined
    });
    return ok(preview);
  } catch (error) {
    return errorResponse(error);
  }
}
