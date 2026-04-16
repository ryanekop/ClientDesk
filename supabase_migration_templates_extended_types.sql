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
