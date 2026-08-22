import { DocumentRequestType, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors';
import { writeAudit } from '@/services/audit.service';
import { notifyAdmins } from '@/services/notify.service';
import { requestTypeLabel } from '@/lib/request-types';

const TYPES = new Set(Object.values(DocumentRequestType));

export async function notifyUser(input: {
  userId: string;
  storeId?: string | null;
  title: string;
  message: string;
  type: string;
}) {
  try {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        storeId: input.storeId || null,
        title: input.title,
        message: input.message,
        type: input.type
      }
    });
  } catch {
    /* optional */
  }
}

export function canManageDocumentRequests(user: { role: string; permissions?: string[] }) {
  if (user.role === 'ADMIN') return true;
  return (user.permissions || []).some((permission) => ['DOCUMENT_VIEW', 'SALARY_VIEW'].includes(permission));
}

function canManage(user: { role: string; permissions?: string[] }) {
  return canManageDocumentRequests(user);
}

function canSeePayslip(actor: { id: string; role: string; permissions?: string[] }, row: { employeeId: string }) {
  return row.employeeId === actor.id || canManage(actor);
}

async function nextCode(storeId: string) {
  const year = new Date().getFullYear();
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { code: true } });
  const storePart = String(store?.code || storeId)
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, 12)
    .toUpperCase() || 'STORE';
  const prefix = `REQ-${storePart}-${year}-`;
  const rows = await prisma.$queryRaw<Array<{ requestCode: string }>>`
    SELECT "requestCode"
    FROM "EmployeeDocumentRequest"
    WHERE "storeId" = ${storeId}
      AND "requestCode" LIKE ${`${prefix}%`}
    ORDER BY "requestCode" DESC
    LIMIT 1
  `;
  const last = rows[0]?.requestCode || '';
  const n = last ? Number(last.slice(prefix.length)) + 1 : 1;
  const seq = Number.isFinite(n) && n > 0 ? n : 1;
  return `${prefix}${String(seq).padStart(5, '0')}`;
}

async function notifyRequestAdmins(input: {
  storeId: string;
  title: string;
  message: string;
  excludeUserId?: string;
}) {
  const admins = await prisma.user.findMany({
    where: {
      isActive: true,
      role: 'ADMIN',
      OR: [{ storeId: input.storeId }, { storeId: null }]
    },
    select: { id: true }
  });
  const payroll = await prisma.user.findMany({
    where: {
      isActive: true,
      storeId: input.storeId,
      permissions: { some: { permission: 'SALARY_VIEW' } }
    },
    select: { id: true }
  });
  const ids = [...new Set([...admins, ...payroll].map((u) => u.id))].filter((id) => id !== input.excludeUserId);
  if (!ids.length) {
    await notifyAdmins({
      storeId: input.storeId,
      title: input.title,
      message: input.message,
      type: 'REQUEST'
    });
    return;
  }
  await prisma.notification.createMany({
    data: ids.map((userId) => ({
      storeId: input.storeId,
      userId,
      title: input.title,
      message: input.message,
      type: 'REQUEST'
    }))
  });
}

