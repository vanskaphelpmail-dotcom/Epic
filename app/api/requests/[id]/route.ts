import { errorResponse, ok, AppError } from '@/lib/errors';
import { requireUser } from '@/services/auth.service';
import { addRequestComment, getRequest, updateRequestStatus } from '@/services/request.service';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    return ok(await getRequest(user, id));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await req.json();
    if (body.comment && !body.status) {
      return ok(await addRequestComment({ actor: user, id, body: body.comment }));
    }
    if (!body.status) throw new AppError('VALIDATION_ERROR', 'Status or comment is required');
    return ok(await updateRequestStatus({
      actor: user,
      id,
      status: body.status,
      comment: body.comment,
      details: body.details,
      message: body.message
    }));
  } catch (error) {
    return errorResponse(error);
  }
}
