-- Add quantity support for booking services so the same package/add-on can be selected more than once.

ALTER TABLE public.booking_services
ADD COLUMN IF NOT EXISTS quantity INT NOT NULL DEFAULT 1;

UPDATE public.booking_services
SET quantity = 1
WHERE quantity IS NULL OR quantity < 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'booking_services_quantity_check'
      AND conrelid = 'public.booking_services'::regclass
  ) THEN
    ALTER TABLE public.booking_services
    ADD CONSTRAINT booking_services_quantity_check CHECK (quantity >= 1);
  END IF;
END $$;
