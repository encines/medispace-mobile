import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { secondarySupabase } from '../../lib/secondarySupabase';
import Toast from 'react-native-toast-message';
import { Colors, Spacing, BorderRadius, Shadows, FontSizes } from '../../constants/theme';
import { useUpcomingAppointments } from '../../hooks/useDashboardData';

export default function ReceptionistOpsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const appointmentsQuery = useUpcomingAppointments('receptionist');

  // Quick Register States
  const [showQuickReg, setShowQuickReg] = useState(false);
  const [newPatient, setNewPatient] = useState({ first_name: '', last_name: '', phone: '' });

  const quickRegisterMutation = useMutation({
    mutationFn: async () => {
      if (!newPatient.first_name || !newPatient.last_name || !newPatient.phone) {
        throw new Error('Todos los campos son obligatorios');
      }
      const email = `${newPatient.phone.replace(/\s/g, '')}@medispace.tmp`;
      const password = 'Paciente123!';
      const { data, error } = await secondarySupabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: newPatient.first_name,
            last_name: newPatient.last_name,
            phone: newPatient.phone,
            role: 'patient'
          }
        }
      });
      if (error) throw error;
      return data.user;
    },
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Paciente Registrado', text2: 'Ya puedes agendarle una cita.' });
      setShowQuickReg(false);
      setNewPatient({ first_name: '', last_name: '', phone: '' });
      Alert.alert('Registro Exitoso', '¿Deseas agendarle una cita ahora?', [
        { text: 'Más tarde' },
        { text: 'Agendar', onPress: () => router.push('/(dashboard)/catalog') }
      ]);
    },
    onError: (err: any) => Toast.show({ type: 'error', text1: 'Error', text2: err.message }),
  });

  const checkInMutation = useMutation({
    mutationFn: async (appointmentId: string) => {
      const { error } = await supabase.from('appointments').update({ status: 'arrived' as any }).eq('id', appointmentId);
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
          <Text style={styles.quickAddBtnText}>Alta Exprés</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
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
                <Text style={styles.modalTitle}>Alta Exprés</Text>
                <TouchableOpacity onPress={() => setShowQuickReg(false)}><Ionicons name="close" size={24} color={Colors.textMuted} /></TouchableOpacity>
              </View>
              <View style={styles.inputGroup}><Text style={styles.inputLabel}>Nombre</Text><TextInput style={styles.input} value={newPatient.first_name} onChangeText={t => setNewPatient(p => ({...p, first_name: t}))}/></View>
              <View style={styles.inputGroup}><Text style={styles.inputLabel}>Apellido</Text><TextInput style={styles.input} value={newPatient.last_name} onChangeText={t => setNewPatient(p => ({...p, last_name: t}))}/></View>
              <View style={styles.inputGroup}><Text style={styles.inputLabel}>Teléfono</Text><TextInput style={styles.input} keyboardType="phone-pad" value={newPatient.phone} onChangeText={t => setNewPatient(p => ({...p, phone: t}))}/></View>
              <TouchableOpacity style={styles.submitBtn} onPress={() => quickRegisterMutation.mutate()} disabled={quickRegisterMutation.isPending}>
                {quickRegisterMutation.isPending ? <ActivityIndicator color="white" /> : <Text style={styles.submitBtnText}>Crear Paciente</Text>}
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
  modalContainer: { width: '100%' },
  modalContent: { backgroundColor: 'white', borderRadius: 24, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: Colors.primary },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, marginBottom: 8 },
  input: { backgroundColor: '#f1f5f9', borderRadius: 12, padding: 12, fontSize: 16, fontWeight: '600' },
  submitBtn: { backgroundColor: Colors.secondary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  submitBtnText: { color: 'white', fontWeight: '800', fontSize: 16 },
});
