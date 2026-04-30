-- 0. Clean up tables (to be able to rerun the script cleanly)
DROP TABLE IF EXISTS public.activity_logs CASCADE;
DROP TABLE IF EXISTS public.ratings CASCADE;
DROP TABLE IF EXISTS public.medical_records CASCADE;
DROP TABLE IF EXISTS public.appointments CASCADE;
DROP TABLE IF EXISTS public.payment_methods CASCADE;
DROP TABLE IF EXISTS public.doctor_assignments CASCADE;
DROP TABLE IF EXISTS public.offices CASCADE;
DROP TABLE IF EXISTS public.branches CASCADE;
DROP TABLE IF EXISTS public.doctor_details CASCADE;
DROP TABLE IF EXISTS public.patient_details CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Legacy Spanish Tables Cleanup (Old Schema)
DROP TABLE IF EXISTS public.citas CASCADE;
DROP TABLE IF EXISTS public.doctores_detalles CASCADE;
DROP TABLE IF EXISTS public.pacientes_detalles CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.usuarios CASCADE;
DROP TABLE IF EXISTS public.historial_clinico CASCADE;
DROP TABLE IF EXISTS public.medical_history CASCADE;

-- 1. Create new tables

-- Main Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT,
    middle_name TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    avatar_url TEXT,
    expo_push_token TEXT
);

-- Patient Details
CREATE TABLE IF NOT EXISTS public.patient_details (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    birth_date DATE,
    gender TEXT,
    address TEXT,
    blood_type TEXT,
    allergies TEXT,
    family_history TEXT,
    pathological_history TEXT,
    non_pathological_history TEXT,
    obstetric_history TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    created_by_reception BOOLEAN DEFAULT FALSE
);

-- Doctor Details
CREATE TABLE IF NOT EXISTS public.doctor_details (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    specialty TEXT,
    consultation_fee DECIMAL(10,2),
    contract_start DATE,
    contract_end DATE,
    custom_schedule JSONB,
    internal_doc_id VARCHAR(50),
    medical_license TEXT
);

-- Branches (Clinics)
CREATE TABLE IF NOT EXISTS public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    address TEXT,
    phone TEXT,
    gps_url TEXT,
    status VARCHAR(20) DEFAULT 'active'
);

-- Offices
CREATE TABLE IF NOT EXISTS public.offices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    floor TEXT,
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE
);

-- Doctor Assignments
CREATE TABLE IF NOT EXISTS public.doctor_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    modality VARCHAR(50), -- 'hourly', 'daily'
    day_of_week INT, -- 0-6
    start_time TIME,
    end_time TIME,
    doctor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE
);

-- Saved Payment Methods
CREATE TABLE IF NOT EXISTS public.payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    last_four VARCHAR(4),
    brand VARCHAR(50),
    gateway_token VARCHAR(255),
    is_default BOOLEAN DEFAULT FALSE,
    patient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- Appointments
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) NOT NULL,
    total_price DECIMAL(10,2),
    amount_paid DECIMAL(10,2),
    payment_method VARCHAR(50),
    transfer_reference VARCHAR(50),
    expires_at TIMESTAMP WITH TIME ZONE,
    office_id VARCHAR(20) REFERENCES public.offices(id),
    patient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Medical Records
CREATE TABLE IF NOT EXISTS public.medical_records (
    appointment_id UUID PRIMARY KEY REFERENCES public.appointments(id) ON DELETE CASCADE,
    consultation_reason TEXT,
    previous_diseases TEXT,
    clinical_notes TEXT,
    diagnosis TEXT,
    medications TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Doctor Ratings
CREATE TABLE IF NOT EXISTS public.ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    score INT CHECK (score >= 1 AND score <= 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    patient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- Activity Logs
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    description TEXT,
    event_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- Slot Locks (for appointment booking)
CREATE TABLE IF NOT EXISTS public.slot_locks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    locked_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- 2. Auth Triggers

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
DECLARE
    v_role VARCHAR(50);
    v_first_name TEXT;
    v_last_name TEXT;
    v_phone TEXT;
    v_birth_date DATE;
    v_gender TEXT;
    v_allergies TEXT;
BEGIN
    -- Extract metadata
    v_role := COALESCE(new.raw_user_meta_data->>'role', 'patient');
    v_first_name := COALESCE(new.raw_user_meta_data->>'first_name', '');
    v_last_name := COALESCE(new.raw_user_meta_data->>'last_name', '');
    v_phone := new.raw_user_meta_data->>'phone';
    
    -- Insert into profiles
    INSERT INTO public.profiles (id, role, email, first_name, last_name, phone)
    VALUES (new.id, v_role, new.email, v_first_name, v_last_name, v_phone);

    -- Insert into corresponding detail table
    IF v_role = 'patient' THEN
        v_birth_date := NULLIF(new.raw_user_meta_data->>'birth_date', '')::DATE;
        v_gender := new.raw_user_meta_data->>'gender';
        v_allergies := new.raw_user_meta_data->>'clinical_notes';
        
        INSERT INTO public.patient_details (user_id, birth_date, gender, allergies)
        VALUES (new.id, v_birth_date, v_gender, v_allergies);
    ELSIF v_role = 'doctor' THEN
        INSERT INTO public.doctor_details (user_id)
        VALUES (new.id);
    END IF;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created_relational ON auth.users;
CREATE TRIGGER on_auth_user_created_relational
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. RLS Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

-- 4. Helper Functions for RLS (Security Definer to avoid recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Basic Policies
CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Patients can view their own details" ON public.patient_details
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Doctors can view their own details" ON public.doctor_details
    FOR SELECT USING (auth.uid() = user_id);

-- Admin Power Policies (Using helper function to avoid recursion)
CREATE POLICY "Admins can view all profiles" ON public.profiles
    FOR SELECT USING ( public.is_admin() );
CREATE POLICY "Admins can view all patient details" ON public.patient_details
    FOR SELECT USING ( public.is_admin() );
CREATE POLICY "Admins can view all doctor details" ON public.doctor_details
    FOR SELECT USING ( public.is_admin() );

-- Update Policies
CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Patients can update their own details" ON public.patient_details
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Doctors can update their own details" ON public.doctor_details
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can update any profile" ON public.profiles
    FOR UPDATE USING ( public.is_admin() );

-- Public/Staff Access
CREATE POLICY "Staff is visible to all authenticated users" ON public.profiles
    FOR SELECT USING (role IN ('doctor', 'receptionist', 'admin') AND auth.role() = 'authenticated');
CREATE POLICY "Doctor details are visible to all authenticated users" ON public.doctor_details
    FOR SELECT USING (auth.role() = 'authenticated');

-- Infrastructure Access
CREATE POLICY "Branches are visible to all authenticated users" ON public.branches
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Offices are visible to all authenticated users" ON public.offices
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Doctor assignments are visible to all authenticated users" ON public.doctor_assignments
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Appointments are visible to owners and staff" ON public.appointments
    FOR SELECT USING (
        auth.uid() = patient_id OR 
        auth.uid() = doctor_id OR 
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'receptionist')
    );
