const TELEGRAM_API = 'https://api.telegram.org'

export function escapeTelegramHtml(value: unknown): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function getBotToken(): string {
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set')
    return token
}

function getAlertTelegramConfig(context: string): { botToken: string; chatId: string } | null {
    const botToken = process.env.ALERT_TELEGRAM_BOT_TOKEN?.trim()
    const chatId = process.env.ALERT_TELEGRAM_CHAT_ID?.trim()

    if (!botToken || !chatId) {
        console.warn(`[Telegram] ${context} skipped: missing ALERT_TELEGRAM_BOT_TOKEN or ALERT_TELEGRAM_CHAT_ID`)
        return null
    }

    return { botToken, chatId }
}

function getSignupAlertConfig(): { botToken: string; chatId: string } | null {
    return getAlertTelegramConfig('Signup alert')
}

export async function sendTelegramMessage(
    chatId: string,
    message: string,
    botToken = getBotToken(),
): Promise<{ ok: boolean; description?: string; status: number }> {
    const url = `${TELEGRAM_API}/bot${botToken}/sendMessage`

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML',
            disable_web_page_preview: true
        })
    })

    const rawBody = await res.text()
    let data: { ok?: boolean; description?: string } = {}

    if (rawBody) {
        try {
            data = JSON.parse(rawBody) as { ok?: boolean; description?: string }
        } catch {
            data = { description: rawBody }
        }
    }

    return {
        ok: res.ok && data.ok === true,
        description: data.description || rawBody || undefined,
        status: res.status,
    }
}

/** Parse User-Agent string into a readable device description */
function parseDevice(ua?: string): string {
    if (!ua) return 'unknown'

    // OS detection
    let os = 'Unknown OS'
    if (/Windows/i.test(ua)) os = 'Windows'
    else if (/Macintosh|Mac OS/i.test(ua)) os = 'macOS'
    else if (/Android/i.test(ua)) {
        const ver = ua.match(/Android ([\d.]+)/)?.[1]
        os = ver ? `Android ${ver}` : 'Android'
    }
    else if (/iPhone|iPad|iPod/i.test(ua)) {
        const ver = ua.match(/OS ([\d_]+)/)?.[1]?.replace(/_/g, '.')
        os = ver ? `iOS ${ver}` : 'iOS'
    }
    else if (/Linux/i.test(ua)) os = 'Linux'

    // Browser detection
    let browser = ''
    if (/Edg\//i.test(ua)) browser = 'Edge'
    else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome'
    else if (/Firefox\//i.test(ua)) browser = 'Firefox'
    else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari'

    return browser ? `${os} / ${browser}` : os
}

/** Send Telegram notification for new user signup */
export async function notifyNewSignup(opts: {
    email: string
    fullName: string
    type: 'signup' | 'invite'
    trialDays: number
    ip?: string
    device?: string
}) {
    const config = getSignupAlertConfig()
    if (!config) {
        return
    }

    const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
    const emoji = opts.type === 'invite' ? '📨' : '🎉'
    const title = opts.type === 'invite' ? 'User Baru (Invite)' : 'User Baru Client Desk'

    const deviceInfo = parseDevice(opts.device)

    const message = [
        `${emoji} <b>${title}!</b>`,
        '',
        `👤 Nama: ${opts.fullName || '-'}`,
        `📧 Email: ${opts.email}`,
        `🕐 Waktu: ${now}`,
        `🌐 IP: ${opts.ip || 'unknown'}`,
        `📱 Device: ${deviceInfo}`,
        '',
        `Trial ${opts.trialDays} hari otomatis dibuat ✅`,
    ].join('\n')

    try {
        const result = await sendTelegramMessage(config.chatId, message, config.botToken)
        if (!result.ok) {
            console.error('[Telegram] Failed to send signup notification:', {
                status: result.status,
                description: result.description || null,
                type: opts.type,
                email: opts.email,
            })
        }
    } catch (err) {
        console.error('[Telegram] Failed to send signup notification:', {
            err,
            type: opts.type,
            email: opts.email,
        })
    }
}

export async function notifyBlockedLoginAttempt(opts: {
    email: string
    reason?: string | null
    suspendedUserId?: string | null
    ip?: string
    device?: string
}) {
    const config = getAlertTelegramConfig('Blocked login alert')
    if (!config) {
        return
    }

    const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
    const deviceInfo = parseDevice(opts.device)
    const message = [
        `⚠️ <b>ClientDesk Blocked Login Attempt</b>`,
        '',
        `📧 Email: ${escapeTelegramHtml(opts.email)}`,
        `📝 Reason: ${escapeTelegramHtml(opts.reason || '-')}`,
        `🆔 Suspended User: <code>${escapeTelegramHtml(opts.suspendedUserId || '-')}</code>`,
        `🕐 Waktu: ${escapeTelegramHtml(now)}`,
        `🌐 IP: ${escapeTelegramHtml(opts.ip || 'unknown')}`,
        `📱 Device: ${escapeTelegramHtml(deviceInfo)}`,
    ].join('\n')

    try {
        const result = await sendTelegramMessage(config.chatId, message, config.botToken)
        if (!result.ok) {
            console.error('[Telegram] Failed to send blocked login notification:', {
                status: result.status,
                description: result.description || null,
                email: opts.email,
            })
        }
    } catch (err) {
        console.error('[Telegram] Failed to send blocked login notification:', {
            err,
            email: opts.email,
        })
    }
}
