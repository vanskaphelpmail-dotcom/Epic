import { createMocks } from "node-mocks-http";
import type { NextRequest } from "next/server";
import { createApp } from "@jab/server/app";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Fail before Vercel's 300s hard limit so clients get a real JSON error. */
export const maxDuration = 60;

const expressApp = createApp();

async function handle(request: NextRequest): Promise<Response> {
  const url = new URL(request.url);
  const raw = Buffer.from(await request.arrayBuffer());
  let body: unknown = undefined;
  if (raw.length > 0) {
    const text = raw.toString("utf8");
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const { req, res } = createMocks({
    method: (request.method || "GET") as
      | "GET"
      | "POST"
      | "PUT"
      | "PATCH"
      | "DELETE"
      | "OPTIONS"
      | "HEAD",
    url: `${url.pathname}${url.search}`,
    headers,
    body,
  });

  return new Promise<Response>((resolve) => {
    let settled = false;

    const settle = (response: Response) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(response);
    };

    const timer = setTimeout(() => {
      console.error(`[app/api] timeout ${request.method} ${url.pathname}`);
      settle(
        Response.json(
          { success: false, error: { message: "API timeout" } },
          { status: 504 },
        ),
      );
    }, url.pathname.includes("/uploads/") ? 55_000 : 45_000);

    const finish = () => {
      const status = res._getStatusCode();
      const data = res._getData();
      const outHeaders = new Headers();
      const mockHeaders = res._getHeaders();
      Object.entries(mockHeaders).forEach(([key, value]) => {
        if (value == null) return;
        if (Array.isArray(value)) value.forEach((v) => outHeaders.append(key, String(v)));
        else outHeaders.set(key, String(value));
      });

      const payload =
        typeof data === "string" || Buffer.isBuffer(data)
          ? data
          : data == null
            ? ""
            : JSON.stringify(data);

      settle(new Response(payload, { status, headers: outHeaders }));
    };

    // node-mocks-http does not always emit finish/end the way Express expects
    const originalEnd = res.end.bind(res);
    (res as { end: (...args: unknown[]) => unknown }).end = (...args: unknown[]) => {
      const result = originalEnd(...args);
      finish();
      return result;
    };

    res.on("finish", finish);
    res.on("end", finish);

    try {
      expressApp(req as never, res as never, ((err?: unknown) => {
        if (!err) return;
        const message = err instanceof Error ? err.message : "API error";
        console.error("[app/api]", err);
        if (!res.headersSent && !settled) {
          res.status(500).json({ success: false, error: { message } });
        } else if (!settled) {
          settle(
            Response.json({ success: false, error: { message } }, { status: 500 }),
          );
        }
      }) as never);
    } catch (error) {
      console.error("[app/api]", error);
      settle(
        Response.json(
          {
            success: false,
            error: {
              message: error instanceof Error ? error.message : "API error",
            },
          },
          { status: 500 },
        ),
      );
    }
  });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
