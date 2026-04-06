ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS payment_proof_drive_file_id text,
ADD COLUMN IF NOT EXISTS final_payment_proof_drive_file_id text;
