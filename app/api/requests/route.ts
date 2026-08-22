import { errorResponse, ok } from '@/lib/errors';
import { requireUser } from '@/services/auth.service';
import { createRequest, listRequests } from '@/services/request.service';

export async function GET() {
  try {
    const user = await requireUser();
    return ok(await listRequests(user));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const row = await createRequest({
      actor: user,
      type: body.type,
      reason: body.reason,
      message: body.message,
      requiredDate: body.requiredDate,
      periodMonth: body.periodMonth != null ? Number(body.periodMonth) : undefined,
      periodYear: body.periodYear != null ? Number(body.periodYear) : undefined,
      details: body.details || {}
    });
    return ok(row, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
