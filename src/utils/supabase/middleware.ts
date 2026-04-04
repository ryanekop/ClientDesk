import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const DEFAULT_AUTH_REFRESH_TIMEOUT_MS = 1200
const AUTH_REFRESH_TIMEOUT_MS = resolveAuthRefreshTimeoutMs()
const AUTH_REFRESH_FAIL_OPEN = resolveAuthRefreshFailOpen()
const WARN_INTERVAL_MS = 30_000

let lastWarnAt = 0

function resolveAuthRefreshTimeoutMs() {
    const rawValue = process.env.AUTH_REFRESH_TIMEOUT_MS
    const parsed = rawValue ? Number.parseInt(rawValue, 10) : NaN
    if (Number.isFinite(parsed) && parsed >= 100 && parsed <= 10_000) {
        return parsed
    }

    return DEFAULT_AUTH_REFRESH_TIMEOUT_MS
}

function resolveAuthRefreshFailOpen() {
    const value = process.env.AUTH_REFRESH_FAIL_OPEN?.trim().toLowerCase()
    if (!value) {
        return false
    }

    return !['0', 'false', 'no', 'off'].includes(value)
}

function createAuthRefreshTimeoutError(timeoutMs: number) {
    const error = new Error(`Auth refresh timed out after ${timeoutMs}ms`)
    error.name = 'AuthRefreshTimeoutError'
    return error
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    const timeoutPromise = new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(createAuthRefreshTimeoutError(timeoutMs))
        }, timeoutMs)
    })

    try {
        return await Promise.race([promise, timeoutPromise])
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId)
        }
    }
}

function logRefreshWarning(pathname: string, error: unknown) {
    const now = Date.now()
    if (now - lastWarnAt < WARN_INTERVAL_MS) {
        return
    }
    lastWarnAt = now

    const errorName = error instanceof Error ? error.name : 'UnknownError'
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.warn(
        `[Auth Refresh] fail-open for ${pathname} (${errorName}: ${errorMessage})`,
    )
}

export async function updateSession(request: NextRequest, response: NextResponse) {
    let supabaseResponse = response

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    // Preserve existing response headers (e.g. tenant headers, i18n headers)
                    response.headers.forEach((value, key) => {
                        supabaseResponse.headers.set(key, value)
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    try {
        await withTimeout(supabase.auth.getUser(), AUTH_REFRESH_TIMEOUT_MS)
    } catch (error) {
        if (!AUTH_REFRESH_FAIL_OPEN) {
            throw error
        }
        logRefreshWarning(request.nextUrl.pathname, error)
    }

    return supabaseResponse
}
