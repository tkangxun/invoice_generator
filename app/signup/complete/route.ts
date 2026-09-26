import { NextResponse } from "next/server";
import { finishSignup } from "@/lib/actions/signup";

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("session_id") ?? "";
  const result = await finishSignup(sessionId);
  const url = new URL(result.ok ? "/dashboard" : "/signup", request.url);
  if (!result.ok) url.searchParams.set("error", result.error);
  return NextResponse.redirect(url);
}
