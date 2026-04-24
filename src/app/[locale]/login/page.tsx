import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { LoginForm } from "@/components/auth/login-form"
import {
    getMainClientDeskOrigin,
    shouldUseMainClientDeskRegisterOrigin,
} from "@/lib/auth/register-url"
import { normalizeAuthLocale } from "@/lib/auth/public-origin"
import {
    createSignedAuthHandoffState,
    sanitizeAuthHandoffReturnPath,
    verifySignedAuthHandoffState,
} from "@/lib/auth/handoff"
import { resolveTenant } from "@/lib/tenant-resolver"

function getFirstHeaderValue(value: string | null) {
    return value?.split(",")[0]?.trim() || ""
}

function getRequestOrigin(headersList: Headers) {
    const forwardedHost = getFirstHeaderValue(headersList.get("x-forwarded-host"))
    const host = forwardedHost || getFirstHeaderValue(headersList.get("host"))
    const forwardedProto = getFirstHeaderValue(headersList.get("x-forwarded-proto"))
    const proto = forwardedProto === "http" || forwardedProto === "https"
        ? forwardedProto
        : "https"

    return host ? `${proto}://${host}` : getMainClientDeskOrigin()
}

export default async function LoginPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string }>
    searchParams?: Promise<{ handoff?: string; next?: string }>
}) {
    const { locale: rawLocale } = await params
    const locale = normalizeAuthLocale(rawLocale)
    const resolvedSearchParams = await searchParams
    const headersList = await headers()
    const host = getFirstHeaderValue(headersList.get("x-forwarded-host"))
        || getFirstHeaderValue(headersList.get("host"))
    const requestOrigin = getRequestOrigin(headersList)
    const returnPath = sanitizeAuthHandoffReturnPath(
        resolvedSearchParams?.next,
        locale,
    )

    if (shouldUseMainClientDeskRegisterOrigin(host)) {
        const tenant = await resolveTenant(host, { bypassCache: true })
        const targetUrl = new URL(`/${locale}/login`, getMainClientDeskOrigin())

        if (tenant.id !== "default") {
            const handoff = createSignedAuthHandoffState({
                origin: requestOrigin,
                returnPath,
                locale,
            })

            if (handoff) {
                targetUrl.searchParams.set("handoff", handoff)
            }
        }

        redirect(targetUrl.toString())
    }

    let handoffTarget: { origin: string; returnPath: string } | null = null
    let handoffError = false
    if (resolvedSearchParams?.handoff) {
        const verification = await verifySignedAuthHandoffState(
            resolvedSearchParams.handoff,
        )
        if (verification.valid) {
            handoffTarget = {
                origin: verification.payload.origin,
                returnPath: verification.payload.returnPath,
            }
        } else {
            handoffError = true
        }
    }

    return <LoginForm handoffTarget={handoffTarget} handoffError={handoffError} />
}
