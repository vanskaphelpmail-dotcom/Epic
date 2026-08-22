export class AppError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(code: string, message: string, status = 400, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const NEON_SETUP_MESSAGE =
  'Neon is not connected. In Vercel → Settings → Environment Variables, edit the existing DATABASE_URL (do not add a second one) and paste your Neon postgresql:// URL. Also set DIRECT_URL and CLOUDINARY_URL, then Redeploy.';

export function errorResponse(error: unknown) {
  if (error instanceof AppError) {
    return Response.json(
      { success: false, error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status }
    );
  }

  if (error instanceof SyntaxError) {
    return Response.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid request body' } },
      { status: 400 }
    );
  }

  const message = error instanceof Error ? error.message : String(error);
  console.error(error);

  if (/ByteString|WinAnsi|WinAnsiEncoding/i.test(message)) {
    return Response.json(
      { success: false, error: { code: 'REPORT_ERROR', message: 'Unable to load this report. Please try again.' } },
      { status: 500 }
    );
  }

  if (
    /Neon is not connected|must be a Neon PostgreSQL|Legacy MongoDB|Environment variable not found: DATABASE_URL|DATABASE_URL is missing|must start with mongodb|must start with postgres/i.test(
      message
    )
  ) {
    return Response.json(
      {
        success: false,
        error: {
          code: 'DATABASE_CONFIG',
          message: NEON_SETUP_MESSAGE
        }
      },
      { status: 503 }
    );
  }

  if (/Transaction not found|Transaction API error|P2028|unable to start a transaction|Transaction already closed/i.test(message)) {
    return Response.json(
      {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'The till lost the database connection. Tap Paid again to complete the sale.'
        }
      },
      { status: 503 }
    );
  }

  if ((error as { code?: string })?.code === 'P2002' || /Unique constraint failed/i.test(message)) {
    return Response.json(
      {
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'This record already exists. Refresh and try again.'
        }
      },
      { status: 409 }
    );
  }

  if (/Can't reach database|PrismaClientInitializationError|ECONNREFUSED|P1001|P1017/i.test(message)) {
    return Response.json(
      {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Cannot reach Neon. Check DATABASE_URL / DIRECT_URL in Vercel, then Redeploy.'
        }
      },
      { status: 503 }
    );
  }

  return Response.json(
    { success: false, error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' } },
    { status: 500 }
  );
}

export function ok<T>(data: T, init?: ResponseInit) {
  return Response.json({ success: true, data }, init);
}
