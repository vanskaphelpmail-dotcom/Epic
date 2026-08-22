import { AppError, errorResponse, ok } from '@/lib/errors';
import { requireAnyPermission, requirePermission } from '@/services/auth.service';
import { getAccountSummary, listAccountEntries } from '@/services/ops.service';
import { getMoneyWorkspace, postMoneyEntry } from '@/services/money.service';
import { resolvePeriod } from '@/lib/date-range';

export async function GET(req: Request) {
  try {
    const user = await requireAnyPermission('EXPENSE_VIEW', 'REPORT_VIEW', 'CASH_RECONCILIATION');
    const search = new URL(req.url).searchParams;
    const range = resolvePeriod(search.get('period'), search.get('from'), search.get('to'));
    try {
      const workspace = await getMoneyWorkspace(user.storeId || '', {
        periodFrom: range.from,
        periodTo: range.to,
        accountId: search.get('accountId') || undefined,
        typeKey: search.get('typeKey') || undefined,
        person: search.get('person') || undefined,
        method: search.get('method') || undefined
      });
      const summary = await getAccountSummary(user.storeId || undefined);
      return ok({
        summary: { ...summary, ...workspace.summary },
        entries: workspace.entries,
        accounts: workspace.accounts,
        cycle: workspace.cycle,
        dailySummary: workspace.dailySummary
      });
    } catch {
      const [summary, entries] = await Promise.all([
        getAccountSummary(user.storeId || undefined),
        listAccountEntries(user.storeId || undefined)
      ]);
      return ok({ summary, entries, accounts: [], cycle: null, dailySummary: null });
    }
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requirePermission('CASH_RECONCILIATION');
    if (!user.storeId) throw new AppError('VALIDATION_ERROR', 'Store is required');
    const body = await req.json();
    const entry = await postMoneyEntry({
      storeId: user.storeId,
      userId: user.id,
      typeKey: body.typeKey || body.type || 'CASH_IN',
      amount: Number(body.amount),
      accountId: body.accountId,
      fromAccountId: body.fromAccountId,
      toAccountId: body.toAccountId,
      method: body.method,
      personName: body.personName,
      personPhone: body.personPhone,
      reason: body.reason,
      reference: body.reference,
      notes: body.notes,
      occurredAt: body.occurredAt,
      direction: body.direction
    });
    return ok(entry, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
