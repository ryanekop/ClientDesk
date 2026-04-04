import { NextResponse } from "next/server";

export type SecurityErrorCode =
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_FILE_TYPE"
  | "INVALID_URL"
  | "RATE_LIMITED";

export function securityErrorResponse(args: {
  message: string;
  code: SecurityErrorCode;
  status: number;
  headers?: HeadersInit;
}) {
  return NextResponse.json(
    {
      success: false,
      error: args.message,
      code: args.code,
    },
    {
      status: args.status,
      headers: args.headers,
    },
  );
}
