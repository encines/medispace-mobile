import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';

/**
 * Hook to fetch Global Admin Statistics
 */
export function useAdminStats() {
  return useQuery({
    queryKey: ['admin-dashboard-stats'],
    queryFn: async () => {
      const [doctorsCount, branchesCount, officesCount] = await Promise.all([
        supabase.from('user_roles').select('*', { count: 'exact', head: true }).eq('role', 'doctor'),
        supabase.from('branches').select('*', { count: 'exact', head: true }),
        supabase.from('offices').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      ]);
      return {
        doctors: doctorsCount.count || 0,
        branches: branchesCount.count || 0,
        offices: officesCount.count || 0,
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
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, avatar_url')
        .in('user_id', patientIds);

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
      
      const today = format(new Date(), 'yyyy-MM-dd');
      let query = supabase
        .from('appointments')
        .select('*')
        .gte('appointment_date', today)
        .in('status', ['scheduled', 'confirmed'])
        .order('appointment_date', { ascending: true })
        .limit(role === 'patient' ? 3 : 5);

      if (role === 'patient') {
        query = query.eq('patient_id', user!.id);
      } else if (role === 'doctor') {
        query = query.eq('doctor_id', user!.id);
      }

      const { data: appointments, error } = await query;
      if (error || !appointments?.length) return [];

      const targetRole = role === 'patient' ? 'doctor' : 'patient';
      const targetIds = Array.from(new Set(appointments.map(a => 
        role === 'patient' ? a.doctor_id : a.patient_id
      )));

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, avatar_url')
        .in('user_id', targetIds);

      return appointments.map(apt => ({
        ...apt,
        counterparty: profiles?.find(p => p.user_id === (role === 'patient' ? apt.doctor_id : apt.patient_id)) || null
      }));
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
