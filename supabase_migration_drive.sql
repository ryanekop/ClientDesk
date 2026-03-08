-- Add Google Drive OAuth token columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS google_drive_access_token TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS google_drive_refresh_token TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS google_drive_token_expiry TIMESTAMPTZ;
