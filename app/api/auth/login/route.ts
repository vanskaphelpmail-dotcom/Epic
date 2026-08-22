import { errorResponse, ok } from '@/lib/errors';
import { login } from '@/services/auth.service';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const user = await login({
      identifier: body.identifier || body.email || body.employeeId,
      email: body.email,
      employeeId: body.employeeId,
      password: body.password,
      ip: req.headers.get('x-forwarded-for') || undefined,
      userAgent: req.headers.get('user-agent') || undefined
    });
    return ok({ user });
  } catch (error) {
    return errorResponse(error);
  }
}
