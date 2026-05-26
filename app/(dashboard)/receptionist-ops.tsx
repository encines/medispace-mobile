import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { supabase } from '../../lib/supabase';
import { secondarySupabase } from '../../lib/secondarySupabase';
import { validatePhone, formatPhone, cleanPhone, translateSupabaseError } from '../../lib/validation';
import Toast from 'react-native-toast-message';
import { Colors, Spacing, BorderRadius, Shadows, FontSizes } from '../../constants/theme';
import { useUpcomingAppointments } from '../../hooks/useDashboardData';
import { useAuth } from '../../hooks/useAuth';

export default function ReceptionistOpsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const appointmentsQuery = useUpcomingAppointments('receptionist');

  // Register States
  const [showQuickReg, setShowQuickReg] = useState(false);
  const [newPatient, setNewPatient] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    birth_date: null as Date | null,
    gender: null as 'male' | 'female' | 'other' | null,
    clinical_notes: '',
  });
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleConfirmDate = (selectedDate: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setNewPatient(p => ({ ...p, birth_date: selectedDate }));
    }
  };

  // Custom buttons/header to ensure visible text colors on iOS
  const CustomCancelButton = ({ onPress, label }: { onPress: () => void; label: string }) => (
    <TouchableOpacity onPress={onPress} style={{ paddingVertical: 12, paddingHorizontal: 16 }}>
      <Text style={{ color: Colors.primary, fontSize: FontSizes.md }}>{label}</Text>
    </TouchableOpacity>
  );

  const CustomConfirmButton = ({ onPress, label }: { onPress: () => void; label: string }) => (
    <TouchableOpacity onPress={onPress} style={{ paddingVertical: 12, paddingHorizontal: 16 }}>
      <Text style={{ color: Colors.primary, fontSize: FontSizes.md, fontWeight: '700' }}>{label}</Text>
    </TouchableOpacity>
  );

  const CustomHeader = ({ label }: { label: string }) => (
    <View style={{ padding: 12, alignItems: 'center', backgroundColor: Colors.surface }}>
      <Text style={{ color: Colors.primary, fontWeight: '700', fontSize: FontSizes.md }}>{label}</Text>
    </View>
  );

  const generateDefaultPassword = (firstName: string, birthDate: Date | null): string => {
    const firstWord = firstName.trim() ? firstName.trim().split(' ')[0] : '';
    const cleanName = firstWord ? (firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase()) : 'Nombre';
    let dateStr = 'DDMMYYYY';
    if (birthDate) {
      const day = String(birthDate.getDate()).padStart(2, '0');
      const month = String(birthDate.getMonth() + 1).padStart(2, '0');
      const year = birthDate.getFullYear();
      dateStr = `${day}${month}${year}`;
    }
    return `${cleanName}${dateStr}`;
  };

  const validatePatient = (): string | null => {
    if (!newPatient.first_name.trim() || !newPatient.last_name.trim() || !newPatient.email.trim() || !newPatient.phone || !newPatient.birth_date || !newPatient.gender) {
      return 'Todos los campos obligatorios (*) son requeridos';
    }
    const nameRegex = /^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]{2,50}$/;
    if (!nameRegex.test(newPatient.first_name.trim())) {
      return 'El nombre solo puede contener letras (mín. 2)';
    }
    if (!nameRegex.test(newPatient.last_name.trim())) {
      return 'El apellido solo puede contener letras (mín. 2)';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newPatient.email.trim())) {
      return 'El formato del correo electrónico no es válido';
    }
    if (!validatePhone(newPatient.phone)) {
      return 'El teléfono debe tener exactamente 10 dígitos';
    }
    return null;
  };

  const quickRegisterMutation = useMutation({
    mutationFn: async () => {
      const validationError = validatePatient();
      if (validationError) {
        throw new Error(validationError);
      }
      const phoneCleaned = cleanPhone(newPatient.phone);
      const email = newPatient.email.trim();
      const password = generateDefaultPassword(newPatient.first_name, newPatient.birth_date);
      const { data, error } = await secondarySupabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: newPatient.first_name.trim(),
            last_name: newPatient.last_name.trim(),
            phone: phoneCleaned,
            birth_date: format(newPatient.birth_date!, 'yyyy-MM-dd'),
            gender: newPatient.gender,
            clinical_notes: newPatient.clinical_notes.trim() || null,
            role: 'patient',
            created_by_reception: true
          }
        }
      });
      if (error) throw error;

      // Validar si el paciente ya está registrado (User Enumeration Protection de Supabase)
      if (data?.user && (!data.user.identities || data.user.identities.length === 0)) {
        throw new Error('User already registered');
      }

      return data.user;
    },
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Paciente Registrado', text2: 'Ya puedes agendarle una cita.' });
      setShowQuickReg(false);
      setNewPatient({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        birth_date: null,
        gender: null,
        clinical_notes: '',
      });
      Alert.alert('Registro Exitoso', '¿Deseas agendarle una cita ahora?', [
        { text: 'Más tarde' },
        { text: 'Agendar', onPress: () => router.push('/(dashboard)/catalog') }
      ]);
    },
    onError: (err: any) => Toast.show({ type: 'error', text1: 'Error', text2: translateSupabaseError(err.message) }),
  });

  const checkInMutation = useMutation({
    mutationFn: async (appointmentId: string) => {
      const { error } = await supabase.from('appointments').update({ status: 'arrived' }).eq('id', appointmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['upcoming-appointments'] });
      Toast.show({ type: 'success', text1: 'Llegada confirmada' });
    },
    onError: (err: any) => Toast.show({ type: 'error', text1: 'Error', text2: err.message }),
  });

  const registerPaymentMutation = useMutation({
    mutationFn: async (apt: any) => {
      const { error } = await supabase.from('appointments').update({ amount_paid: apt.total_price, payment_method: 'cash' }).eq('id', apt.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['upcoming-appointments'] });
      Toast.show({ type: 'success', text1: 'Pago Registrado' });
    },
    onError: (err: any) => Toast.show({ type: 'error', text1: 'Error', text2: err.message }),
  });

  const waitingPatients = appointmentsQuery.data?.filter((a: any) => a.status === 'arrived') || [];
  const upcomingPatients = appointmentsQuery.data?.filter((a: any) => a.status !== 'arrived') || [];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Operaciones</Text>
          <Text style={styles.headerSubtitle}>Gestión de Sala y Cobros</Text>
        </View>
        <TouchableOpacity style={styles.quickAddBtn} onPress={() => setShowQuickReg(true)}>
          <Ionicons name="person-add" size={20} color="white" />
          <Text style={styles.quickAddBtnText}>Alta de Paciente</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {!profile?.branch_id && (
          <View style={styles.branchWarning}>
            <Ionicons name="business-outline" size={20} color="#ef4444" />
            <View style={{ flex: 1 }}>
              <Text style={styles.branchWarningTitle}>Sin sucursal asignada</Text>
              <Text style={styles.branchWarningText}>Pide a administracion asignar una sucursal para ver y recibir pacientes.</Text>
            </View>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Sala de Espera ({waitingPatients.length})</Text>
          <Ionicons name="people-circle" size={24} color={Colors.secondary} />
        </View>

        {waitingPatients.length > 0 ? (
          waitingPatients.map((apt: any) => (
            <View key={apt.id} style={[styles.ticketCard, { borderColor: Colors.secondary, borderWidth: 1 }]}>
               <View style={[styles.ticketLeft, { backgroundColor: '#f0fdf4' }]}>
                  <Ionicons name="time" size={24} color={Colors.secondary} />
                  <Text style={styles.waitingTag}>EN SALA</Text>
               </View>
               <View style={styles.ticketRight}>
                  <View style={styles.ticketHeader}>
                     <Text style={styles.ticketTime}>{format(new Date(apt.start_time), 'HH:mm')} hrs</Text>
                  </View>
                  <Text style={styles.ticketTitle}>{apt.counterparty?.first_name} {apt.counterparty?.last_name}</Text>
                  <View style={styles.doctorRow}>
                    <Ionicons name="medical-outline" size={13} color={Colors.textMuted} />
                    <Text style={styles.doctorText} numberOfLines={1}>
                      Con Dr. {apt.doctorProfile?.first_name || 'Doctor'} {apt.doctorProfile?.last_name || ''}
                    </Text>
                  </View>
                   
                  <View style={styles.paymentInfo}>
                     <View style={styles.paymentRow}>
                        <Text style={styles.paymentLabel}>Saldo: <Text style={styles.paymentVal}>${apt.total_price - apt.amount_paid}</Text></Text>
                     </View>
                     {apt.amount_paid < apt.total_price && (
                        <TouchableOpacity style={styles.payBtn} onPress={() => registerPaymentMutation.mutate(apt)}>
                           <Ionicons name="cash-outline" size={14} color="white" />
                           <Text style={styles.payBtnText}>Cobrar en Efectivo</Text>
                        </TouchableOpacity>
                     )}
                  </View>
               </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}><Text style={styles.emptyText}>Sala de espera vacía</Text></View>
        )}

        <View style={[styles.sectionHeader, { marginTop: 24 }]}>
          <Text style={styles.sectionTitle}>Próximos por Llegar</Text>
        </View>

        {upcomingPatients.length > 0 ? (
          upcomingPatients.map((apt: any) => (
            <View key={apt.id} style={styles.ticketCard}>
              <View style={styles.ticketLeft}>
                 <Text style={styles.ticketDay}>{format(new Date(apt.start_time), 'dd')}</Text>
                 <Text style={styles.ticketMonth}>{format(new Date(apt.start_time), 'MMM', { locale: es }).toUpperCase()}</Text>
              </View>
              <View style={styles.ticketRight}>
                 <View style={styles.ticketHeader}>
                    <Text style={styles.ticketTime}>{format(new Date(apt.start_time), 'HH:mm')} hrs</Text>
                    <Text style={styles.miniPaymentText}>
                       {apt.amount_paid >= apt.total_price ? '✅ Liquidado' : `⚠️ Debe: $${apt.total_price - apt.amount_paid}`}
                    </Text>
                 </View>
                  <Text style={styles.ticketTitle}>{apt.counterparty?.first_name} {apt.counterparty?.last_name}</Text>
                  <View style={styles.doctorRow}>
                    <Ionicons name="medical-outline" size={13} color={Colors.textMuted} />
                    <Text style={styles.doctorText} numberOfLines={1}>
                      Con Dr. {apt.doctorProfile?.first_name || 'Doctor'} {apt.doctorProfile?.last_name || ''}
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.checkInBtn} onPress={() => checkInMutation.mutate(apt.id)}>
                    <Ionicons name="log-in-outline" size={14} color="white" />
                    <Text style={styles.checkInBtnText}>Confirmar Llegada</Text>
                 </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}><Text style={styles.emptyText}>No hay más citas para hoy</Text></View>
        )}
      </ScrollView>

      <Modal visible={showQuickReg} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Alta de Paciente</Text>
                <TouchableOpacity onPress={() => setShowQuickReg(false)}>
                  <Ionicons name="close" size={24} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>

              <ScrollView 
                contentContainerStyle={styles.modalFormScroll}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.row}>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>Nombre *</Text>
                    <TextInput 
                      style={styles.input} 
                      placeholder="Juan" 
                      placeholderTextColor={Colors.textMuted}
                      value={newPatient.first_name} 
                      onChangeText={t => setNewPatient(p => ({...p, first_name: t}))}
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>Apellido *</Text>
                    <TextInput 
                      style={styles.input} 
                      placeholder="Pérez" 
                      placeholderTextColor={Colors.textMuted}
                      value={newPatient.last_name} 
                      onChangeText={t => setNewPatient(p => ({...p, last_name: t}))}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Correo *</Text>
                  <TextInput 
                    style={styles.input} 
                    placeholder="paciente@correo.com" 
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={newPatient.email} 
                    onChangeText={t => setNewPatient(p => ({...p, email: t}))}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Teléfono *</Text>
                  <TextInput 
                    style={styles.input} 
                    keyboardType="phone-pad" 
                    value={newPatient.phone} 
                    onChangeText={t => setNewPatient(p => ({...p, phone: formatPhone(t)}))}
                    maxLength={14}
                    placeholder="(000) 000-0000"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>

                <View style={styles.row}>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>F. Nacimiento *</Text>
                    <TouchableOpacity style={styles.dateInput} onPress={() => setShowDatePicker(true)}>
                      <Ionicons name="calendar-outline" size={18} color={Colors.textMuted} />
                      <Text style={[styles.dateText, !newPatient.birth_date && { color: Colors.textMuted }]}>
                        {newPatient.birth_date ? format(newPatient.birth_date, 'dd/MM/yyyy') : 'Seleccionar'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.inputGroup, { flex: 1.2 }]}>
                    <Text style={styles.inputLabel}>Sexo *</Text>
                    <View style={styles.genderRow}>
                      {(['male', 'female', 'other'] as const).map((g) => (
                        <TouchableOpacity 
                          key={g} 
                          style={[styles.genderBtn, newPatient.gender === g && styles.genderBtnActive]} 
                          onPress={() => setNewPatient(p => ({ ...p, gender: g }))}
                        >
                          <Text style={[styles.genderBtnText, newPatient.gender === g && styles.genderBtnTextActive]}>
                            {g === 'male' ? 'M' : g === 'female' ? 'F' : 'O'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Datos Clínicos (Opcional)</Text>
                  <TextInput 
                    style={[styles.input, styles.textArea]} 
                    placeholder="Alergias, enfermedades crónicas, cirugías..." 
                    placeholderTextColor={Colors.textMuted} 
                    multiline
                    numberOfLines={3}
                    value={newPatient.clinical_notes} 
                    onChangeText={t => setNewPatient(p => ({...p, clinical_notes: t}))} 
                  />
                </View>

                <View style={styles.passwordNotice}>
                  <Ionicons name="key" size={18} color={Colors.secondary} />
                  <Text style={styles.passwordNoticeText}>
                    Contraseña: <Text style={{ fontWeight: '800', color: Colors.primary }}>{generateDefaultPassword(newPatient.first_name, newPatient.birth_date)}</Text>
                  </Text>
                </View>
              </ScrollView>

              <DateTimePickerModal
                isVisible={showDatePicker}
                mode="date"
                date={newPatient.birth_date || new Date()}
                textColor={Colors.primary}
                maximumDate={new Date()}
                onConfirm={handleConfirmDate}
                onCancel={() => setShowDatePicker(false)}
                isDarkModeEnabled={false}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                pickerContainerStyleIOS={{ backgroundColor: Colors.surface }}
                pickerComponentStyleIOS={{ backgroundColor: Colors.surface }}
                customCancelButtonIOS={(props) => <CustomCancelButton onPress={props.onPress} label={props.label} />}
                customConfirmButtonIOS={(props) => <CustomConfirmButton onPress={props.onPress} label={props.label} />}
                customHeaderIOS={(props) => <CustomHeader label={props.label} />}
              />

              <TouchableOpacity 
                style={styles.submitBtn} 
                onPress={() => quickRegisterMutation.mutate()} 
                disabled={quickRegisterMutation.isPending}
              >
                {quickRegisterMutation.isPending ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.submitBtnText}>Crear Paciente</Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  headerTitle: { fontSize: 24, fontWeight: '900', color: Colors.primary },
  headerSubtitle: { fontSize: 13, color: Colors.textMuted, fontWeight: '600' },
  quickAddBtn: { backgroundColor: '#7c3aed', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  quickAddBtnText: { color: 'white', fontWeight: '800', fontSize: 13 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  branchWarning: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 12, padding: 12, marginBottom: 16 },
  branchWarningTitle: { fontSize: 13, fontWeight: '900', color: '#991b1b' },
  branchWarningText: { fontSize: 12, fontWeight: '600', color: '#b91c1c', marginTop: 2 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: Colors.primary },
  ticketCard: { backgroundColor: 'white', borderRadius: 16, ...Shadows.small, flexDirection: 'row', marginBottom: 12, overflow: 'hidden' },
  ticketLeft: { width: 70, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  ticketDay: { fontSize: 20, fontWeight: '900', color: Colors.primary },
  ticketMonth: { fontSize: 10, fontWeight: '800', color: Colors.textMuted },
  ticketRight: { flex: 1, padding: 16 },
  ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  ticketTime: { fontSize: 14, fontWeight: '800', color: Colors.secondary },
  ticketTitle: { fontSize: 15, fontWeight: '800', color: Colors.primary, marginBottom: 8 },
  doctorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -4, marginBottom: 10 },
  doctorText: { flex: 1, fontSize: 12, fontWeight: '700', color: Colors.textMuted },
  checkInBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.secondary, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, alignSelf: 'flex-start' },
  checkInBtnText: { color: 'white', fontSize: 12, fontWeight: '800' },
  paymentInfo: { backgroundColor: '#f8fafc', padding: 10, borderRadius: 12, marginTop: 4 },
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  paymentLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '700' },
  paymentVal: { color: Colors.primary, fontWeight: '900' },
  payBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#16a34a', paddingVertical: 8, borderRadius: 8 },
  payBtnText: { color: 'white', fontSize: 11, fontWeight: '800' },
  waitingTag: { fontSize: 9, fontWeight: '900', color: Colors.secondary, marginTop: 4 },
  miniPaymentText: { fontSize: 10, fontWeight: '700', color: Colors.textMuted },
  emptyState: { padding: 20, alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 12, borderStyle: 'dashed', borderWidth: 1, borderColor: '#cbd5e1' },
  emptyText: { color: Colors.textMuted, fontWeight: '600', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContainer: { width: '100%', maxHeight: '90%' },
  modalContent: { backgroundColor: 'white', borderRadius: 24, padding: 20, gap: 12 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: Colors.primary },
  modalFormScroll: { gap: 14, paddingBottom: 10 },
  row: { flexDirection: 'row', gap: 12 },
  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 11, fontWeight: '700', color: Colors.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: Colors.text },
  textArea: { height: 60, textAlignVertical: 'top' },
  dateInput: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, paddingHorizontal: 12, paddingVertical: 10 },
  dateText: { fontSize: 15, color: Colors.text },
  genderRow: { flexDirection: 'row', gap: 6 },
  genderBtn: { flex: 1, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, paddingVertical: 10, alignItems: 'center' },
  genderBtnActive: { backgroundColor: Colors.secondary, borderColor: Colors.secondary },
  genderBtnText: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  genderBtnTextActive: { color: '#fff' },
  passwordNotice: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f5f3ff', borderLeftWidth: 4, borderLeftColor: Colors.secondary, padding: 12, borderRadius: 8, marginTop: 4 },
  passwordNoticeText: { fontSize: 13, color: Colors.textSecondary, flex: 1 },
  submitBtn: { backgroundColor: Colors.secondary, padding: 14, borderRadius: BorderRadius.full, alignItems: 'center', marginTop: 10, shadowColor: Colors.secondary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  submitBtnText: { color: 'white', fontWeight: '800', fontSize: 15 },
});
