import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, TextInput, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Toast from 'react-native-toast-message';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../../../hooks/useAuth';
import { supabase } from '../../../lib/supabase';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../../../constants/theme';

LocaleConfig.locales['es'] = {
  monthNames: ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  monthNamesShort: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'],
  dayNames: ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'],
  dayNamesShort: ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'],
  today: 'Hoy',
};
LocaleConfig.defaultLocale = 'es';

export default function BookAppointmentScreen() {
  const { doctorId } = useLocalSearchParams<{ doctorId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [paymentMode, setPaymentMode] = useState<'full' | 'half'>('full');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'spei' | 'oxxo'>('card');
  const [showVoucher, setShowVoucher] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Estados visuales de la tarjeta
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  const handleCardNumberChange = (text: string) => {
    let clean = text.replace(/\D/g, '');
    if (clean.length > 16) clean = clean.slice(0, 16);
    const formatted = clean.match(/.{1,4}/g)?.join(' ') || clean;
    setCardNumber(formatted);
  };

  const handleExpiryChange = (text: string) => {
    let clean = text.replace(/\D/g, '');
    if (clean.length > 4) clean = clean.slice(0, 4);
    let formatted = clean;
    if (clean.length > 2) formatted = clean.slice(0, 2) + '/' + clean.slice(2);
    setCardExpiry(formatted);
  };

  const { data: doctor } = useQuery({
    queryKey: ['doctor-profile', doctorId],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, first_name, last_name, specialty, consultation_fee, avatar_url').eq('user_id', doctorId).single();
      return data;
    },
    enabled: !!doctorId,
  });

  const fee = doctor?.consultation_fee || 0;
  const amountToPay = paymentMode === 'half' ? fee / 2 : fee;
  
  const { data: reviews } = useQuery({
    queryKey: ['doctor-reviews', doctorId],
    queryFn: async () => {
      const { data: ratings, error } = await supabase.from('ratings').select('*').eq('doctor_id', doctorId).order('created_at', { ascending: false });
      if (error) throw error;
      if (!ratings || ratings.length === 0) return [];
      
      const patientIds = Array.from(new Set(ratings.map(r => r.patient_id)));
      const { data: profiles } = await supabase.from('profiles').select('user_id, first_name, last_name, avatar_url').in('user_id', patientIds);
        
      return ratings.map(r => ({
        ...r,
        patient: profiles?.find(p => p.user_id === r.patient_id) || { first_name: 'Paciente', last_name: 'Verificado' }
      }));
    },
    enabled: !!doctorId,
  });

  const avgRating = reviews?.length ? (reviews.reduce((acc, r) => acc + r.score, 0) / reviews.length).toFixed(1) : '5.0';

  const lockMutation = useMutation({
    mutationFn: async (slot: any) => {
      if (!user || !selectedDate || !slot) return;
      await supabase.from('slot_locks').delete().eq('locked_by', user.id);
      const { error } = await supabase.from('slot_locks').insert({
        doctor_id: doctorId,
        appointment_date: selectedDate,
        start_time: slot.start + ':00',
        locked_by: user.id,
        expires_at: new Date(Date.now() + 10 * 60000).toISOString(),
      });
      if (error) throw error;
    },
    onError: () => Toast.show({ type: 'error', text1: 'Slot ocupado o bloqueado', text2: 'Intenta con otro horario.' }),
  });

  const { data: activeLocks } = useQuery({
    queryKey: ['slot-locks', doctorId, selectedDate],
    queryFn: async () => {
      const { data } = await supabase.from('slot_locks').select('start_time, locked_by').eq('doctor_id', doctorId).eq('appointment_date', selectedDate).gt('expires_at', new Date().toISOString());
      return data || [];
    },
    enabled: !!selectedDate,
    refetchInterval: 5000,
  });

  const { data: existingAppointments } = useQuery({
    queryKey: ['existing-appointments', doctorId, selectedDate],
    queryFn: async () => {
      const { data } = await supabase.from('appointments').select('start_time, status').eq('doctor_id', doctorId).eq('appointment_date', selectedDate).in('status', ['scheduled', 'confirmed']);
      return data || [];
    },
    enabled: !!selectedDate,
  });

  const { data: patientDayAppointments } = useQuery({
    queryKey: ['patient-day-appointments', user?.id, selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase.from('appointments').select('doctor_id, start_time').eq('patient_id', user!.id).eq('appointment_date', selectedDate).in('status', ['scheduled', 'confirmed']);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && !!selectedDate,
  });

  const hasAppointmentWithSameDoctorToday = patientDayAppointments?.some(apt => apt.doctor_id === doctorId);
  const isTimeSlotBookedByPatient = (timeString: string) => patientDayAppointments?.some(apt => apt.start_time.slice(0, 5) === timeString);

  const dayOfWeek = selectedDate ? new Date(selectedDate + 'T12:00:00').getDay() : -1;
  const { data: assignments } = useQuery({
    queryKey: ['doctor-assignments', doctorId, dayOfWeek],
    queryFn: async () => {
      const { data } = await supabase.from('doctor_assignments').select('*, offices(id, name, status, branches(id, name, status))').eq('doctor_id', doctorId).eq('day_of_week', dayOfWeek);
      return data || [];
    },
    enabled: dayOfWeek >= 0,
  });

  const slots = useMemo(() => {
    if (!assignments?.length) return [];
    const generatedSlots: { start: string; end: string; office: any; isMorning: boolean }[] = [];
    for (const a of assignments) {
      let [sh, sm] = a.start_time.split(':').map(Number);
      const [eh, em] = a.end_time.split(':').map(Number);
      while (sh < eh || (sh === eh && sm < em)) {
        const start = `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}`;
        const isMorning = sh < 12;
        let nextSm = sm + 30;
        let nextSh = sh;
        if (nextSm >= 60) { nextSh += 1; nextSm -= 60; }
        const end = `${String(nextSh).padStart(2, '0')}:${String(nextSm).padStart(2, '0')}`;
        
        const isTaken = existingAppointments?.some(e => e.start_time.slice(0, 5) === start);
        const isLocked = activeLocks?.some(l => l.start_time.slice(0, 5) === start && l.locked_by !== user?.id);
        const isOfficeActive = a.offices?.status === 'active';
        const isBranchActive = a.offices?.branches?.status === 'active';

        if (!isTaken && !isLocked && isOfficeActive && isBranchActive) {
          generatedSlots.push({ start, end, office: a.offices, isMorning });
        }
        sm = nextSm; sh = nextSh;
      }
    }
    return generatedSlots;
  }, [assignments, existingAppointments, activeLocks, user?.id]);

  const morningSlots = slots.filter(s => s.isMorning);
  const afternoonSlots = slots.filter(s => !s.isMorning);

  const bookMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSlot || !selectedDate || !user) throw new Error('Faltan datos');
      
      if (paymentMethod === 'card') {
        if (cardNumber.length < 19 || cardExpiry.length < 5 || cardCvv.length < 3) {
          throw new Error('Completa los datos de la tarjeta');
        }
        // Simulación visual de proceso bancario de 2 segundos
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      const reference = `MS-${user.id.slice(0, 4).toUpperCase()}-${Date.now().toString().slice(-4)}`;
      const { error } = await supabase.from('appointments').insert({
        patient_id: user.id,
        doctor_id: doctorId,
        office_id: selectedSlot.office.id,
        appointment_date: selectedDate,
        start_time: selectedSlot.start + ':00',
        end_time: selectedSlot.end + ':00',
        status: (paymentMethod === 'card' ? 'confirmed' : 'scheduled') as any,
        payment_amount: amountToPay,
        payment_type: paymentMode === 'half' ? 'deposit' : 'full',
        payment_method: paymentMethod,
        payment_reference: reference,
        notes: `${paymentMode === 'half' ? '[ANTICIPO 50%]' : '[PAGO TOTAL]'} - Ref: ${reference}`,
      });
      
      if (error) throw error;
      await supabase.from('slot_locks').delete().eq('locked_by', user.id);
    },
    onSuccess: () => {
      // ESTA ES LA MAGIA: Le decimos a la app que borre su memoria y vuelva a descargar las citas
      queryClient.invalidateQueries({ queryKey: ['upcoming-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['patient-day-appointments'] });

      if (paymentMethod === 'card') {
        Toast.show({ type: 'success', text1: '¡Cita confirmada!', text2: 'Tu pago con tarjeta ha sido exitoso.' });
        router.push('/(dashboard)/home');
      } else {
        setShowVoucher(true);
      }
    },
    onError: (err: any) => Toast.show({ type: 'error', text1: 'Error', text2: err.message }),
  });

  const handleDownloadPDF = async () => {
    setIsGeneratingPdf(true);
    try {
      const html = `<html><head><style>body { font-family: 'Helvetica', sans-serif; padding: 40px; color: #1e293b; } .header { text-align: center; margin-bottom: 40px; } .logo { font-size: 28px; font-weight: bold; color: #0ea5e9; } .card { border: 1px solid #e2e8f0; border-radius: 20px; padding: 30px; background: #fff; } .title { font-size: 20px; font-weight: bold; margin-bottom: 10px; text-align: center; } .subtitle { font-size: 14px; color: #64748b; margin-bottom: 30px; text-align: center; } .label { font-size: 11px; color: #94a3b8; text-transform: uppercase; margin-bottom: 3px; } .value { font-size: 16px; font-weight: 600; margin-bottom: 15px; } .amount-box { background: #f8fafc; padding: 20px; border-radius: 15px; text-align: center; margin: 20px 0; border: 1px solid #f1f5f9; } .amount { font-size: 32px; font-weight: 800; color: #0f172a; } .bank-info { background: #eff6ff; padding: 20px; border-radius: 15px; border: 1px solid #dbeafe; } .info-title { font-size: 12px; font-weight: 800; color: #2563eb; margin-bottom: 10px; }</style></head><body><div class="header"><div class="logo">MediSpace</div><div style="font-size: 12px; color: #64748b;">EXPEDIENTE Y SALUD DIGITAL</div></div><div class="card"><div class="title">Ficha de Pago ${paymentMethod.toUpperCase()}</div><div class="subtitle">Orden de pago generada correctamente</div><div class="label">Paciente:</div> <div class="value">${user?.email}</div><div class="label">Doctor(a):</div> <div class="value">Dr. ${doctor?.first_name} ${doctor?.last_name}</div><div class="label">Fecha de Cita:</div> <div class="value">${format(new Date(selectedDate + 'T12:00:00'), "EEEE, d 'de' MMMM, yyyy", { locale: es })}</div><div class="amount-box"><div class="label">Monto a pagar</div><div class="amount">$${amountToPay.toFixed(2)} MXN</div></div><div class="bank-info"><div class="info-title">DATOS PARA EL PAGO</div>${paymentMethod === 'spei' ? `<div class="label">Institución:</div><div class="value">BBVA México</div><div class="label">CLABE:</div><div class="value">0123 4567 8901 2345 67</div><div class="label">Referencia:</div><div class="value">MS-${user?.id.slice(0, 4).toUpperCase()}</div>` : `<div class="label">Identificador OXXO Pay:</div><div class="value">5432 1098 7654 3210</div><div style="font-size: 11px; color: #64748b; margin-top: 10px;">Acude a un OXXO y dicta estos dígitos al cajero.</div>`}</div></div></body></html>`;
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri);
    } catch (e) {
      Alert.alert('Error', 'No se pudo generar el PDF.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const markedDates: any = {};
  if (selectedDate) markedDates[selectedDate] = { selected: true, selectedColor: Colors.secondary };

  const formatTime12h = (time24: string) => {
    const h = Number(time24.slice(0, 2));
    const m = time24.slice(3);
    if (h === 0) return `12:${m} AM`;
    if (h < 12) return `${h}:${m} AM`;
    if (h === 12) return `12:${m} PM`;
    return `${h - 12}:${m} PM`;
  };

  if (showVoucher) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.voucherContainer}>
          <View style={styles.voucherCard}>
            <Ionicons name="checkmark-circle" size={80} color="#16a34a" />
            <Text style={styles.voucherTitle}>¡Reserva Lista!</Text>
            <Text style={styles.voucherSubtitle}>Tu espacio está apartado</Text>
            <View style={styles.voucherDivider} />
            <Text style={styles.voucherLabel}>Monto a pagar:</Text>
            <Text style={styles.voucherAmount}>${amountToPay.toFixed(2)} MXN</Text>
            {paymentMethod === 'spei' ? (
              <View style={styles.voucherInfo}>
                <Text style={styles.infoTitle}>TRANSFERENCIA SPEI</Text>
                <Text style={styles.infoLabel}>CLABE:</Text>
                <Text style={styles.infoValue}>0123 4567 8901 2345 67</Text>
                <Text style={styles.infoLabel}>Referencia:</Text>
                <Text style={styles.infoValue}>MS-{user?.id.slice(0, 4).toUpperCase()}</Text>
              </View>
            ) : (
              <View style={styles.voucherInfo}>
                <Text style={styles.infoTitle}>PAGO EN OXXO</Text>
                <View style={styles.barcodePlaceholder}>
                  <Ionicons name="barcode-outline" size={60} color="#444" />
                  <Text style={styles.infoValue}>5432 1098 7654 3210</Text>
                </View>
              </View>
            )}
            <View style={styles.voucherActions}>
              <TouchableOpacity style={styles.downloadBtn} onPress={handleDownloadPDF} disabled={isGeneratingPdf}>
                {isGeneratingPdf ? <ActivityIndicator color="white" /> : (
                  <><Ionicons name="download-outline" size={20} color="white" /><Text style={styles.downloadBtnText}>Descargar PDF</Text></>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.voucherBtn} onPress={() => router.replace('/(dashboard)/home')}>
                <Text style={styles.voucherBtnText}>Finalizar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Ionicons name="arrow-back" size={24} color={Colors.primary} /></TouchableOpacity>
          <View style={styles.headerInfo}>
            {doctor?.avatar_url ? (
              <Image source={{ uri: doctor.avatar_url }} style={styles.doctorAvatar} />
            ) : (
              <View style={styles.doctorAvatarPlaceholder}><Ionicons name="person" size={20} color={Colors.textMuted} /></View>
            )}
            <View>
              <Text style={styles.headerSubtitle}>AGENDAR CITA</Text>
              <Text style={styles.headerTitle}>Dr. {doctor?.first_name} {doctor?.last_name}</Text>
              <View style={styles.ratingSummary}>
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={16} color="#fbbf24" />
                  <Text style={styles.avgRatingText}>{avgRating}</Text>
                  <Text style={styles.totalReviewsText}>({reviews?.length || 0} reseñas)</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {reviews && reviews.length > 0 && (
          <View style={styles.reviewsListSection}>
            <Text style={styles.sectionTitleSmall}>Opiniones de pacientes</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reviewsScroll}>
              {reviews.map((rev: any) => (
                <View key={rev.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewAvatar}>
                       {rev.patient?.avatar_url ? (
                         <Image source={{ uri: rev.patient.avatar_url }} style={styles.reviewAvatarImg} />
                       ) : (
                         <Text style={styles.reviewAvatarTxt}>{rev.patient?.first_name?.[0]}</Text>
                       )}
                    </View>
                    <View>
                      <Text style={styles.reviewName}>{rev.patient?.first_name} {rev.patient?.last_name?.[0]}.</Text>
                      <View style={styles.reviewStars}>
                        {[1, 2, 3, 4, 5].map(s => <Ionicons key={s} name="star" size={10} color={s <= rev.score ? "#fbbf24" : Colors.border} />)}
                      </View>
                    </View>
                  </View>
                  <Text style={styles.reviewComment} numberOfLines={3}>{rev.comment || 'Sin comentario.'}</Text>
                  <Text style={styles.reviewDate}>{format(new Date(rev.created_at), 'd MMM yyyy', { locale: es })}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.calendarContainer}>
          <Calendar
            onDayPress={day => { setSelectedDate(day.dateString); setSelectedSlot(null); }}
            markedDates={markedDates}
            minDate={format(new Date(), 'yyyy-MM-dd')}
            theme={{ todayTextColor: Colors.secondary, selectedDayBackgroundColor: Colors.secondary, arrowColor: Colors.primary }}
          />
        </View>

        {selectedDate && (
          <View style={styles.slotsSection}>
            {hasAppointmentWithSameDoctorToday ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={24} color={Colors.error} />
                <Text style={styles.errorText}>Ya tienes una cita programada con este especialista para este día.</Text>
              </View>
            ) : slots.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={48} color={Colors.textMuted} />
                <Text style={styles.emptyText}>Sin horarios disponibles</Text>
              </View>
            ) : (
              <>
                {morningSlots.length > 0 && (
                  <View style={styles.slotGroup}>
                    <View style={styles.slotGroupHeader}><Ionicons name="sunny" size={20} color={Colors.secondary} /><Text style={styles.slotGroupTitle}>Mañana</Text></View>
                    <View style={styles.slotGrid}>
                      {morningSlots.map((slot, i) => {
                        const isBookedByMe = isTimeSlotBookedByPatient(slot.start);
                        return (
                          <TouchableOpacity 
                            key={i} 
                            style={[styles.slotBtn, selectedSlot?.start === slot.start && styles.slotSelected, isBookedByMe && styles.timeBtnDisabled]} 
                            onPress={() => { setSelectedSlot(slot); lockMutation.mutate(slot); }}
                            disabled={isBookedByMe}
                          >
                            <Text style={[styles.slotText, selectedSlot?.start === slot.start && styles.slotTextSelected, isBookedByMe && styles.timeTextDisabled]}>{formatTime12h(slot.start)}</Text>
                            <View style={styles.slotLocationRow}>
                              <Ionicons name="business-outline" size={10} color={Colors.textMuted} />
                              <Text style={styles.slotLocationText} numberOfLines={1}>{slot.office?.branches?.name} - {slot.office?.name}</Text>
                            </View>
                            {isBookedByMe && <Text style={styles.bookedWarning}>Tu horario choca</Text>}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}
                {afternoonSlots.length > 0 && (
                  <View style={styles.slotGroup}>
                    <View style={styles.slotGroupHeader}><Ionicons name="moon" size={20} color={Colors.primary} /><Text style={styles.slotGroupTitle}>Tarde</Text></View>
                    <View style={styles.slotGrid}>
                      {afternoonSlots.map((slot, i) => {
                        const isBookedByMe = isTimeSlotBookedByPatient(slot.start);
                        return (
                          <TouchableOpacity 
                            key={i} 
                            style={[styles.slotBtn, selectedSlot?.start === slot.start && styles.slotSelected, isBookedByMe && styles.timeBtnDisabled]} 
                            onPress={() => { setSelectedSlot(slot); lockMutation.mutate(slot); }}
                            disabled={isBookedByMe}
                          >
                            <Text style={[styles.slotText, selectedSlot?.start === slot.start && styles.slotTextSelected, isBookedByMe && styles.timeTextDisabled]}>{formatTime12h(slot.start)}</Text>
                            <View style={styles.slotLocationRow}>
                              <Ionicons name="business-outline" size={10} color={Colors.textMuted} />
                              <Text style={styles.slotLocationText} numberOfLines={1}>{slot.office?.branches?.name} - {slot.office?.name}</Text>
                            </View>
                            {isBookedByMe && <Text style={styles.bookedWarning}>Tu horario choca</Text>}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {selectedSlot && (
          <View style={styles.summary}>
            <Text style={styles.summaryLabel}>RESUMEN</Text>
            <Text style={styles.summaryDate}>{format(new Date(selectedDate + 'T12:00:00'), "EEEE, d 'de' MMMM", { locale: es })} • {formatTime12h(selectedSlot.start)}</Text>
            {fee > 0 && (
              <View style={styles.paymentContainer}>
                <Text style={styles.paymentTitle}>Monto</Text>
                <View style={styles.modeRow}>
                  <TouchableOpacity style={[styles.modeBtn, paymentMode === 'full' && styles.modeActive]} onPress={() => setPaymentMode('full')}>
                    <Text style={[styles.modeText, paymentMode === 'full' && styles.modeActiveText]}>Total</Text>
                    <Text style={[styles.modePrice, paymentMode === 'full' && { color: 'white' }]}>${fee.toFixed(2)}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modeBtn, paymentMode === 'half' && styles.modeActiveGreen]} onPress={() => setPaymentMode('half')}>
                    <Text style={[styles.modeText, paymentMode === 'half' && styles.modeActiveText]}>Anticipo</Text>
                    <Text style={[styles.modePrice, paymentMode === 'half' && { color: 'white' }]}>${(fee / 2).toFixed(2)}</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.paymentTitle, { marginTop: 24 }]}>Método</Text>
                <View style={styles.methodList}>
                  <TouchableOpacity style={[styles.methodCard, paymentMethod === 'card' && styles.methodActive]} onPress={() => setPaymentMethod('card')}>
                    <Ionicons name="card" size={24} color={paymentMethod === 'card' ? 'white' : '#64748b'} /><Text style={[styles.methodLabel, paymentMethod === 'card' && styles.methodLabelActive]}>Tarjeta</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.methodCard, paymentMethod === 'spei' && styles.methodActivePurple]} onPress={() => setPaymentMethod('spei')}>
                    <Ionicons name="swap-horizontal" size={24} color={paymentMethod === 'spei' ? 'white' : '#64748b'} /><Text style={[styles.methodLabel, paymentMethod === 'spei' && styles.methodLabelActive]}>SPEI</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.methodCard, paymentMethod === 'oxxo' && styles.methodActiveRed]} onPress={() => setPaymentMethod('oxxo')}>
                    <Ionicons name="storefront" size={24} color={paymentMethod === 'oxxo' ? 'white' : '#64748b'} /><Text style={[styles.methodLabel, paymentMethod === 'oxxo' && styles.methodLabelActive]}>OXXO</Text>
                  </TouchableOpacity>
                </View>

                {paymentMethod === 'card' && (
                  <View style={styles.cardForm}>
                    <Text style={styles.cardFormTitle}>Datos de tu Tarjeta</Text>
                    
                    <View style={styles.inputContainer}>
                      <Text style={styles.inputLabel}>Número de Tarjeta</Text>
                      <View style={styles.inputWrapper}>
                        <Ionicons name="card-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
                        <TextInput
                          style={styles.input}
                          placeholder="0000 0000 0000 0000"
                          keyboardType="numeric"
                          value={cardNumber}
                          onChangeText={handleCardNumberChange}
                          maxLength={19}
                        />
                      </View>
                    </View>

                    <View style={styles.inputRow}>
                      <View style={[styles.inputContainer, { flex: 1 }]}>
                        <Text style={styles.inputLabel}>Vencimiento</Text>
                        <View style={styles.inputWrapper}>
                          <TextInput 
                            style={styles.input} 
                            placeholder="MM/YY" 
                            keyboardType="numeric" 
                            value={cardExpiry} 
                            onChangeText={handleExpiryChange} 
                            maxLength={5} 
                          />
                        </View>
                      </View>
                      
                      <View style={[styles.inputContainer, { flex: 1 }]}>
                        <Text style={styles.inputLabel}>CVC</Text>
                        <View style={styles.inputWrapper}>
                          <TextInput 
                            style={styles.input} 
                            placeholder="123" 
                            keyboardType="numeric" 
                            value={cardCvv} 
                            onChangeText={(text) => setCardCvv(text.replace(/\D/g, ''))} 
                            maxLength={4} 
                            secureTextEntry 
                          />
                        </View>
                      </View>
                    </View>

                  </View>
                )}
              </View>
            )}
            <TouchableOpacity style={[styles.confirmBtn, bookMutation.isPending && { opacity: 0.6 }]} onPress={() => bookMutation.mutate()} disabled={bookMutation.isPending}>
              {bookMutation.isPending ? <ActivityIndicator color="white" /> : <Text style={styles.confirmBtnText}>Confirmar (${amountToPay.toFixed(2)})</Text>}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingBottom: 100 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.lg },
  headerInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: Spacing.md },
  doctorAvatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: '#e2e8f0' },
  doctorAvatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  backBtn: { padding: Spacing.sm, marginRight: Spacing.xs },
  headerSubtitle: { fontSize: FontSizes.xs, fontWeight: '800', color: Colors.secondary, letterSpacing: 2 },
  headerTitle: { fontSize: FontSizes.xl, fontWeight: '800', color: Colors.primary },
  calendarContainer: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.lg },
  slotsSection: { marginBottom: Spacing.lg },
  slotGroup: { marginBottom: Spacing.lg },
  slotGroupHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  slotGroupTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.primary },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  slotBtn: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, width: '48%', alignItems: 'center' },
  slotSelected: { borderColor: Colors.secondary, backgroundColor: Colors.secondaryLight, borderWidth: 2 },
  slotText: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.textSecondary },
  slotTextSelected: { color: Colors.secondary, fontWeight: '800' },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.md },
  emptyText: { fontSize: FontSizes.md, color: Colors.textMuted, textAlign: 'center' },
  summary: { borderTopWidth: 1, borderColor: Colors.border, paddingTop: Spacing.lg },
  summaryLabel: { fontSize: FontSizes.xs, fontWeight: '800', color: Colors.textMuted, letterSpacing: 2, marginBottom: Spacing.xs },
  summaryDate: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.primary, marginBottom: Spacing.lg },
  paymentContainer: { backgroundColor: Colors.surface, padding: Spacing.lg, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.xl },
  paymentTitle: { fontSize: FontSizes.md, fontWeight: '800', color: Colors.primary, marginBottom: Spacing.md },
  modeRow: { flexDirection: 'row', gap: Spacing.md },
  modeBtn: { flex: 1, padding: 12, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  modeActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  modeActiveGreen: { backgroundColor: Colors.secondary, borderColor: Colors.secondary },
  modeText: { fontSize: 12, color: Colors.textMuted, fontWeight: '700', marginBottom: 4 },
  modeActiveText: { color: 'white' },
  modePrice: { fontSize: 16, fontWeight: '800', color: Colors.primary },
  methodList: { flexDirection: 'row', gap: Spacing.sm, marginBottom: 20 },
  methodCard: { flex: 1, paddingVertical: 16, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', gap: 8 },
  methodActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  methodActivePurple: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  methodActiveRed: { backgroundColor: '#ef4444', borderColor: '#ef4444' },
  methodLabel: { fontSize: 11, fontWeight: '800', color: Colors.textMuted },
  methodLabelActive: { color: 'white' },
  confirmBtn: { backgroundColor: Colors.secondary, paddingVertical: 18, borderRadius: BorderRadius.full, alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontWeight: '800', fontSize: FontSizes.lg },
  voucherContainer: { padding: Spacing.xl, flexGrow: 1, justifyContent: 'center' },
  voucherCard: { backgroundColor: 'white', borderRadius: 32, padding: Spacing.xl, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  voucherTitle: { fontSize: 24, fontWeight: '900', color: Colors.primary, marginTop: 16 },
  voucherSubtitle: { fontSize: FontSizes.sm, color: Colors.textMuted, marginBottom: 24 },
  voucherDivider: { height: 2, backgroundColor: '#f1f5f9', width: '100%', marginVertical: 24 },
  voucherLabel: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1 },
  voucherAmount: { fontSize: 32, fontWeight: '900', color: Colors.primary, marginBottom: 24 },
  voucherInfo: { backgroundColor: '#f8fafc', padding: 20, borderRadius: 20, width: '100%', marginBottom: 32 },
  infoTitle: { fontSize: 12, fontWeight: '900', color: Colors.secondary, marginBottom: 16, textAlign: 'center' },
  infoLabel: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, marginTop: 12 },
  infoValue: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  barcodePlaceholder: { alignItems: 'center', gap: 8, marginVertical: 10 },
  voucherActions: { flexDirection: 'column', gap: 12, width: '100%' },
  downloadBtn: { backgroundColor: '#6366f1', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: BorderRadius.full },
  downloadBtnText: { color: 'white', fontWeight: '800', fontSize: 16 },
  voucherBtn: { backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: BorderRadius.full, alignItems: 'center' },
  voucherBtnText: { color: 'white', fontWeight: '800', fontSize: 16 },
  cardForm: { backgroundColor: '#ffffff', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#eef2f6', marginTop: 10 },
  cardFormTitle: { fontSize: 10, fontWeight: '900', color: Colors.secondary, marginBottom: 16, letterSpacing: 1.5, textTransform: 'uppercase' },
  inputContainer: { marginBottom: 16 },
  inputLabel: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, marginBottom: 4 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, height: 44, fontSize: 14, fontWeight: '700', color: Colors.primary },
  inputRow: { flexDirection: 'row', gap: 12 },
  ratingSummary: { marginTop: 8 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  avgRatingText: { fontSize: 14, fontWeight: '800', color: Colors.primary },
  totalReviewsText: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  reviewsListSection: { marginBottom: 24 },
  sectionTitleSmall: { fontSize: 14, fontWeight: '800', color: Colors.primary, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  reviewsScroll: { paddingRight: 20, gap: 12 },
  reviewCard: { width: 260, backgroundColor: 'white', padding: 16, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border, ...Shadows.small },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  reviewAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.secondaryLight, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  reviewAvatarImg: { width: 32, height: 32 },
  reviewAvatarTxt: { fontSize: 12, fontWeight: '800', color: Colors.secondary },
  reviewName: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  reviewStars: { flexDirection: 'row', gap: 2 },
  reviewComment: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18, marginBottom: 8, height: 54 },
  reviewDate: { fontSize: 10, color: Colors.textMuted, fontWeight: '600' },
  timeBtnDisabled: { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0', opacity: 0.6 },
  timeTextDisabled: { color: '#94a3b8', textDecorationLine: 'line-through' },
  bookedWarning: { fontSize: 9, color: '#ef4444', fontWeight: '800', marginTop: 2 },
  errorContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef2f2', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#fecaca', gap: 8, marginVertical: 16 },
  errorText: { flex: 1, color: '#b91c1c', fontSize: 13, fontWeight: '600' },
  slotLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  slotLocationText: { fontSize: 10, color: Colors.textMuted, fontWeight: '600' },
});