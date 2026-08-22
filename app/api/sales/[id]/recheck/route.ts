import { AppError, errorResponse, ok } from '@/lib/errors';
import { requireUser } from '@/services/auth.service';
import { recheckSale } from '@/services/sales.service';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    if (user.role !== 'ADMIN') throw new AppError('FORBIDDEN', 'Only admin can recheck sales', 403);
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    return ok(await recheckSale(id, user.id, body.notes));
  } catch (error) {
    return errorResponse(error);
  }
}
