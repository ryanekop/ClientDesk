-- Video result links for bookings and client tracking visibility.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS video_drive_folder_url TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tracking_video_links_visible_from_status TEXT DEFAULT 'File Siap';
