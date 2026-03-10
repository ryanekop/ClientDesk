import { createClient } from '@supabase/supabase-js'

// Service Role Client - bypasses RLS, use only server-side
function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    )
}

export type SubscriptionTier = 'free' | 'pro_monthly' | 'pro_quarterly' | 'pro_yearly' | 'lifetime'
export type SubscriptionStatus = 'active' | 'expired' | 'trial'

export interface Subscription {
    id: string
    user_id: string
    tier: SubscriptionTier
    status: SubscriptionStatus
    start_date: string
    end_date: string | null
    trial_end_date: string | null
    mayar_transaction_id: string | null
    created_at: string
    updated_at: string
}

export interface SubscriptionCheck {
    isActive: boolean
    isPro: boolean
    isTrial: boolean
    isExpired: boolean
    tier: SubscriptionTier
    daysRemaining: number | null
}

const TRIAL_DAYS = 5

export async function getSubscription(userId: string): Promise<Subscription | null> {
    const supabaseAdmin = getSupabaseAdmin()
    const { data, error } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .single()

    if (error || !data) {
        return null
    }

    return data as Subscription
}

export async function checkSubscriptionStatus(userId: string): Promise<SubscriptionCheck> {
    const subscription = await getSubscription(userId)

    // No subscription record = free/trial user
    if (!subscription) {
        return {
            isActive: false,
            isPro: false,
            isTrial: true,
            isExpired: false,
            tier: 'free',
            daysRemaining: null,
        }
    }

    const now = new Date()
    const tier = subscription.tier

    // Lifetime = always active
    if (tier === 'lifetime') {
        return {
            isActive: true,
            isPro: true,
            isTrial: false,
            isExpired: false,
            tier,
            daysRemaining: null,
        }
    }

    // Check trial status
    if (subscription.status === 'trial' && subscription.trial_end_date) {
        const trialEnd = new Date(subscription.trial_end_date)
        const isTrialExpired = now > trialEnd

        if (isTrialExpired) {
            return {
                isActive: false,
                isPro: false,
                isTrial: false,
                isExpired: true,
                tier: 'free',
                daysRemaining: 0,
            }
        }

        const daysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        return {
            isActive: true,
            isPro: false,
            isTrial: true,
            isExpired: false,
            tier: 'free',
            daysRemaining,
        }
    }

    // Pro subscription check
    if (subscription.end_date) {
        const endDate = new Date(subscription.end_date)
        const isExpired = now > endDate

        if (isExpired) {
            return {
                isActive: false,
                isPro: false,
                isTrial: false,
                isExpired: true,
                tier,
                daysRemaining: 0,
            }
        }

        const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        return {
            isActive: true,
            isPro: true,
            isTrial: false,
            isExpired: false,
            tier,
            daysRemaining,
        }
    }

    // Fallback: active with no end_date (shouldn't happen but treat as active)
    return {
        isActive: subscription.status === 'active',
        isPro: subscription.status === 'active',
        isTrial: false,
        isExpired: subscription.status === 'expired',
        tier,
        daysRemaining: null,
    }
}

// Create a trial subscription for a new user
export async function createTrialSubscription(userId: string): Promise<boolean> {
    const trialEndDate = new Date()
    trialEndDate.setDate(trialEndDate.getDate() + TRIAL_DAYS)

    const supabaseAdmin = getSupabaseAdmin()
    const { error } = await supabaseAdmin
        .from('subscriptions')
        .insert({
            user_id: userId,
            tier: 'free',
            status: 'trial',
            trial_end_date: trialEndDate.toISOString()
        })

    if (error) {
        console.error('Error creating trial subscription:', error)
        return false
    }

    return true
}
