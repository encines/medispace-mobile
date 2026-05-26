import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Colors, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { useUpcomingAppointments } from '../../hooks/useDashboardData';
import { StatsSkeleton, AppointmentSkeleton } from './DashboardSkeletons';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';

export default function ReceptionistDashboard() {
  const router = useRouter();
  const { profile } = useAuth();
  const appointmentsQuery = useUpcomingAppointments('receptionist');
  const { data: branch } = useQuery({
    queryKey: ['receptionist-branch', profile?.branch_id],
    queryFn: async () => {
      if (!profile?.branch_id) return null;

      const { data, error } = await supabase
        .from('branches')
        .select('id, name, address, status')
        .eq('id', profile.branch_id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.branch_id,
  });

  if (appointmentsQuery.isLoading && !appointmentsQuery.data) {
    return (
      <View>
        <StatsSkeleton />
        <AppointmentSkeleton />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.branchCard, !profile?.branch_id && styles.branchCardMissing]}>
        <View style={styles.branchIcon}>
          <Ionicons name="business-outline" size={20} color={profile?.branch_id ? Colors.secondary : '#ef4444'} />
        </View>
        <View style={styles.branchInfo}>
          <Text style={styles.branchLabel}>Sucursal asignada</Text>
          <Text style={[styles.branchName, !profile?.branch_id && styles.branchNameMissing]} numberOfLines={1}>
            {branch?.name || (profile?.branch_id ? 'Cargando sucursal...' : 'Sin sucursal asignada')}
          </Text>
          {!!branch?.address && (
            <Text style={styles.branchAddress} numberOfLines={1}>{branch.address}</Text>
          )}
        </View>
      </View>

      <View style={styles.statsRow}>
        <TouchableOpacity style={styles.statCard} onPress={() => router.push('/(dashboard)/receptionist-ops')}>
          <Ionicons name="grid-outline" size={24} color={Colors.secondary} />
          <Text style={styles.statVal}>Operaciones</Text>
          <Text style={styles.statLab}>Sala y Cobros</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.statCard} onPress={() => router.push('/(dashboard)/catalog')}>
          <Ionicons name="calendar-outline" size={24} color="#10b981" />
          <Text style={styles.statVal}>Agendar</Text>
          <Text style={styles.statLab}>Nueva Cita</Text>
        </TouchableOpacity>

      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Vista Rápida de Hoy</Text>
        <TouchableOpacity onPress={() => router.push('/(dashboard)/receptionist-ops')}>
          <Text style={styles.viewAllText}>Gestionar todo</Text>
        </TouchableOpacity>
      </View>

      {appointmentsQuery.isLoading ? (
        <ActivityIndicator color={Colors.secondary} style={{ marginTop: 20 }} />
      ) : appointmentsQuery.data?.length ? (
        appointmentsQuery.data.slice(0, 3).map((apt: any) => (
          <TouchableOpacity key={apt.id} style={styles.ticketCard} onPress={() => router.push('/(dashboard)/receptionist-ops')}>
            <View style={styles.ticketLeft}>
               <Text style={styles.ticketDay}>{format(new Date(apt.start_time), 'dd')}</Text>
               <Text style={styles.ticketMonth}>{format(new Date(apt.start_time), 'MMM', { locale: es }).toUpperCase()}</Text>
            </View>
            <View style={styles.ticketDivider}>
               <View style={styles.ticketDotTop} />
               <View style={styles.ticketLine} />
               <View style={styles.ticketDotBottom} />
            </View>
            <View style={styles.ticketRight}>
               <View style={styles.ticketHeader}>
                  <Text style={styles.ticketTime}>{format(new Date(apt.start_time), 'HH:mm')} hrs</Text>
                  <View style={[styles.statusTag, { backgroundColor: apt.status === 'arrived' ? '#eff6ff' : apt.status === 'confirmed' ? '#dcfce7' : '#fef9c3' }]}>
                    <Text style={[styles.statusTagText, { color: apt.status === 'arrived' ? '#2563eb' : apt.status === 'confirmed' ? '#16a34a' : '#ca8a04' }]}>
                      {apt.status === 'arrived' ? 'En Sala' : apt.status === 'confirmed' ? 'Confirmada' : 'Programada'}
                    </Text>
                  </View>
               </View>
               <Text style={styles.ticketTitle} numberOfLines={1}>
                  {apt.counterparty?.first_name || 'Paciente'} {apt.counterparty?.last_name || ''}
               </Text>
               <Text style={styles.ticketSub}>Toca para gestionar cobranza o entrada</Text>
            </View>
          </TouchableOpacity>
        ))
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={40} color={Colors.textMuted} />
          <Text style={styles.emptyText}>No hay citas hoy</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  branchCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'white', padding: 14, borderRadius: BorderRadius.xl, ...Shadows.small, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  branchCardMissing: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  branchIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center' },
  branchInfo: { flex: 1 },
  branchLabel: { fontSize: 10, fontWeight: '900', color: Colors.textMuted, textTransform: 'uppercase' },
  branchName: { fontSize: 16, fontWeight: '900', color: Colors.primary, marginTop: 2 },
  branchNameMissing: { color: '#991b1b' },
  branchAddress: { fontSize: 12, fontWeight: '600', color: Colors.textMuted, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: 'white', padding: 12, borderRadius: BorderRadius.xl, ...Shadows.small, alignItems: 'center' },
  statVal: { fontSize: 13, fontWeight: '900', color: Colors.primary, marginTop: 8 },
  statLab: { fontSize: 9, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 20, fontWeight: '900', color: Colors.primary },
  viewAllText: { color: Colors.accent, fontWeight: '700', fontSize: 14 },
  ticketCard: { backgroundColor: 'white', borderRadius: BorderRadius.xl, ...Shadows.small, flexDirection: 'row', overflow: 'hidden', marginBottom: 12 },
  ticketLeft: { width: 70, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', gap: 2 },
  ticketDay: { fontSize: 24, fontWeight: '900', color: Colors.primary },
  ticketMonth: { fontSize: 10, fontWeight: '800', color: Colors.textMuted },
  ticketDivider: { width: 2, alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'white' },
  ticketLine: { flex: 1, width: 2, borderStyle: 'dashed', borderWidth: 1, borderColor: '#e2e8f0' },
  ticketDotTop: { width: 14, height: 14, borderRadius: 7, backgroundColor: Colors.background, marginTop: -7 },
  ticketDotBottom: { width: 14, height: 14, borderRadius: 7, backgroundColor: Colors.background, marginBottom: -7 },
  ticketRight: { flex: 1, padding: 16, gap: 4 },
  ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  ticketTime: { fontSize: 14, fontWeight: '800', color: Colors.secondary },
  statusTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  statusTagText: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  ticketTitle: { fontSize: 16, fontWeight: '800', color: Colors.primary },
  ticketSub: { fontSize: 11, color: Colors.textMuted },
  emptyState: { backgroundColor: 'white', padding: 32, borderRadius: BorderRadius.xxl, alignItems: 'center', gap: 16, borderStyle: 'dashed', borderWidth: 2, borderColor: '#e2e8f0' },
  emptyText: { fontSize: 16, color: Colors.textMuted, fontWeight: '700' },
});