async function insertRequestSql(data: {
  requestCode: string;
  storeId: string;
  employeeId: string;
  type: DocumentRequestType;
  reason: string | null;
  message: string | null;
  requiredDate: Date | null;
  periodMonth: number | null;
  periodYear: number | null;
  details?: Record<string, unknown>;
  notes: string | null;
}) {
  const id = `c${Date.now()}${randomBytes(4).toString('hex')}`;
  const detailsJson = JSON.stringify(data.details || {});
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    INSERT INTO "EmployeeDocumentRequest" (
      "id", "requestCode", "storeId", "employeeId", "type", "status",
      "reason", "message", "requiredDate", "periodMonth", "periodYear",
      "details", "notes", "createdAt", "updatedAt"
    ) VALUES (
      ${id},
      ${data.requestCode},
      ${data.storeId},
      ${data.employeeId},
      CAST(${data.type} AS "DocumentRequestType"),
      ${'SUBMITTED'},
      ${data.reason},
      ${data.message},
      ${data.requiredDate},
      ${data.periodMonth},
      ${data.periodYear},
      CAST(${detailsJson} AS jsonb),
      ${data.notes},
      NOW(),
      NOW()
    )
    RETURNING *
  `;
  const row = rows[0];
  if (!row) throw new AppError('DATABASE_ERROR', 'Could not create request');
  return hydrateRequest(row);
}

async function hydrateRequest(row: Record<string, unknown>): Promise<any> {
  const employeeId = String((row as any).employeeId || '');
  const employee = employeeId
    ? await prisma.user.findUnique({
        where: { id: employeeId },
        select: { id: true, name: true, email: true, employeeId: true, role: true }
      })
    : null;
  return {
    ...row,
    employee,
    comments: [],
    events: []
  };
}

function parseIsoDate(value: unknown): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function filingPeriod(row: {
  type: string;
  periodMonth?: number | null;
  periodYear?: number | null;
  requiredDate?: Date | string | null;
  details?: unknown;
}) {
  const details = (row.details && typeof row.details === 'object' ? row.details : {}) as Record<string, unknown>;
  if (row.type === 'PAYSLIP' || row.type === 'SALARY_CERTIFICATE') {
    if (row.periodYear && row.periodMonth) {
      return { year: row.periodYear, month: row.periodMonth };
    }
  }
  const fromDetails =
    parseIsoDate(details.holidayStart) ||
    parseIsoDate(details.joiningDate) ||
    parseIsoDate(details.requiredDate) ||
    parseIsoDate(row.requiredDate);
  if (fromDetails) {
    return { year: fromDetails.getFullYear(), month: fromDetails.getMonth() + 1 };
  }
  if (row.periodYear && row.periodMonth) {
    return { year: row.periodYear, month: row.periodMonth };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

async function addEvent(input: {
  requestId: string;
  userId: string;
  action: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  comment?: string | null;
}) {
  const id = `e${Date.now()}${randomBytes(3).toString('hex')}`;
  try {
    await prisma.$executeRaw`
      INSERT INTO "EmployeeRequestEvent" ("id", "requestId", "userId", "action", "fromStatus", "toStatus", "comment", "createdAt")
      VALUES (${id}, ${input.requestId}, ${input.userId}, ${input.action}, ${input.fromStatus || null}, ${input.toStatus || null}, ${input.comment || null}, NOW())
    `;
  } catch {
    /* events table optional on stale servers */
  }
}

const includeAll = {
  employee: { select: { id: true, name: true, email: true, employeeId: true, role: true } },
  comments: { include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: 'asc' as const } },
  events: { include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: 'asc' as const } }
};

export async function listRequests(actor: { id: string; role: string; storeId?: string | null; permissions?: string[] }): Promise<any[]> {
  const storeId = actor.storeId || null;
  const manager = canManage(actor);
  const rows = manager
    ? await prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT r.*,
               u.id AS "emp_id",
               u.name AS "emp_name",
               u.email AS "emp_email",
               u."employeeId" AS "emp_code",
               u.role AS "emp_role"
        FROM "EmployeeDocumentRequest" r
        INNER JOIN "User" u ON u.id = r."employeeId"
        WHERE (${storeId}::text IS NULL OR r."storeId" = ${storeId})
        ORDER BY r."createdAt" DESC
        LIMIT 300
      `
    : await prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT r.*,
               u.id AS "emp_id",
               u.name AS "emp_name",
               u.email AS "emp_email",
               u."employeeId" AS "emp_code",
               u.role AS "emp_role"
        FROM "EmployeeDocumentRequest" r
        INNER JOIN "User" u ON u.id = r."employeeId"
        WHERE r."employeeId" = ${actor.id}
          AND (${storeId}::text IS NULL OR r."storeId" = ${storeId})
        ORDER BY r."createdAt" DESC
        LIMIT 300
      `;
  const now = new Date();
  return rows.map((row) => ({
    ...row,
    employee: {
      id: row.emp_id,
      name: row.emp_name,
      email: row.emp_email,
      employeeId: row.emp_code,
      role: row.emp_role
    },
    comments: [],
    events: [],
    overdue: Boolean(
      row.requiredDate &&
        new Date(String(row.requiredDate)) < now &&
        !['READY', 'COMPLETED', 'REJECTED', 'CANCELLED'].includes(String(row.status))
    )
  }));
}

export async function getRequest(actor: { id: string; role: string; storeId?: string | null; permissions?: string[] }, id: string): Promise<any> {
  const key = String(id || '').trim();
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT * FROM "EmployeeDocumentRequest"
    WHERE id = ${key} OR "requestCode" = ${key}
    LIMIT 1
  `;
  const row = rows[0] ? await hydrateRequest(rows[0]) : null;
  if (!row) throw new AppError('NOT_FOUND', 'Request not found', 404);
  if (actor.storeId && row.storeId && String(row.storeId) !== actor.storeId) {
    throw new AppError('NOT_FOUND', 'Request not found', 404);
  }
  if (!canManage(actor) && row.employeeId !== actor.id) {
    throw new AppError('FORBIDDEN', 'You can only view your own requests', 403);
  }
  if (row.type === 'PAYSLIP' && !canSeePayslip(actor, row)) {
    throw new AppError('FORBIDDEN', 'Payslip access is restricted', 403);
  }
  try {
    const comments = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT c.id, c.body, c."createdAt", u.name AS "userName", u.id AS "userId"
      FROM "EmployeeRequestComment" c
      INNER JOIN "User" u ON u.id = c."userId"
      WHERE c."requestId" = ${row.id}
      ORDER BY c."createdAt" ASC
    `;
    const events = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT e.id, e.action, e."fromStatus", e."toStatus", e.comment, e."createdAt", u.name AS "userName"
      FROM "EmployeeRequestEvent" e
      INNER JOIN "User" u ON u.id = e."userId"
      WHERE e."requestId" = ${row.id}
      ORDER BY e."createdAt" ASC
    `;
    return {
      ...row,
      comments: comments.map((c) => ({ ...c, user: { id: c.userId, name: c.userName } })),
      events: events.map((e) => ({ ...e, user: { name: e.userName } }))
    };
  } catch {
    return row;
  }
}

