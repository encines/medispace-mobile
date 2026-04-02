import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { useUpcomingAppointments, useDoctorFeedback, useUpdateAppointmentStatus } from '../../hooks/useDashboardData';
import { StatsSkeletonWide, FeedbackSkeleton, AppointmentSkeleton } from './DashboardSkeletons';

export default function DoctorDashboard() {
  const router = useRouter();
  const appointmentsQuery = useUpcomingAppointments('doctor');
  const { data: reviews, isLoading: reviewsLoading } = useDoctorFeedback();
  const updateAptStatusMutation = useUpdateAppointmentStatus();

  if (appointmentsQuery.isLoading && !appointmentsQuery.data) {
    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        <StatsSkeletonWide />
        <FeedbackSkeleton />
        <AppointmentSkeleton />
      </ScrollView>
    );
  }

  const avgRating = reviews?.length
    ? (reviews.reduce((acc: number, r: any) => acc + r.score, 0) / reviews.length).toFixed(1)
    : '5.0';

  return (
    <View style={styles.container}>
      <View style={styles.statsRow}>
        <View style={styles.statCardWide}>
          <View style={styles.statInfo}>
             <Text style={styles.statNumber}>{appointmentsQuery.data?.length || 0}</Text>
             <Text style={styles.statLabel}>Citas para hoy</Text>
          </View>
          <View style={styles.statGraphPlaceholder}>
            <Ionicons name="calendar" size={40} color={Colors.secondary} opacity={0.2} />
          </View>
        </View>
      </View>

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
        ) : !reviews?.length ? (
          <View style={styles.emptyReviews}>
            <Text style={styles.emptyReviewsText}>Sin reseñas aún.</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reviewsList}>
            {reviews.map((rev: any) => (
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
                  {apt.counterparty?.first_name || 'Paciente'} {apt.counterparty?.last_name || ''}
               </Text>
               <Text style={styles.ticketSub}>Consulta Médica • Presencial</Text>
               
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
            </View>
          </TouchableOpacity>
        ))
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={40} color={Colors.textMuted} />
          <Text style={styles.emptyText}>No hay citas para hoy</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCardWide: { flex: 1, backgroundColor: 'white', padding: 24, borderRadius: BorderRadius.xxl, ...Shadows.medium, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statInfo: { gap: 4 },
  statNumber: { fontSize: 36, fontWeight: '900', color: Colors.primary },
  statLabel: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase' },
  statGraphPlaceholder: { padding: 10 },
  
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
  attendBtn: { 
    flexDirection: 'row', alignItems: 'center', gap: 6, 
    backgroundColor: Colors.secondary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
    marginTop: 8, alignSelf: 'flex-start',
    ...Shadows.small,
  },
  attendText: { color: 'white', fontSize: 12, fontWeight: '800' },

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
  
  emptyState: { backgroundColor: 'white', padding: 32, borderRadius: BorderRadius.xxl, alignItems: 'center', gap: 16, borderStyle: 'dashed', borderWidth: 2, borderColor: '#e2e8f0' },
  emptyText: { fontSize: 16, color: Colors.textMuted, fontWeight: '700' },
});
