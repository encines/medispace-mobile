import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Alert, Image, Dimensions, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, FontSizes, BorderRadius, Gradients, Shadows } from '../../constants/theme';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const { user, profile, roles, signOut } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const primaryRole = roles.includes('admin') ? 'admin'
    : roles.includes('doctor') ? 'doctor'
    : roles.includes('receptionist') ? 'receptionist'
    : 'patient';

  const isAdmin = primaryRole === 'admin';
  const isDoctor = primaryRole === 'doctor';

  // Doctor Ratings
  const { data: reviews, isLoading: reviewsLoading, refetch: refetchReviews } = useQuery({
    queryKey: ['my-reviews', user?.id],
    queryFn: async () => {
      if (!isDoctor || !user?.id) return [];
      const { data: ratings, error } = await supabase
        .from('ratings')
        .select('*')
        .eq('doctor_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      if (!ratings.length) return [];
      
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
    enabled: isDoctor && !!user?.id,
  });

  const avgRating = reviews?.length
    ? (reviews.reduce((acc: number, r: any) => acc + r.score, 0) / reviews.length).toFixed(1)
    : '5.0';

  // Stats for Admin
  const adminStatsQuery = useQuery({
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
    enabled: isAdmin,
  });

  // Appointments for Patient/Doctor
  const appointmentsQuery = useQuery({
    queryKey: ['upcoming-appointments', user?.id],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      let query = supabase
        .from('appointments')
        .select('*')
        .gte('appointment_date', today)
        .in('status', ['scheduled', 'confirmed'])
        .order('appointment_date', { ascending: true })
        .limit(5);

      if (primaryRole === 'patient') {
        query = query.eq('patient_id', user!.id);
      } else if (primaryRole === 'doctor') {
        query = query.eq('doctor_id', user!.id);
      }

      const { data: appointments, error } = await query;
      if (error) return [];

      if (!appointments || appointments.length === 0) return [];

      const targetIds = Array.from(new Set(appointments.map(a => primaryRole === 'patient' ? a.doctor_id : a.patient_id)));
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, avatar_url')
        .in('user_id', targetIds);

      return appointments.map(apt => ({
        ...apt,
        counterparty: profiles?.find(p => p.user_id === (primaryRole === 'patient' ? apt.doctor_id : apt.patient_id)) || null
      }));
    },
    enabled: !!user?.id && !isAdmin,
  });

  const updateAptStatusMutation = useMutation({
    mutationFn: async ({ id, status, patientId }: { id: string; status: string; patientId: string }) => {
      const { error } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
      return { id, patientId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['upcoming-appointments'] });
      router.push(`/(dashboard)/records/${data.patientId}?appointmentId=${data.id}`);
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    if (isAdmin) await adminStatsQuery.refetch();
    else await appointmentsQuery.refetch();
    setRefreshing(false);
  };

  const greeting = new Date().getHours() < 12 ? 'Buenos días' : new Date().getHours() < 18 ? 'Buenas tardes' : 'Buenas noches';

  const renderAdminDashboard = () => (
    <View style={styles.adminContainer}>
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <LinearGradient colors={['#eff6ff', '#dbeafe']} style={styles.statIconGradient}>
            <Ionicons name="medical" size={20} color="#3b82f6" />
          </LinearGradient>
          <Text style={styles.statVal}>{adminStatsQuery.data?.doctors || 0}</Text>
          <Text style={styles.statLab}>Médicos</Text>
        </View>
        <View style={styles.statCard}>
          <LinearGradient colors={['#f0fdf4', '#dcfce7']} style={styles.statIconGradient}>
            <Ionicons name="business" size={20} color="#16a34a" />
          </LinearGradient>
          <Text style={styles.statVal}>{adminStatsQuery.data?.branches || 0}</Text>
          <Text style={styles.statLab}>Sedes</Text>
        </View>
        <View style={styles.statCard}>
          <LinearGradient colors={['#faf5ff', '#f3e8ff']} style={styles.statIconGradient}>
            <Ionicons name="grid" size={20} color="#9333ea" />
          </LinearGradient>
          <Text style={styles.statVal}>{adminStatsQuery.data?.offices || 0}</Text>
          <Text style={styles.statLab}>Consul.</Text>
        </View>
      </View>

      <View style={styles.managementInfoCard}>
        <Ionicons name="information-circle-outline" size={20} color={Colors.secondary} />
        <Text style={styles.managementInfoText}>
          Toda la gestión operativa ahora se encuentra en la nueva pestaña de <Text style={{fontWeight: '800'}}>Gestión</Text>.
        </Text>
      </View>
    </View>
  );

  const renderGenericDashboard = () => (
    <>
      <View style={styles.statsRow}>
        <View style={styles.statCardWide}>
          <View style={styles.statInfo}>
             <Text style={styles.statNumber}>{appointmentsQuery.data?.length || 0}</Text>
             <Text style={styles.statLabel}>Citas Próximas</Text>
          </View>
          <View style={styles.statGraphPlaceholder}>
            <Ionicons name="stats-chart" size={40} color={Colors.secondary} opacity={0.2} />
          </View>
        </View>
      </View>

      {isDoctor && (
        <View style={styles.doctorRatingsSection}>
          <View style={styles.ratingsHeader}>
            <Text style={styles.sectionTitleSmall}>Mi Feedback</Text>
            <View style={styles.avgBadge}>
              <Ionicons name="star" size={12} color="#f59e0b" />
              <Text style={styles.avgBadgeText}>{avgRating}</Text>
            </View>
          </View>
          
          {reviewsLoading ? (
            <ActivityIndicator size="small" color={Colors.secondary} />
          ) : reviews?.length === 0 ? (
            <View style={styles.emptyReviews}>
              <Text style={styles.emptyReviewsText}>Sin reseñas aún.</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reviewsList}>
              {reviews?.map((rev: any) => (
                <View key={rev.id} style={styles.reviewCard}>
                  <View style={styles.reviewTop}>
                    <View style={styles.revPatient}>
                      <View style={styles.revAvatarPlaceholder}>
                        <Text style={styles.revAvatarTxt}>{rev.patient?.first_name?.[0]}</Text>
                      </View>
                      <Text style={styles.revName}>{rev.patient?.first_name}</Text>
                    </View>
                    <View style={styles.revStars}>
                      {[1, 2, 3, 4, 5].map(s => (
                        <Ionicons key={s} name="star" size={8} color={s <= rev.score ? "#fbbf24" : Colors.border} />
                      ))}
                    </View>
                  </View>
                  <Text style={styles.revComment} numberOfLines={2}>{rev.comment || 'Sin comentario.'}</Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Próximas Citas</Text>
        <TouchableOpacity onPress={() => router.push('/(dashboard)/appointments')}>
          <Text style={styles.viewAllText}>Ver todas</Text>
        </TouchableOpacity>
      </View>

      {appointmentsQuery.isLoading ? (
        <ActivityIndicator color={Colors.secondary} style={{ marginTop: 20 }} />
      ) : appointmentsQuery.data?.length ? (
        appointmentsQuery.data.map((apt: any) => (
          <TouchableOpacity key={apt.id} style={styles.ticketCard} onPress={() => router.push('/(dashboard)/appointments')}>
            <View style={styles.ticketLeft}>
               <Text style={styles.ticketDay}>{format(new Date(apt.appointment_date + 'T00:00:00'), 'dd')}</Text>
               <Text style={styles.ticketMonth}>{format(new Date(apt.appointment_date + 'T00:00:00'), 'MMM', { locale: es }).toUpperCase()}</Text>
            </View>
            <View style={styles.ticketDivider}>
               <View style={styles.ticketDotTop} />
               <View style={styles.ticketLine} />
               <View style={styles.ticketDotBottom} />
            </View>
            <View style={styles.ticketRight}>
               <View style={styles.ticketHeader}>
                  <Text style={styles.ticketTime}>{apt.start_time?.slice(0, 5)} hrs</Text>
                  <View style={[styles.statusTag, { backgroundColor: apt.status === 'confirmed' ? '#dcfce7' : '#fef9c3' }]}>
                    <Text style={[styles.statusTagText, { color: apt.status === 'confirmed' ? '#16a34a' : '#ca8a04' }]}>
                      {apt.status === 'confirmed' ? 'Confirmada' : 'Programada'}
                    </Text>
                  </View>
               </View>
               <Text style={styles.ticketTitle} numberOfLines={1}>
                  {primaryRole === 'patient' 
                    ? `Dr. ${apt.counterparty?.first_name || ''} ${apt.counterparty?.last_name || ''}`
                    : `${apt.counterparty?.first_name || 'Paciente'} ${apt.counterparty?.last_name || ''}`}
               </Text>
               <Text style={styles.ticketSub}>Consulta General • Consultorio 102</Text>
               
               {primaryRole === 'doctor' && (
                 <TouchableOpacity 
                   style={styles.attendBtn} 
                   onPress={(e) => {
                     e.stopPropagation();
                     updateAptStatusMutation.mutate({ id: apt.id, status: 'completed', patientId: apt.patient_id });
                   }}
                   disabled={updateAptStatusMutation.isPending}
                 >
                   <Ionicons name="checkmark-done-circle" size={16} color="white" />
                   <Text style={styles.attendText}>Atender</Text>
                 </TouchableOpacity>
               )}
            </View>
          </TouchableOpacity>
        ))
      ) : (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="calendar-outline" size={40} color={Colors.textMuted} />
          </View>
          <Text style={styles.emptyText}>Agenda libre hoy</Text>
          {primaryRole === 'patient' && (
            <TouchableOpacity style={styles.bookNowBtn} onPress={() => router.push('/(dashboard)/catalog')}>
              <Text style={styles.bookNowText}>Agendar una cita</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={Gradients.primary} style={styles.heroBackground}>
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>{greeting},</Text>
              <Text style={styles.userName}>{profile?.first_name || 'Usuario'}</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/(dashboard)/profile')} style={styles.profileBtn}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.profileImage} />
              ) : (
                <View style={styles.profilePlaceholder}>
                  <Ionicons name="person" size={24} color="white" />
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.heroAction}>
            <View style={styles.roleTag}>
              <Ionicons 
                name={isAdmin ? 'shield-checkmark' : primaryRole === 'doctor' ? 'medkit' : 'person'} 
                size={14} color="white" 
              />
              <Text style={styles.roleTagText}>
                {isAdmin ? 'ADMIN' : primaryRole === 'doctor' ? 'DOCTOR' : 'PACIENTE'}
              </Text>
            </View>
            {primaryRole === 'patient' && (
              <TouchableOpacity style={styles.heroBookBtn} onPress={() => router.push('/(dashboard)/catalog')}>
                <Text style={styles.heroBookText}>Agenda hoy</Text>
                <Ionicons name="arrow-forward" size={16} color={Colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.secondary} />}
      >
        {isAdmin ? renderAdminDashboard() : renderGenericDashboard()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  heroBackground: { paddingHorizontal: Spacing.lg, paddingBottom: 40, borderBottomLeftRadius: 40, borderBottomRightRadius: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  greeting: { fontSize: 16, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  userName: { fontSize: 32, fontWeight: '900', color: 'white', letterSpacing: -1 },
  profileBtn: { ...Shadows.medium },
  profileImage: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: 'white' },
  profilePlaceholder: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  
  heroAction: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 },
  roleTag: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.full },
  roleTagText: { color: 'white', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  heroBookBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'white', paddingHorizontal: 16, paddingVertical: 10, borderRadius: BorderRadius.full },
  heroBookText: { color: Colors.primary, fontSize: 14, fontWeight: '800' },

  scrollContent: { padding: Spacing.lg, paddingBottom: 100 },
  
  // Admin Styles
  adminContainer: { gap: Spacing.md },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: 'white', padding: 16, borderRadius: BorderRadius.xl, ...Shadows.small, alignItems: 'center' },
  statIconGradient: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statVal: { fontSize: 22, fontWeight: '900', color: Colors.primary },
  statLab: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase' },
  sectionTitle: { fontSize: 20, fontWeight: '900', color: Colors.primary, marginBottom: 16 },

  managementInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#eff6ff',
    padding: 16,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: '#dbeafe',
    marginTop: 20,
  },
  managementInfoText: {
    flex: 1,
    fontSize: 14,
    color: Colors.primary,
    lineHeight: 20,
    fontWeight: '500',
  },

  // Generic Styles
  statCardWide: { flex: 1, backgroundColor: 'white', padding: 24, borderRadius: BorderRadius.xxl, ...Shadows.medium, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statInfo: { gap: 4 },
  statNumber: { fontSize: 36, fontWeight: '900', color: Colors.primary },
  statLabel: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase' },
  statGraphPlaceholder: { padding: 10 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
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
  attendBtn: { 
    flexDirection: 'row', alignItems: 'center', gap: 6, 
    backgroundColor: Colors.secondary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
    marginTop: 8, alignSelf: 'flex-start',
    ...Shadows.small,
  },
  attendText: { color: 'white', fontSize: 12, fontWeight: '800' },

  emptyState: { backgroundColor: 'white', padding: 32, borderRadius: BorderRadius.xxl, alignItems: 'center', gap: 16, borderStyle: 'dashed', borderWidth: 2, borderColor: '#e2e8f0' },
  emptyIconContainer: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 16, color: Colors.textMuted, fontWeight: '700' },
  bookNowBtn: { backgroundColor: Colors.accentLight, paddingHorizontal: 20, paddingVertical: 10, borderRadius: BorderRadius.full },
  bookNowText: { color: Colors.accent, fontWeight: '800', fontSize: 14 },
  
  // Doctor Ratings Section
  doctorRatingsSection: { marginBottom: 24 },
  ratingsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitleSmall: { fontSize: 15, fontWeight: '900', color: Colors.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
  avgBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: BorderRadius.full },
  avgBadgeText: { fontSize: 12, fontWeight: '900', color: '#b45309' },
  emptyReviews: { backgroundColor: 'white', padding: 16, borderRadius: BorderRadius.xl, borderStyle: 'dashed', borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  emptyReviewsText: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  reviewsList: { gap: 10 },
  reviewCard: { width: 220, backgroundColor: 'white', padding: 12, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.border, ...Shadows.small },
  reviewTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  revPatient: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  revAvatarPlaceholder: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.secondaryLight, alignItems: 'center', justifyContent: 'center' },
  revAvatarTxt: { fontSize: 8, fontWeight: '900', color: Colors.secondary },
  revName: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  revStars: { flexDirection: 'row', gap: 1 },
  revComment: { fontSize: 10, color: Colors.textSecondary, lineHeight: 14 },
});
  