export async function createRequest(input: {
  actor: { id: string; name: string; role: string; storeId?: string | null };
  type: string;
  reason?: string;
  message?: string;
  requiredDate?: string;
  periodMonth?: number;
  periodYear?: number;
  details?: Record<string, unknown>;
}): Promise<any> {
  if (!input.actor.storeId) throw new AppError('VALIDATION_ERROR', 'Store is required');
  const type = String(input.type || '').toUpperCase();
  if (!TYPES.has(type as DocumentRequestType)) throw new AppError('VALIDATION_ERROR', 'Select a document type');
  const salaryPeriod = type === 'PAYSLIP' || type === 'SALARY_CERTIFICATE';
  const derived = filingPeriod({
    type,
    periodMonth: salaryPeriod ? input.periodMonth : null,
    periodYear: salaryPeriod ? input.periodYear : null,
    requiredDate: input.requiredDate || null,
    details: input.details
  });
  let row;
  let requestCode = await nextCode(input.actor.storeId);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      row = await insertRequestSql({
        requestCode,
        storeId: input.actor.storeId,
        employeeId: input.actor.id,
        type: type as DocumentRequestType,
        reason: input.reason || null,
        message: input.message || null,
        requiredDate: input.requiredDate ? new Date(input.requiredDate) : null,
        periodMonth: salaryPeriod ? input.periodMonth || derived.month : derived.month,
        periodYear: salaryPeriod ? input.periodYear || derived.year : derived.year,
        details: input.details,
        notes: input.message || input.reason || null
      });
      break;
    } catch (error) {
      const code = (error as { code?: string })?.code;
      const text = error instanceof Error ? error.message : String(error);
      if (code === 'P2002' || /unique/i.test(text)) {
        requestCode = await nextCode(input.actor.storeId);
        continue;
      }
      throw error;
    }
  }
  if (!row) throw new AppError('DATABASE_ERROR', 'Could not create request');
  await addEvent({ requestId: row.id, userId: input.actor.id, action: 'SUBMITTED', toStatus: 'SUBMITTED', comment: input.message }).catch(() => undefined);
  await writeAudit({
    userId: input.actor.id,
    storeId: input.actor.storeId,
    action: 'REQUEST_CREATE',
    entity: 'EmployeeDocumentRequest',
    entityId: row.id,
    newData: { requestCode, type }
  });
  await notifyRequestAdmins({
    storeId: input.actor.storeId,
    title: `New document request from ${input.actor.name}`,
    message: `${requestCode} · ${requestTypeLabel(type)}`,
    excludeUserId: input.actor.id
  }).catch(() =>
    notifyAdmins({
      storeId: input.actor.storeId,
      title: `New document request from ${input.actor.name}`,
      message: `${requestCode} · ${requestTypeLabel(type)}`,
      type: 'REQUEST'
    })
  );
  await notifyUser({
    userId: input.actor.id,
    storeId: input.actor.storeId,
    title: 'Request submitted',
    message: `${requestCode} has been submitted.`,
    type: 'REQUEST'
  });
  return row;
}

