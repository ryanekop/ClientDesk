import { NextRequest } from "next/server";

function firstHeaderToken(value: string | null) {
  if (!value) return "";
  return value.split(",")[0]?.trim() || "";
}

export function getRequestIp(request: NextRequest) {
  const cfIp = firstHeaderToken(request.headers.get("cf-connecting-ip"));
  if (cfIp) return cfIp;

  const xForwardedFor = firstHeaderToken(request.headers.get("x-forwarded-for"));
  if (xForwardedFor) return xForwardedFor;

  const realIp = firstHeaderToken(request.headers.get("x-real-ip"));
  if (realIp) return realIp;

  return "unknown";
}
