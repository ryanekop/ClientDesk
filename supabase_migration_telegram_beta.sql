ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telegram_notifications_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT,
  ADD COLUMN IF NOT EXISTS telegram_language TEXT NOT NULL DEFAULT 'id',
  ADD COLUMN IF NOT EXISTS telegram_notify_new_booking BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS telegram_notify_settlement_submitted BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS telegram_notify_session_h1 BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE public.profiles
SET telegram_language = 'id'
WHERE telegram_language IS NULL OR telegram_language NOT IN ('id', 'en');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_telegram_language_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_telegram_language_check
      CHECK (telegram_language IN ('id', 'en'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.telegram_notification_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_key TEXT NOT NULL,
  scheduled_for_date DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS telegram_notification_logs_event_key_idx
  ON public.telegram_notification_logs (user_id, event_type, event_key);

CREATE INDEX IF NOT EXISTS telegram_notification_logs_booking_idx
  ON public.telegram_notification_logs (booking_id, event_type);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'telegram_notification_logs_status_check'
      AND conrelid = 'public.telegram_notification_logs'::regclass
  ) THEN
    ALTER TABLE public.telegram_notification_logs
      ADD CONSTRAINT telegram_notification_logs_status_check
      CHECK (status IN ('pending', 'sent', 'failed', 'skipped'));
  END IF;
END $$;

DROP TRIGGER IF EXISTS set_telegram_notification_logs_updated_at
  ON public.telegram_notification_logs;
CREATE TRIGGER set_telegram_notification_logs_updated_at
BEFORE UPDATE ON public.telegram_notification_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.templates
DROP CONSTRAINT IF EXISTS templates_type_check;

ALTER TABLE public.templates
ADD CONSTRAINT templates_type_check CHECK (
  type IN (
    'whatsapp_client',
    'whatsapp_booking_confirm',
    'whatsapp_session_reminder_client',
    'whatsapp_settlement_client',
    'whatsapp_settlement_confirm',
    'whatsapp_freelancer',
    'invoice'
  )
);
