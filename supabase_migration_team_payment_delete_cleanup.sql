-- Keep team/freelance payment entries aligned with active booking assignments.

DROP POLICY IF EXISTS "freelance_payment_entries_delete_own"
  ON public.freelance_payment_entries;
CREATE POLICY "freelance_payment_entries_delete_own"
  ON public.freelance_payment_entries
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.cd_delete_freelance_payment_entry_for_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.freelance_payment_entries AS entries
  WHERE entries.booking_id = OLD.booking_id
    AND entries.freelance_id = OLD.freelance_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.booking_freelance AS active_assignment
      WHERE active_assignment.booking_id = OLD.booking_id
        AND active_assignment.freelance_id = OLD.freelance_id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.bookings AS booking
      WHERE booking.id = OLD.booking_id
        AND booking.freelance_id = OLD.freelance_id
    );

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_booking_freelance_delete_payment_entry
  ON public.booking_freelance;
CREATE TRIGGER trg_booking_freelance_delete_payment_entry
AFTER DELETE ON public.booking_freelance
FOR EACH ROW
EXECUTE FUNCTION public.cd_delete_freelance_payment_entry_for_assignment();
