import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors';
import { ALL_PERMISSIONS, Permission } from '@/lib/permissions';
import { writeAudit } from '@/services/audit.service';
import { ensureAdminFromEnv, isInitialAdminLogin } from '@/services/bootstrap-admin';

const COOKIE_NAME = 'ps_session';
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function getSecret() {
  const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new AppError(
      'DATABASE_ERROR',
      'JWT_SECRET is not set on Vercel. Open Project → Settings → Environment Variables, add JWT_SECRET for Production, then Redeploy (env changes do not apply until a new deploy).',
      500
    );
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

function assertRateLimit(key: string) {
  const now = Date.now();
  const row = loginAttempts.get(key);
  if (!row || row.resetAt < now) {
    loginAttempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return;
  }
  row.count += 1;
  if (row.count > 8) {
    throw new AppError('INVALID_CREDENTIALS', 'Too many login attempts. Try again later.', 429);
  }
}

export async function login(input: {
  email?: string;
  employeeId?: string;
  identifier?: string;
  password: string;
  ip?: string;
  userAgent?: string;
}) {
  const identifier = (input.identifier || input.email || input.employeeId || '').trim();
  const key = `${input.ip || 'unknown'}:${identifier}`;
  assertRateLimit(key);

  if (!input.password || !identifier) {
    throw new AppError('VALIDATION_ERROR', 'Email/Employee ID and password are required');
  }

  const looksLikeEmail = identifier.includes('@');
  let user = await prisma.user.findFirst({
    where: looksLikeEmail
      ? { email: identifier.toLowerCase() }
      : {
          OR: [
            { employeeId: identifier },
            { employeeBarcode: identifier },
            { email: identifier.toLowerCase() }
          ]
        },
    include: { permissions: true, store: true }
  });

  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    if (isInitialAdminLogin(identifier, input.password)) {
      await ensureAdminFromEnv();
      const provisioned = await prisma.user.findFirst({
        where: looksLikeEmail
          ? { email: identifier.toLowerCase() }
          : {
              OR: [
                { employeeId: identifier },
                { employeeBarcode: identifier },
                { email: identifier.toLowerCase() },
                { employeeId: 'TO-ADMIN' }
              ]
            },
        include: { permissions: true, store: true }
      });
      if (provisioned?.isActive && (await verifyPassword(input.password, provisioned.passwordHash))) {
        user = provisioned;
      }
    }
  }

  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new AppError('INVALID_CREDENTIALS', 'Invalid email / employee ID or password', 401);
  }
  if (!user.isActive) {
    throw new AppError('FORBIDDEN', 'Account is deactivated', 403);
  }

  const token = await new SignJWT({
    sub: user.id,
    role: user.role,
    storeId: user.storeId
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_EXPIRES_IN || '7d')
    .sign(getSecret());

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), lastSeenAt: new Date() }
  });

  await writeAudit({
    userId: user.id,
    storeId: user.storeId,
    action: 'LOGIN',
    entity: 'User',
    entityId: user.id,
    ip: input.ip,
    userAgent: input.userAgent
  });

  loginAttempts.delete(key);
  return sanitizeUser(user);
}

export async function logout(userId?: string, storeId?: string | null) {
  const jar = await cookies();
  jar.set(COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 });
  if (userId) {
    await writeAudit({
      userId,
      storeId,
      action: 'LOGOUT',
      entity: 'User',
      entityId: userId
    });
  }
}

export async function getSessionUser() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const role = String(payload.role || '');
    const user = await prisma.user.findUnique({
      where: { id: String(payload.sub) },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        employeeId: true,
        employeeBarcode: true,
        role: true,
        isActive: true,
        avatar: true,
        storeId: true,
        lastLoginAt: true,
        store: {
          select: { id: true, name: true, code: true, address: true, phone: true, logoUrl: true }
        },
        ...(role === 'ADMIN' ? {} : { permissions: { select: { permission: true } } })
      }
    });
    if (!user || !user.isActive) return null;
    return sanitizeUser(user);
  } catch {
    return null;
  }
}

export function sanitizeUser(user: {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  employeeId: string | null;
  employeeBarcode: string | null;
  role: string;
  isActive: boolean;
  avatar: string | null;
  storeId: string | null;
  store?: unknown;
  permissions?: { permission: string }[];
  lastLoginAt?: Date | null;
}) {
  const permissions =
    user.role === 'ADMIN'
      ? ALL_PERMISSIONS
      : (user.permissions || []).map((p) => p.permission as Permission);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    employeeId: user.employeeId,
    employeeBarcode: user.employeeBarcode,
    role: user.role,
    isActive: user.isActive,
    avatar: user.avatar,
    storeId: user.storeId,
    store: user.store,
    permissions,
    lastLoginAt: user.lastLoginAt
  };
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new AppError('AUTH_REQUIRED', 'Authentication required', 401);
  return user;
}

export async function requirePermission(...needed: Permission[]) {
  const user = await requireUser();
  if (user.role === 'ADMIN') return user;
  const ok = needed.every((p) => user.permissions.includes(p));
  if (!ok) throw new AppError('FORBIDDEN', 'You do not have permission for this action', 403);
  return user;
}

export async function requireAnyPermission(...needed: Permission[]) {
  const user = await requireUser();
  if (user.role === 'ADMIN') return user;
  const ok = needed.some((p) => user.permissions.includes(p));
  if (!ok) throw new AppError('FORBIDDEN', 'You do not have permission for this action', 403);
  return user;
}
