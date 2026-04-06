-- Google Drive folder structure settings for client files and payment proof uploads
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS drive_root_folder_name TEXT DEFAULT 'Data Booking Client Desk';

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS drive_client_folder_template TEXT DEFAULT '{{client_name}}';

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS drive_client_files_folder_name TEXT DEFAULT 'File Client';

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS drive_invoice_folder_template TEXT DEFAULT '{{invoice_name}}';

CREATE TABLE IF NOT EXISTS booking_drive_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  file_name TEXT NOT NULL,
  drive_file_id TEXT NOT NULL,
  drive_file_url TEXT NOT NULL,
  mime_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_drive_files_booking_id
ON booking_drive_files (booking_id);

CREATE INDEX IF NOT EXISTS idx_booking_drive_files_user_id
ON booking_drive_files (user_id);
