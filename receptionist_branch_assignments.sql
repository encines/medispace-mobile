-- Assign one active receptionist per branch and allow branch-scoped reception workflows.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS unique_active_receptionist_per_branch
ON public.profiles (branch_id)
WHERE role = 'receptionist' AND is_active = TRUE AND branch_id IS NOT NULL;

-- Optional cleanup: only receptionists should keep a branch assignment.
UPDATE public.profiles
SET branch_id = NULL
WHERE role <> 'receptionist' AND branch_id IS NOT NULL;

DROP POLICY IF EXISTS "Appointments are visible to owners and staff" ON public.appointments;
CREATE POLICY "Appointments are visible to owners and staff" ON public.appointments
    FOR SELECT USING (
        auth.uid() = patient_id OR
        auth.uid() = doctor_id OR
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' OR
        (
            (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'receptionist'
            AND office_id IN (
                SELECT id FROM public.offices
                WHERE branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
            )
        )
    );

DROP POLICY IF EXISTS "Appointments can be updated by owners and staff" ON public.appointments;
CREATE POLICY "Appointments can be updated by owners and staff" ON public.appointments
    FOR UPDATE USING (
        auth.uid() = patient_id OR
        auth.uid() = doctor_id OR
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' OR
        (
            (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'receptionist'
            AND office_id IN (
                SELECT id FROM public.offices
                WHERE branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
            )
        )
    );
