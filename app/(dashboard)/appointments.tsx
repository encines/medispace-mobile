import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, RefreshControl, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useState, useEffect } from 'react';
import Toast from 'react-native-toast-message';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../constants/theme';

export default function AppointmentsScreen() {
  const { user, roles } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const isDoctor = roles.includes('doctor');

  // Rating Modal state
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [selectedApt, setSelectedApt] = useState<any>(null);
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingComment, setRatingComment] = useState('');

  const { data: appointments, isLoading, refetch } = useQuery({
    queryKey: ['patient-appointments', user?.id],
    queryFn: async () => {
      let query = supabase
        .from('appointments')
        .select('*')
        .order('appointment_date', { ascending: false });

      if (isDoctor) {
        query = query.eq('doctor_id', user!.id);
      } else {
        query = query.eq('patient_id', user!.id);
      }

      const { data: appointmentsResponse, error } = await query;
      if (error) {
        console.error('Error fetching appointments:', error);
        return [];
      }

      if (!appointmentsResponse || appointmentsResponse.length === 0) return [];

      // Manual join with profiles
      // If doctor, we want patient profiles. If patient, we want doctor profiles.
      const profileIds = Array.from(new Set(appointmentsResponse.map(a => isDoctor ? a.patient_id : a.doctor_id)));
      
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, specialty, phone')
        .in('user_id', profileIds);

      // Manual join with ratings (to see if feedback already exists)
      const { data: existingRatings } = await supabase
        .from('ratings')
        .select('appointment_id, score')
        .in('appointment_id', appointmentsResponse.map(a => a.id));

      return appointmentsResponse.map(apt => ({
        ...apt,
        profiles: profiles?.find(p => p.user_id === (isDoctor ? apt.patient_id : apt.doctor_id)) || null,
        userRating: existingRatings?.find(r => r.appointment_id === apt.id) || null
      }));
    },
    enabled: !!user?.id,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Real-time updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('appointments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: isDoctor ? `doctor_id=eq.${user.id}` : `patient_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['patient-appointments', user.id] });
          queryClient.invalidateQueries({ queryKey: ['upcoming-appointments', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, isDoctor]);

  const sendRatingMutation = useMutation({
    mutationFn: async () => {
      if (!selectedApt) return;
      const { error } = await supabase.from('ratings').insert({
        appointment_id: selectedApt.id,
        patient_id: user?.id,
        doctor_id: selectedApt.doctor_id,
        score: ratingScore,
        comment: ratingComment
      });
      if (error) throw error;
    },
    onSuccess: () => {
      Toast.show({ type: 'success', text1: '¡Gracias!', text2: 'Tu reseña ha sido guardada.' });
      queryClient.invalidateQueries({ queryKey: ['patient-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['doctors-catalog'] });
      setRatingModalVisible(false);
      setRatingComment('');
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const openRatingModal = (apt: any) => {
    setSelectedApt(apt);
    setRatingScore(5);
    setRatingComment('');
    setRatingModalVisible(true);
  };
  const cancelMutation = useMutation({
    mutationFn: async ({ appointmentId, notes }: { appointmentId: string; notes?: string }) => {
      const { error } = await supabase
        .from('appointments')
        .update({ 
          status: 'cancelled' as any,
          notes: notes || 'Cancelada por el paciente'
        })
        .eq('id', appointmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Cita cancelada' });
      queryClient.invalidateQueries({ queryKey: ['patient-appointments'] });
    },
    onError: (err: any) => Toast.show({ type: 'error', text1: 'Error', text2: err.message }),
  });

  const isRefundable = (appointmentDate: string, startTime: string) => {
    const fullDate = new Date(`${appointmentDate}T${startTime}`);
    const now = new Date();
    // Reembolso permitido si faltan al menos 24 horas PARA el inicio
    const diffMs = fullDate.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    return diffHours >= 24;
  };

  const handleCancel = (apt: any) => {
    const refundable = isRefundable(apt.appointment_date, apt.start_time);
    
    if (refundable) {
      Alert.alert(
        '¿Confirmar cancelación?',
        'Faltan más de 24 horas. Se procesará tu reembolso completo automáticamente.',
        [
          { text: 'No, mantener cita', style: 'cancel' },
          { 
            text: 'Sí, cancelar y reembolsar', 
            style: 'destructive', 
            onPress: () => cancelMutation.mutate({ 
              appointmentId: apt.id, 
              notes: 'REEMBOLSO_100 - Cancelación con más de 24h' 
            }) 
          },
        ]
      );
    } else {
      Alert.alert(
        '⚠️ Aviso de Políticas',
        'Faltan menos de 24 horas para tu cita. Se retendrá el 50% del costo total por políticas de cancelación. Si pagaste el 100%, se te reembolsará la mitad restante. ¿Deseas continuar?',
        [
          { text: 'No, mantener cita', style: 'cancel' },
          { 
            text: 'Sí, cancelar con penalización', 
            style: 'destructive', 
            onPress: () => cancelMutation.mutate({ 
              appointmentId: apt.id, 
              notes: 'PENALIZACION_50 - Cancelación en menos de 24h' 
            }) 
          },
        ]
      );
    }
  };

  const statusMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const { error } = await supabase
        .from('appointments')
        .update({ status: status as any, notes: notes })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      Toast.show({ type: 'success', text1: `Cita ${variables.status}` });
      queryClient.invalidateQueries({ queryKey: ['patient-appointments'] });
    },
    onError: (err: any) => Toast.show({ type: 'error', text1: 'Error', text2: err.message }),
  });

  const isLate = (appointmentDate: string, startTime: string) => {
    const fullDate = new Date(`${appointmentDate}T${startTime}`);
    const now = new Date();
    const diffMs = now.getTime() - fullDate.getTime();
    const diffMins = diffMs / 60000;
    return diffMins > 30;
  };

  const getStatusInfo = (status: string, aptDate?: string, startTime?: string) => {
    if (status === 'confirmed' && aptDate && startTime && isLate(aptDate, startTime)) {
      return { label: 'Atrasada', color: '#ea580c', bg: '#ffedd5', icon: 'alert-circle' as const };
    }
    switch (status) {
      case 'confirmed': return { label: 'Confirmada', color: '#16a34a', bg: '#dcfce7', icon: 'checkmark-circle' as const };
      case 'scheduled': return { label: 'Programada', color: '#ca8a04', bg: '#fef9c3', icon: 'time' as const };
      case 'cancelled': return { label: 'Cancelada', color: '#dc2626', bg: '#fef2f2', icon: 'close-circle' as const };
      case 'completed': return { label: 'Completada', color: '#6b7280', bg: '#f3f4f6', icon: 'checkmark-done-circle' as const };
      default: return { label: status, color: '#6b7280', bg: '#f3f4f6', icon: 'help-circle' as const };
    }
  };

  const upcoming = appointments?.filter(a => ['scheduled', 'confirmed'].includes(a.status)) || [];
  const past = appointments?.filter(a => ['completed', 'cancelled'].includes(a.status)) || [];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.secondary]} />
        }
      >
        <Text style={styles.title}>Mis Citas</Text>

        {isLoading ? (
          <ActivityIndicator size="large" color={Colors.secondary} style={{ marginTop: Spacing.xxl }} />
        ) : (
          <>
            {/* Upcoming */}
            <Text style={styles.sectionTitle}>Próximas</Text>
            {upcoming.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={40} color={Colors.textMuted} />
                <Text style={styles.emptyText}>No tienes citas pendientes</Text>
              </View>
            ) : (
              upcoming.map((apt: any) => {
                const status = getStatusInfo(apt.status, apt.appointment_date, apt.start_time);
                const late = isLate(apt.appointment_date, apt.start_time);
                return (
                  <View key={apt.id} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View>
                        <Text style={styles.cardDate}>
                          {format(new Date(apt.appointment_date + 'T00:00:00'), "EEEE, d MMM", { locale: es })}
                        </Text>
                        <Text style={styles.cardTime}>{apt.start_time?.slice(0, 5)}</Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                        <Ionicons name={status.icon} size={14} color={status.color} />
                        <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                      </View>
                    </View>
                    <Text style={styles.cardDoctor}>
                      {isDoctor ? 'Paciente: ' : 'Dr. '}
                      {apt.profiles?.first_name} {apt.profiles?.last_name}
                    </Text>
                    {isDoctor && apt.profiles?.phone && (
                      <View style={styles.patientInfo}>
                         <Ionicons name="call-outline" size={12} color={Colors.textSecondary} />
                         <Text style={styles.cardSpecialty}>{apt.profiles.phone}</Text>
                      </View>
                    )}
                    {!isDoctor && apt.profiles?.specialty && (
                      <Text style={styles.cardSpecialty}>{apt.profiles.specialty}</Text>
                    )}
                    <View style={styles.cardActions}>
                      {isDoctor && ['scheduled', 'confirmed'].includes(apt.status) && (
                        <TouchableOpacity 
                          style={styles.attendBtn} 
                          onPress={() => router.push({
                            pathname: `/(dashboard)/records/${apt.patient_id}`,
                            params: { appointmentId: apt.id }
                          })}
                        >
                          <Ionicons name="medical" size={14} color="white" />
                          <Text style={styles.attendBtnText}>Atender Cita</Text>
                        </TouchableOpacity>
                      )}

                      {/* NO SHOW Button for staff/doctors if Late */}
                      {(isDoctor || roles.includes('receptionist')) && apt.status === 'confirmed' && late && (
                         <TouchableOpacity 
                          style={styles.noShowBtn} 
                          onPress={() => {
                            Alert.alert('No Show', '¿Marcar como No Show? Se aplicará la penalidad del 50%.', [
                              { text: 'Cancelar' },
                              { text: 'Confirmar', onPress: () => statusMutation.mutate({ id: apt.id, status: 'cancelled', notes: 'NO SHOW - Penalización 50% aplicada' }) }
                            ]);
                          }}
                        >
                          <Text style={styles.noShowText}>No Show</Text>
                        </TouchableOpacity>
                      )}
                      
                      <TouchableOpacity style={styles.cancelBtn} onPress={() => handleCancel(apt)}>
                        <Text style={styles.cancelBtnText}>Cancelar Cita</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}

            {/* Past */}
            {past.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: Spacing.lg }]}>Historial</Text>
                {past.map((apt: any) => {
                  const status = getStatusInfo(apt.status, apt.appointment_date, apt.start_time);
                  return (
                    <View key={apt.id} style={[styles.card, { opacity: 0.7 }]}>
                      <View style={styles.cardHeader}>
                        <Text style={styles.cardDate}>
                          {format(new Date(apt.appointment_date + 'T00:00:00'), "d MMM yyyy", { locale: es })}
                        </Text>
                        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                          <Ionicons name={status.icon} size={14} color={status.color} />
                          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                        </View>
                      </View>
                      <Text style={styles.cardDoctor}>
                        {isDoctor ? 'Paciente: ' : 'Dr. '}
                        {apt.profiles?.first_name} {apt.profiles?.last_name}
                      </Text>
                      <View style={styles.cardActions}>
                        {apt.status === 'cancelled' && (isDoctor || roles.includes('receptionist')) && (
                          <TouchableOpacity 
                            style={styles.rollbackBtn} 
                            onPress={() => statusMutation.mutate({ id: apt.id, status: 'confirmed', notes: 'Reactivada (Rollback)' })}
                          >
                            <Ionicons name="refresh" size={12} color="#2563eb" />
                            <Text style={styles.rollbackText}>Reactivar</Text>
                          </TouchableOpacity>
                        )}
                        {!isDoctor && apt.status === 'completed' && !apt.userRating && (
                          <TouchableOpacity style={styles.rateBtn} onPress={() => openRatingModal(apt)}>
                            <Ionicons name="star" size={14} color={Colors.secondary} />
                            <Text style={styles.rateBtnText}>Dejar Opinión</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      {!isDoctor && apt.userRating && (
                        <View style={styles.ratedBadge}>
                          <Text style={styles.ratedText}>Ya calificada ({apt.userRating.score}★)</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* Rating Modal */}
      <Modal visible={ratingModalVisible} transparent animationType="slide">
        <View style={styles.modalBg}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ width: '100%' }}
          >
            <View style={styles.modalContent}>
              <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
                <Text style={styles.modalTitle}>¿Cómo fue tu consulta?</Text>
                <Text style={styles.modalSub}>Tu opinión ayuda a otros pacientes y al Dr. {selectedApt?.profiles?.last_name}</Text>
                
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <TouchableOpacity key={s} onPress={() => setRatingScore(s)}>
                      <Ionicons name={s <= ratingScore ? "star" : "star-outline"} size={40} color={s <= ratingScore ? "#fbbf24" : Colors.textMuted} />
                    </TouchableOpacity>
                  ))}
                </View>

                <TextInput 
                  style={styles.commentInput}
                  placeholder="Escribe un comentario opcional..."
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  value={ratingComment}
                  onChangeText={setRatingComment}
                  numberOfLines={4}
                />

                <View style={styles.modalButtons}>
                  <TouchableOpacity style={styles.cancelLink} onPress={() => setRatingModalVisible(false)}>
                    <Text style={styles.cancelLinkText}>Ahora no</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.submitBtn} 
                    onPress={() => sendRatingMutation.mutate()}
                    disabled={sendRatingMutation.isPending}
                  >
                    {sendRatingMutation.isPending ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.submitBtnText}>Enviar Reseña</Text>}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg },
  title: { fontSize: FontSizes.xxl, fontWeight: '800', color: Colors.primary, marginBottom: Spacing.lg },
  sectionTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.primary, marginBottom: Spacing.md },
  card: {
    backgroundColor: Colors.surface, padding: Spacing.md, borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  cardDate: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase' },
  cardTime: { fontSize: FontSizes.xl, fontWeight: '800', color: Colors.primary },
  cardDoctor: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.text },
  patientInfo: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  cardSpecialty: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.full },
  statusText: { fontSize: FontSizes.xs, fontWeight: '700' },
  cancelBtn: { alignSelf: 'flex-start' },
  cancelBtnText: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.error },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.md },
  attendBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.secondary, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: BorderRadius.md, shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3,
  },
  attendBtnText: { color: 'white', fontSize: 13, fontWeight: '700' },
  noShowBtn: {
    backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#ffedd5',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: BorderRadius.md,
  },
  noShowText: { color: '#ea580c', fontSize: 12, fontWeight: '700' },
  rollbackBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#dbeafe',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: BorderRadius.md,
  },
  rollbackText: { color: '#2563eb', fontSize: 12, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.md },
  emptyText: { fontSize: FontSizes.md, color: Colors.textMuted },
  rateBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.sm, alignSelf: 'flex-start', backgroundColor: '#fdf4ff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: '#fae8ff' },
  rateBtnText: { fontSize: FontSizes.xs, fontWeight: '700', color: Colors.secondary },
  ratedBadge: { alignSelf: 'flex-start', marginTop: Spacing.sm, backgroundColor: '#f8fafc', paddingHorizontal: 8, paddingVertical: 4, borderRadius: BorderRadius.sm },
  ratedText: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase' },

  // Modal Styles
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: Spacing.xl },
  modalContent: { backgroundColor: 'white', borderRadius: BorderRadius.xl, padding: Spacing.xl, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20 },
  modalTitle: { fontSize: FontSizes.xl, fontWeight: '800', color: Colors.primary, textAlign: 'center', marginBottom: Spacing.xs },
  modalSub: { fontSize: FontSizes.sm, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.xl },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: Spacing.xl },
  commentInput: { backgroundColor: '#f8fafc', borderRadius: BorderRadius.lg, padding: Spacing.md, fontSize: FontSizes.md, color: Colors.text, height: 100, textAlignVertical: 'top', borderWidth: 1, borderColor: Colors.border },
  modalButtons: { flexDirection: 'row', marginTop: Spacing.xl, alignItems: 'center', gap: Spacing.lg },
  submitBtn: { flex: 2, backgroundColor: Colors.secondary, paddingVertical: 14, borderRadius: BorderRadius.lg, alignItems: 'center', shadowColor: Colors.secondary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  submitBtnText: { color: 'white', fontWeight: '800', fontSize: FontSizes.md },
  cancelLink: { flex: 1, alignItems: 'center' },
  cancelLinkText: { color: Colors.textMuted, fontWeight: '700', fontSize: FontSizes.sm },
});
