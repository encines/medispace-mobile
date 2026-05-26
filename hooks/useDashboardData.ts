import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { endOfDay, format, startOfDay } from 'date-fns';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';

/**
 * Hook to fetch Global Admin Statistics
 */
export function useAdminStats() {
  return useQuery({
    queryKey: ['admin-dashboard-stats'],
    queryFn: async () => {
      const [doctorsCount, receptionistsCount, branchesCount, officesCount, directPatientsCount, receptionPatientsCount] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'doctor'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'receptionist'),
        supabase.from('branches').select('*', { count: 'exact', head: true }),
        supabase.from('offices').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('patient_details').select('*', { count: 'exact', head: true }).eq('created_by_reception', false),
        supabase.from('patient_details').select('*', { count: 'exact', head: true }).eq('created_by_reception', true),
      ]);
      return {
        doctors: doctorsCount.count || 0,
        receptionists: receptionistsCount.count || 0,
        branches: branchesCount.count || 0,
        offices: officesCount.count || 0,
        directPatients: directPatientsCount.count || 0,
        receptionPatients: receptionPatientsCount.count || 0,
      };
    },
  });
}

/**
 * Hook to fetch Doctor Feedback and calculate average rating
 */
export function useDoctorFeedback() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['my-reviews', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data: ratings, error } = await supabase
        .from('ratings')
        .select('*')
        .eq('doctor_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error || !ratings.length) return [];
      
      const patientIds = Array.from(new Set(ratings.map(r => r.patient_id)));
      const { data: profilesResult } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url')
        .in('id', patientIds);

      const profiles = profilesResult?.map(u => ({ user_id: u.id, first_name: u.first_name, last_name: u.last_name, avatar_url: u.avatar_url })) || [];

      return ratings.map(r => ({
        ...r,
        patient: profiles?.find(p => p.user_id === r.patient_id) || { first_name: 'Paciente' }
      }));
    },
    enabled: !!user?.id,
  });
}

/**
 * Hook to fetch upcoming appointments based on user role
 */
export function useUpcomingAppointments(role: 'doctor' | 'patient' | 'receptionist') {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['upcoming-appointments', role, user?.id],
    queryFn: async () => {
      if (!user?.id && role !== 'receptionist') return [];

      let receptionistOfficeIds: string[] = [];
      if (role === 'receptionist') {
        if (!user?.id) return [];

        const { data: receptionistProfile } = await supabase
          .from('profiles')
          .select('branch_id')
          .eq('id', user.id)
          .single();

        if (!receptionistProfile?.branch_id) return [];

        const { data: branchOffices, error: officesError } = await supabase
          .from('offices')
          .select('id')
          .eq('branch_id', receptionistProfile.branch_id);

        if (officesError || !branchOffices?.length) return [];
        receptionistOfficeIds = branchOffices.map(office => office.id);
      }
      
      const today = new Date();
      let query = supabase
        .from('appointments')
        .select('*')
        .gte('start_time', role === 'doctor' ? startOfDay(today).toISOString() : format(today, 'yyyy-MM-dd'))
        .in('status', ['scheduled', 'confirmed', 'arrived'])
        .order('start_time', { ascending: true })
        .limit(10);

      if (role === 'doctor') {
        query = query.lte('start_time', endOfDay(today).toISOString());
      }

      if (role === 'patient') {
        query = query.eq('patient_id', user!.id);
      } else if (role === 'doctor') {
        query = query.eq('doctor_id', user!.id);
      } else if (role === 'receptionist') {
        query = query.in('office_id', receptionistOfficeIds);
      }

      const { data: appointments, error } = await query;
      if (error || !appointments?.length) return [];

      const targetIds = Array.from(new Set(appointments.map(a => 
        role === 'patient' ? a.doctor_id : a.patient_id
      )));
      const doctorIds = role === 'receptionist'
        ? Array.from(new Set(appointments.map(a => a.doctor_id)))
        : [];
      const profileIds = Array.from(new Set([...targetIds, ...doctorIds]));

      const { data: profilesResult } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url')
        .in('id', profileIds);

      const profiles = profilesResult?.map(u => ({ user_id: u.id, first_name: u.first_name, last_name: u.last_name, avatar_url: u.avatar_url })) || [];

      const mapped = appointments.map(apt => ({
        ...apt,
        counterparty: profiles?.find(p => p.user_id === (role === 'patient' ? apt.doctor_id : apt.patient_id)) || null,
        doctorProfile: role === 'receptionist'
          ? profiles?.find(p => p.user_id === apt.doctor_id) || null
          : null,
      }));

      return mapped.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    },
    enabled: !!user?.id || role === 'receptionist',
  });
}

/**
 * Hook to handle appointment status mutations
 */
export function useUpdateAppointmentStatus() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async ({ id, status, patientId }: { id: string; status: string; patientId: string }) => {
      const { error } = await supabase.from('appointments').update({ status }).eq('id', id);
      if (error) throw error;
      return { id, patientId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['upcoming-appointments'] });
      router.push(`/(dashboard)/records/${data.patientId}?appointmentId=${data.id}`);
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });
}
