import { errorResponse, ok } from '@/lib/errors';
import { requireAnyPermission } from '@/services/auth.service';
import { listAdminPresence, listAudit } from '@/services/ops.service';
import { writeAudit } from '@/services/audit.service';

export async function GET() {
  try {
    const user = await requireAnyPermission('AUDIT_LOG_VIEW', 'PERMISSION_MANAGE', 'DASHBOARD_VIEW');
    const [logs, admins] = await Promise.all([
      listAudit(user.storeId || undefined),
      listAdminPresence(user.storeId || undefined)
    ]);
    await writeAudit({
      userId: user.id,
      storeId: user.storeId,
      action: 'AUDIT_VIEW',
      entity: 'AuditLog'
    });
    return ok({ logs, admins });
  } catch (error) {
    return errorResponse(error);
  }
}
