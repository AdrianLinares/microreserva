-- PostgreSQL schema for Micro Reserva

-- Bookings table
CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  equipment_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  time_slot_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('available', 'pending', 'approved', 'blocked')),
  user_name TEXT,
  user_email TEXT,
  user_group TEXT,
  blocked_reason TEXT,
  block_type TEXT CHECK (block_type IS NULL OR block_type IN ('single', 'range', 'indefinite')),
  block_start_date TEXT,
  block_end_date TEXT,
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin settings table
CREATE TABLE admin_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings
INSERT INTO admin_settings (key, value) VALUES ('notification_email', '');

-- Indexes for performance
CREATE INDEX idx_bookings_date ON bookings(date);
CREATE INDEX idx_bookings_equipment_date ON bookings(equipment_id, date);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_user_email ON bookings(user_email) WHERE user_email IS NOT NULL;
CREATE INDEX idx_bookings_indefinite_blocks ON bookings(equipment_id, block_start_date) WHERE block_type = 'indefinite';
