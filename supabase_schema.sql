-- ========================================================
-- Client Desk (Vendor Management) - Core Database Schema
-- ========================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. USERS & PROFILES (Studio Admin / Owners)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  studio_name TEXT,
  whatsapp_number TEXT,
  role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'staff')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. FREELANCERS / TEAM MEMBERS
CREATE TABLE freelancers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE, -- Belongs to which studio admin
  name TEXT NOT NULL,
  role TEXT NOT NULL, -- e.g., 'Photographer', 'Videographer', 'MUA'
  whatsapp_number TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. SERVICES & PACKAGES
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(15, 2) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. BOOKINGS (Transactions)
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  booking_code TEXT UNIQUE NOT NULL, -- e.g., 'BKG-001'
  client_name TEXT NOT NULL,
  client_whatsapp TEXT,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  freelancer_id UUID REFERENCES freelancers(id) ON DELETE SET NULL,
  
  -- Scheduling & Status
  session_date TIMESTAMPTZ,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'DP', 'Terjadwal', 'Edit', 'Selesai', 'Batal')),
  
  -- Financial
  total_price NUMERIC(15, 2) DEFAULT 0,
  dp_paid NUMERIC(15, 2) DEFAULT 0,
  is_fully_paid BOOLEAN DEFAULT false,
  
  -- Data & Delivery
  notes TEXT,
  drive_folder_url TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TEMPLATES (WhatsApp & Forms)
CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'whatsapp_client',
    'whatsapp_booking_confirm',
    'whatsapp_settlement_client',
    'whatsapp_settlement_confirm',
    'whatsapp_freelancer',
    'invoice'
  )),
  name TEXT NOT NULL,
  content TEXT NOT NULL, -- The text format containing variables like {{client_name}}
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================================
-- RLS (Row Level Security) Policies
-- ========================================================
-- Default: Off (As configured per User's request, to be toggled on later if explicitly needed)
-- To enable later: 
-- ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE freelancers ENABLE ROW LEVEL SECURITY;
-- (and add policies accordingly)
