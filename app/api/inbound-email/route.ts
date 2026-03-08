import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const url = new URL(req.url);

  const headerSecret = req.headers.get("x-inbound-secret");
  const querySecret = url.searchParams.get("secret");

  const expectedSecret = process.env.INBOUND_EMAIL_WEBHOOK_SECRET;

  if (headerSecret !== expectedSecret && querySecret !== expectedSecret) {
    console.error("Inbound email rejected: invalid secret", {
      headerSecret,
      querySecret,
    });

    return new NextResponse("Unauthorized", { status: 401 });
  }

  const contentType = req.headers.get("content-type") ?? "";
  const rawBody = await req.text();

  console.log("[inbound-email] content-type:", contentType);
  console.log("[inbound-email] raw first 500:", rawBody.slice(0, 500));

  return NextResponse.json({ ok: true, inspected: true });
}
