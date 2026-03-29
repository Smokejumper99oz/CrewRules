import { NextResponse } from "next/server";

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  try {
    const body = await req.json();
    console.log("[commute-integrity]", JSON.stringify(body));
  } catch (e) {
    console.log("[commute-integrity] bad body", e);
  }
  return NextResponse.json({ ok: true });
}
