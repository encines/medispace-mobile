import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, RefreshControl, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../constants/theme';

export default function AppointmentsScreen() {
  const { user, roles } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const isDoctor = roles.includes('doctor');
  const isReceptionist = roles.includes('receptionist');
  const isAdmin = roles.includes('admin');
  const isStaff = isReceptionist || isAdmin;

  // Rating Modal state
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [selectedApt, setSelectedApt] = useState<any>(null);
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [appointmentToCancel, setAppointmentToCancel] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [appointmentView, setAppointmentView] = useState<'active' | 'cancelled' | 'completed'>('active');

  const { data: appointments, isLoading, refetch } = useQuery({
    queryKey: ['patient-appointments', user?.id],
    queryFn: async () => {
      let query = supabase
        .from('appointments')
        .select('*')
        .order('start_time', { ascending: false });

      if (isDoctor) {
        query = query.eq('doctor_id', user!.id);
      } else if (isReceptionist) {
        const { data: receptionistProfile } = await supabase
          .from('profiles')
          .select('branch_id')
          .eq('id', user!.id)
          .single();

        if (!receptionistProfile?.branch_id) return [];

        const { data: branchOffices, error: officesError } = await supabase
          .from('offices')
          .select('id')
          .eq('branch_id', receptionistProfile.branch_id);

        if (officesError || !branchOffices?.length) return [];
        query = query.in('office_id', branchOffices.map(office => office.id));
      } else if (!isStaff) {
        query = query.eq('patient_id', user!.id);
      }

      const { data: appointmentsResponse, error } = await query;
      if (error) {
        console.error('Error fetching appointments:', error);
        return [];
      }

      if (!appointmentsResponse || appointmentsResponse.length === 0) return [];

      // Manual join with profiles and offices
      const profileIds = Array.from(new Set(appointmentsResponse.flatMap(a => [a.patient_id, a.doctor_id])));
      const officeIds = Array.from(new Set(appointmentsResponse.map(a => a.office_id).filter(Boolean)));
      
      const { data: usersResponse } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, phone, doctor_details(specialty)')
        .in('id', profileIds);

      const [officesResult, ratingsResult] = await Promise.all([
        supabase.from('offices').select('id, name, branches(name)').in('id', officeIds),
        supabase.from('ratings').select('appointment_id, score').in('appointment_id', appointmentsResponse.map(a => a.id))
      ]);

      const profilesData = (usersResponse || []).map(u => ({
        user_id: u.id,
        first_name: u.first_name,
        last_name: u.last_name,
        phone: u.phone,
        specialty: u.doctor_details?.[0]?.specialty
      })) || [];

      return appointmentsResponse.map(apt => ({
        ...apt,
        profiles: profilesData.find(p => p.user_id === (isDoctor ? apt.patient_id : apt.doctor_id)) || null,
        patient_profile: profilesData.find(p => p.user_id === apt.patient_id) || null,
        doctor_profile: profilesData.find(p => p.user_id === apt.doctor_id) || null,
        offices: officesResult.data?.find(o => o.id === apt.office_id) || null,
        userRating: ratingsResult.data?.find(r => r.appointment_id === apt.id) || null
      }));
    },
    enabled: !!user?.id,
  });

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

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
          filter: isStaff ? undefined : (isDoctor ? `doctor_id=eq.${user.id}` : `patient_id=eq.${user.id}`),
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
          status: 'cancelled',
          notes: notes || 'Cancelada por parte del paciente'
        })
        .eq('id', appointmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Cita cancelada' });
      queryClient.invalidateQueries({ queryKey: ['patient-appointments'] });
      setCancelModalVisible(false);
      setAppointmentToCancel(null);
      setCancelReason('');
    },
    onError: (err: any) => Toast.show({ type: 'error', text1: 'Error', text2: err.message }),
  });

  const isRefundable = (startTime: string) => {
    const fullDate = new Date(startTime);
    const now = new Date();
    // Reembolso permitido si faltan al menos 24 horas PARA el inicio
    const diffMs = fullDate.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    return diffHours >= 24;
  };

  const handleCancel = (apt: any) => {
    const refundable = isRefundable(apt.start_time);
    const patientName = apt.patient_profile ? `${apt.patient_profile.first_name} ${apt.patient_profile.last_name}` : 'del paciente';
    const requiresReason = isDoctor || isReceptionist || isAdmin;
    
    if (requiresReason) {
      setAppointmentToCancel(apt);
      setCancelReason('');
      setCancelModalVisible(true);
      return;
    }
    
    if (refundable) {
      Alert.alert(
        '¿Confirmar cancelación?',
        isStaff
          ? `Faltan más de 24 horas. Se procesará el reembolso completo de ${patientName} automáticamente.`
          : 'Faltan más de 24 horas. Se procesará tu reembolso completo automáticamente.',
        [
          { text: 'No, mantener cita', style: 'cancel' },
          { 
            text: 'Sí, cancelar y reembolsar', 
            style: 'destructive', 
            onPress: () => cancelMutation.mutate({ 
              appointmentId: apt.id, 
              notes: 'Cancelada por parte del paciente' 
            }) 
          },
        ]
      );
    } else {
      Alert.alert(
        '⚠️ Aviso de Políticas',
        isStaff
          ? `Faltan menos de 24 horas para la cita de ${patientName}. Se retendrá el 50% del costo total por políticas de cancelación. ¿Deseas continuar?`
          : 'Faltan menos de 24 horas para tu cita. Se retendrá el 50% del costo total por políticas de cancelación. Si pagaste el 100%, se te reembolsará la mitad restante. ¿Deseas continuar?',
        [
          { text: 'No, mantener cita', style: 'cancel' },
          { 
            text: 'Sí, cancelar con penalización', 
            style: 'destructive', 
            onPress: () => cancelMutation.mutate({ 
              appointmentId: apt.id, 
              notes: 'Cancelacion por parte del paciente en menos de 24hrs' 
            }) 
          },
        ]
      );
    }
  };

  const confirmStaffCancellation = () => {
    const reason = cancelReason.trim();
    if (!appointmentToCancel) return;
    if (!reason) {
      Toast.show({ type: 'error', text1: 'Motivo requerido', text2: 'Escribe por que se cancela la cita.' });
      return;
    }

    const cancelledBy = isDoctor ? 'doctor' : 'recepcionista';
    cancelMutation.mutate({
      appointmentId: appointmentToCancel.id,
      notes: `Cancelada por ${cancelledBy}. Motivo: ${reason}`
    });
  };

  const getCancellationReason = (notes?: string | null) => {
    if (!notes) return null;
    return notes.replace(/^PENALIZACION_50\s*-\s*/i, '').replace(/^REEMBOLSO_100\s*-\s*/i, '');
  };

  const statusMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const { error } = await supabase
        .from('appointments')
        .update({ status, notes })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      Toast.show({ type: 'success', text1: `Cita ${variables.status}` });
      queryClient.invalidateQueries({ queryKey: ['patient-appointments'] });
    },
    onError: (err: any) => Toast.show({ type: 'error', text1: 'Error', text2: err.message }),
  });

  const isLate = (startTime: string) => {
    const fullDate = new Date(startTime);
    const now = new Date();
    const diffMs = now.getTime() - fullDate.getTime();
    const diffMins = diffMs / 60000;
    return diffMins > 30;
  };

  const getStatusInfo = (status: string, startTime?: string) => {
    if (status === 'confirmed' && startTime && isLate(startTime)) {
      return { label: 'Atrasada', color: '#ea580c', bg: '#ffedd5', icon: 'alert-circle' as const };
    }
    switch (status) {
      case 'confirmed': return { label: 'Confirmada', color: '#16a34a', bg: '#dcfce7', icon: 'checkmark-circle' as const };
      case 'arrived': return { label: 'En Sala', color: '#2563eb', bg: '#eff6ff', icon: 'enter' as const };
      case 'scheduled': return { label: 'Programada', color: '#ca8a04', bg: '#fef9c3', icon: 'time' as const };
      case 'cancelled': return { label: 'Cancelada', color: '#dc2626', bg: '#fef2f2', icon: 'close-circle' as const };
      case 'completed': return { label: 'Completada', color: '#6b7280', bg: '#f3f4f6', icon: 'checkmark-done-circle' as const };
      default: return { label: status, color: '#6b7280', bg: '#f3f4f6', icon: 'help-circle' as const };
    }
  };

  const filteredAppointments = appointments?.filter(apt => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const patientName = `${apt.patient_profile?.first_name} ${apt.patient_profile?.last_name}`.toLowerCase();
    const doctorName = `${apt.doctor_profile?.first_name} ${apt.doctor_profile?.last_name}`.toLowerCase();
    return patientName.includes(q) || doctorName.includes(q);
  }) || [];

  const activeAppointments = (filteredAppointments.filter(a => ['scheduled', 'confirmed', 'arrived'].includes(a.status)) || [])
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  const cancelledAppointments = filteredAppointments.filter(a => a.status === 'cancelled') || [];
  const completedAppointments = filteredAppointments.filter(a => a.status === 'completed') || [];
  const historicalAppointments = appointmentView === 'cancelled' ? cancelledAppointments : completedAppointments;
  const appointmentViewOptions = [
    { key: 'active' as const, label: 'Programadas', count: activeAppointments.length },
    { key: 'cancelled' as const, label: 'Canceladas', count: cancelledAppointments.length },
    { key: 'completed' as const, label: 'Completadas', count: completedAppointments.length },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchHeader}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={Colors.textMuted} />
          <TextInput 
            style={styles.searchInput}
            placeholder="Buscar por paciente o doctor..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={Colors.textMuted}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.secondary]} />
        }
      >
        <Text style={styles.title}>{isStaff ? 'Citas' : 'Mis Citas'}</Text>
        <View style={styles.viewTabs}>
          {appointmentViewOptions.map(option => {
            const selected = appointmentView === option.key;
            return (
              <TouchableOpacity
                key={option.key}
                style={[styles.viewTab, selected && styles.viewTabActive]}
                onPress={() => setAppointmentView(option.key)}
              >
                <Text style={[styles.viewTabText, selected && styles.viewTabTextActive]}>
                  {option.label}
                </Text>
                <View style={[styles.viewTabCount, selected && styles.viewTabCountActive]}>
                  <Text style={[styles.viewTabCountText, selected && styles.viewTabCountTextActive]}>
                    {option.count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color={Colors.secondary} style={{ marginTop: Spacing.xxl }} />
        ) : (
          <>
            {/* Upcoming */}
            {appointmentView === 'active' && (
              <>
            <Text style={styles.sectionTitle}>Programadas / confirmadas</Text>
            {activeAppointments.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={40} color={Colors.textMuted} />
                <Text style={styles.emptyText}>{isStaff ? 'No hay citas pendientes' : 'No tienes citas pendientes'}</Text>
              </View>
            ) : (
              activeAppointments.map((apt: any) => {
                const status = getStatusInfo(apt.status, apt.start_time);
                const late = isLate(apt.start_time);
                return (
                  <View key={apt.id} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View>
                        <Text style={styles.cardDate}>
                          {format(new Date(apt.start_time), "EEEE, d MMM", { locale: es })}
                        </Text>
                        <Text style={styles.cardTime}>{format(new Date(apt.start_time), "HH:mm")} hrs</Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                        <Ionicons name={status.icon} size={14} color={status.color} />
                        <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                      </View>
                    </View>
                    <Text style={styles.cardDoctor}>
                      {isStaff ? (
                        `Paciente: ${apt.patient_profile?.first_name} ${apt.patient_profile?.last_name}`
                      ) : (
                        isDoctor ? `Paciente: ${apt.profiles?.first_name} ${apt.profiles?.last_name}` : `Dr. ${apt.profiles?.first_name} ${apt.profiles?.last_name}`
                      )}
                    </Text>
                    {isStaff && (
                      <Text style={[styles.cardSpecialty, { marginBottom: 4, color: Colors.secondary, fontWeight: '700' }]}>
                        Atiende: Dr. {apt.doctor_profile?.first_name} {apt.doctor_profile?.last_name}
                      </Text>
                    )}
                    {(isDoctor || isStaff) && apt.patient_profile?.phone && (
                      <View style={styles.patientInfo}>
                         <Ionicons name="call-outline" size={12} color={Colors.textSecondary} />
                         <Text style={styles.cardSpecialty}>{apt.patient_profile.phone}</Text>
                      </View>
                    )}
                    {!isDoctor && !isStaff && apt.profiles?.specialty && (
                      <Text style={styles.cardSpecialty}>{apt.profiles.specialty}</Text>
                    )}
                    
                    {apt.offices && (
                      <View style={styles.locationContainer}>
                        <Ionicons name="location-outline" size={14} color={Colors.secondary} />
                        <Text style={styles.locationText}>
                          {apt.offices.branches?.name} · {apt.offices.name}
                        </Text>
                      </View>
                    )}
                    <View style={styles.cardActions}>
                      {isDoctor && apt.status === 'arrived' && (
                        <TouchableOpacity 
                          style={styles.attendBtn} 
                          onPress={() => router.push(`/(dashboard)/records/${apt.patient_id}?appointmentId=${apt.id}`)}
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
              </>
            )}

            {/* Past */}
            {appointmentView !== 'active' && (
              <>
                <Text style={styles.sectionTitle}>{appointmentView === 'cancelled' ? 'Canceladas' : 'Completadas'}</Text>
                {historicalAppointments.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons name={appointmentView === 'cancelled' ? 'close-circle-outline' : 'checkmark-done-circle-outline'} size={40} color={Colors.textMuted} />
                    <Text style={styles.emptyText}>
                      {appointmentView === 'cancelled'
                        ? (isStaff ? 'No hay citas canceladas' : 'No tienes citas canceladas')
                        : (isStaff ? 'No hay citas completadas' : 'No tienes citas completadas')}
                    </Text>
                  </View>
                ) : historicalAppointments.map((apt: any) => {
                  const status = getStatusInfo(apt.status, apt.start_time);
                  const cancellationReason = apt.status === 'cancelled' ? getCancellationReason(apt.notes) : null;
                  return (
                    <View key={apt.id} style={[styles.card, { opacity: 0.7 }]}>
                      <View style={styles.cardHeader}>
                        <Text style={styles.cardDate}>
                          {format(new Date(apt.start_time), "d MMM yyyy", { locale: es })}
                        </Text>
                        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                          <Ionicons name={status.icon} size={14} color={status.color} />
                          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                        </View>
                      </View>
                      <Text style={styles.cardDoctor}>
                        {isStaff ? `Paciente: ${apt.patient_profile?.first_name} ${apt.patient_profile?.last_name}` : (
                          isDoctor ? 'Paciente: ' : 'Dr. '
                        )}
                        {!isStaff && `${apt.profiles?.first_name} ${apt.profiles?.last_name}`}
                      </Text>
                      {cancellationReason && (
                        <View style={styles.cancellationReason}>
                          <Ionicons name="information-circle-outline" size={14} color={Colors.error} />
                          <Text style={styles.cancellationReasonText}>{cancellationReason}</Text>
                        </View>
                      )}
                      {apt.status === 'cancelled' && (isDoctor || isStaff) && apt.patient_profile?.phone && (
                        <View style={styles.patientInfo}>
                          <Ionicons name="call-outline" size={12} color={Colors.textSecondary} />
                          <Text style={styles.cardSpecialty}>{apt.patient_profile.phone}</Text>
                        </View>
                      )}
                      {apt.status === 'cancelled' && !isDoctor && !isStaff && apt.offices?.branches?.name && (
                        <View style={styles.locationContainer}>
                          <Ionicons name="business-outline" size={14} color={Colors.secondary} />
                          <Text style={styles.locationText}>{apt.offices.branches.name}</Text>
                        </View>
                      )}
                      {isStaff && (
                        <>
                          <View style={styles.patientInfo}>
                            <Ionicons name="call-outline" size={12} color={Colors.textSecondary} />
                            <Text style={styles.cardSpecialty}>{apt.patient_profile?.phone || 'Sin teléfono'}</Text>
                          </View>
                          <Text style={[styles.cardSpecialty, { marginBottom: 4, color: Colors.secondary, fontWeight: '700' }]}>
                            Atiende: Dr. {apt.doctor_profile?.first_name} {apt.doctor_profile?.last_name}
                          </Text>
                          {apt.offices && (
                            <View style={styles.locationContainer}>
                              <Ionicons name="location-outline" size={14} color={Colors.secondary} />
                              <Text style={styles.locationText}>
                                {apt.offices.branches?.name} · {apt.offices.name}
                              </Text>
                            </View>
                          )}
                        </>
                      )}
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
                        {!isDoctor && !isStaff && apt.status === 'completed' && !apt.userRating && (
                          <TouchableOpacity style={styles.rateBtn} onPress={() => openRatingModal(apt)}>
                            <Ionicons name="star" size={14} color={Colors.secondary} />
                            <Text style={styles.rateBtnText}>Dejar Opinión</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      {!isDoctor && !isStaff && apt.userRating && (
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

      {/* Cancel Reason Modal */}
      <Modal visible={cancelModalVisible} transparent animationType="slide">
        <View style={styles.modalBg}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ width: '100%' }}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Motivo de cancelacion</Text>
              <Text style={styles.modalSub}>Indica por que se cancela la cita antes de confirmar.</Text>
              <TextInput 
                style={styles.commentInput}
                placeholder="Escribe el motivo..."
                placeholderTextColor={Colors.textMuted}
                multiline
                value={cancelReason}
                onChangeText={setCancelReason}
                numberOfLines={4}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={styles.cancelLink} 
                  onPress={() => {
                    setCancelModalVisible(false);
                    setAppointmentToCancel(null);
                    setCancelReason('');
                  }}
                >
                  <Text style={styles.cancelLinkText}>Volver</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.dangerSubmitBtn} 
                  onPress={confirmStaffCancellation}
                  disabled={cancelMutation.isPending}
                >
                  {cancelMutation.isPending ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.submitBtnText}>Cancelar cita</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

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
  viewTabs: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: BorderRadius.lg, padding: 4, marginBottom: Spacing.lg, gap: 4 },
  viewTab: { flex: 1, minHeight: 42, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, gap: 4 },
  viewTabActive: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  viewTabText: { fontSize: FontSizes.xs, fontWeight: '800', color: Colors.textMuted, textAlign: 'center' },
  viewTabTextActive: { color: Colors.primary },
  viewTabCount: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e2e8f0', paddingHorizontal: 6 },
  viewTabCountActive: { backgroundColor: Colors.secondary },
  viewTabCountText: { fontSize: 10, fontWeight: '800', color: Colors.textSecondary },
  viewTabCountTextActive: { color: 'white' },
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
  dangerSubmitBtn: { flex: 2, backgroundColor: Colors.error, paddingVertical: 14, borderRadius: BorderRadius.lg, alignItems: 'center', shadowColor: Colors.error, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  submitBtnText: { color: 'white', fontWeight: '800', fontSize: FontSizes.md },
  cancelLink: { flex: 1, alignItems: 'center' },
  cancelLinkText: { color: Colors.textMuted, fontWeight: '700', fontSize: FontSizes.sm },
  locationContainer: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: '#f0f9ff', padding: 8, borderRadius: 8, alignSelf: 'flex-start' },
  locationText: { fontSize: 12, fontWeight: '700', color: '#0369a1' },
  cancellationReason: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fee2e2', padding: 8, borderRadius: 8 },
  cancellationReasonText: { flex: 1, fontSize: 12, fontWeight: '700', color: Colors.error },
  
  // Search Styles
  searchHeader: { backgroundColor: 'white', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 12, paddingHorizontal: 12, height: 45, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.primary },
});
