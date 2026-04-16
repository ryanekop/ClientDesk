import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { RegisterForm } from "@/components/auth/register-form"
import {
    getMainClientDeskOrigin,
    shouldUseMainClientDeskRegisterOrigin,
} from "@/lib/auth/register-url"

export default async function RegisterPage({
    params,
}: {
    params: Promise<{ locale: string }>
}) {
    const { locale } = await params
    const headersList = await headers()
    const host = headersList.get("x-forwarded-host") || headersList.get("host") || ""

    if (shouldUseMainClientDeskRegisterOrigin(host)) {
        redirect(`${getMainClientDeskOrigin()}/${locale}/register`)
    }

    return <RegisterForm />
}