export async function updateRequestStatus(input: {
  actor: { id: string; name: string; role: string; storeId?: string | null; permissions?: string[] };
  id: string;
  status: string;
  comment?: string;
  details?: Record<string, unknown>;
  message?: string;
}): Promise<any> {
  const existing = await getRequest(input.actor, input.id);
  const next = String(input.status || '').toUpperCase();
  if (next === 'CANCELLED') {
    if (existing.employeeId !== input.actor.id && !canManage(input.actor)) {
      throw new AppError('FORBIDDEN', 'You cannot cancel this request', 403);
    }
    if (!['SUBMITTED', 'NEED_INFORMATION', 'UNDER_REVIEW'].includes(existing.status)) {
      throw new AppError('VALIDATION_ERROR', 'Only pending requests can be cancelled');
    }
  } else if (!canManage(input.actor)) {
    if (next === 'SUBMITTED' && existing.status === 'NEED_INFORMATION' && existing.employeeId === input.actor.id) {
      /* resubmit */
    } else {
      throw new AppError('FORBIDDEN', 'Only admin can change this status', 403);
    }
  }
  const row = await prisma.employeeDocumentRequest.update({
    where: { id: existing.id },
    data: {
      status: next,
      adminComment: canManage(input.actor) ? input.comment || existing.adminComment : existing.adminComment,
      ...(input.message ? { message: input.message } : {}),
      ...(input.details ? { details: input.details as Prisma.InputJsonValue } : {})
    } as any,
    include: includeAll
  });
  await addEvent({
    requestId: row.id,
    userId: input.actor.id,
    action: next,
    fromStatus: existing.status,
    toStatus: next,
    comment: input.comment
  });
  if (input.comment) {
    await prisma.employeeRequestComment.create({
      data: { requestId: row.id, userId: input.actor.id, body: input.comment }
    });
  }
  const employeeNote =
    next === 'NEED_INFORMATION'
      ? input.comment || 'Admin needs more information.'
      : next === 'READY'
        ? 'Your document is ready to download.'
        : `Request ${row.requestCode} is now ${next.replace(/_/g, ' ')}.`;
  await notifyUser({
    userId: row.employeeId,
    storeId: row.storeId,
    title: `Request ${next.replace(/_/g, ' ')}`,
    message: employeeNote,
    type: 'REQUEST'
  });
  return row;
}

export async function addRequestComment(input: {
  actor: { id: string; name: string; role: string; storeId?: string | null };
  id: string;
  body: string;
}): Promise<any> {
  const existing = await getRequest(input.actor, input.id);
  const body = String(input.body || '').trim();
  if (!body) throw new AppError('VALIDATION_ERROR', 'Enter a comment');
  const comment = await prisma.employeeRequestComment.create({
    data: { requestId: existing.id, userId: input.actor.id, body },
    include: { user: { select: { id: true, name: true } } }
  });
  await addEvent({ requestId: existing.id, userId: input.actor.id, action: 'COMMENT', comment: body });
  if (canManage(input.actor)) {
    await notifyUser({
      userId: existing.employeeId,
      storeId: existing.storeId,
      title: 'Admin replied to your request',
      message: `${existing.requestCode}: ${body}`,
      type: 'REQUEST'
    });
  } else {
    await notifyAdmins({
      storeId: existing.storeId,
      title: `${input.actor.name} replied on ${existing.requestCode}`,
      message: body,
      type: 'REQUEST'
    });
  }
  return comment;
}

export async function attachRequestFile(input: {
  actor: { id: string; name: string; role: string; storeId?: string | null; permissions?: string[] };
  id: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  documentId?: string;
}): Promise<any> {
  if (!canManage(input.actor)) throw new AppError('FORBIDDEN', 'Only admin can upload the official document', 403);
  const existing = await getRequest(input.actor, input.id);
  const row = await prisma.employeeDocumentRequest.update({
    where: { id: existing.id },
    data: {
      fileUrl: input.fileUrl,
      fileName: input.fileName,
      fileSize: input.fileSize,
      documentId: input.documentId || null,
      status: 'READY'
    },
    include: includeAll
  });
  await addEvent({
    requestId: row.id,
    userId: input.actor.id,
    action: 'UPLOAD',
    fromStatus: existing.status,
    toStatus: 'READY',
    comment: input.fileName
  });
  await notifyUser({
    userId: row.employeeId,
    storeId: row.storeId,
    title: 'Document ready',
    message: `${row.requestCode} is ready to download.`,
    type: 'REQUEST'
  });
  return row;
}

export async function getDownloadableRequest(actor: { id: string; role: string; storeId?: string | null; permissions?: string[] }, id: string): Promise<any> {
  const existing = await getRequest(actor, id);
  if (!existing.fileUrl) throw new AppError('VALIDATION_ERROR', 'No document is ready yet');
  if (existing.type === 'PAYSLIP' && !canSeePayslip(actor, existing)) {
    throw new AppError('FORBIDDEN', 'Payslip access is restricted', 403);
  }
  return existing;
}

export async function markDownloaded(actor: { id: string; role: string }, existing: { id: string; status: string }): Promise<void> {
  await prisma.employeeDocumentRequest.update({
    where: { id: existing.id },
    data: { downloadedAt: new Date(), status: existing.status === 'READY' ? 'COMPLETED' : existing.status }
  });
  await addEvent({
    requestId: existing.id,
    userId: actor.id,
    action: 'DOWNLOADED',
    fromStatus: existing.status,
    toStatus: existing.status === 'READY' ? 'COMPLETED' : existing.status
  });
}
