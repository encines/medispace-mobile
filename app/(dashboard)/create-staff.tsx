import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { secondarySupabase } from '../../lib/secondarySupabase';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../constants/theme';

const specialties = [
  'Cardiología', 'Dermatología', 'Pediatría', 'Ginecología', 
  'Neurología', 'Odontología', 'Oftalmología', 'Psiquiatría', 'Urología'
];

export default function CreateStaffScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<'doctor' | 'receptionist'>('doctor');

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    specialty: specialties[0],
    license: '',
    fee: '',
  });

  const handleCreate = async () => {
    // Basic validation
    if (!formData.email || !formData.password || !formData.firstName || !formData.lastName) {
      Alert.alert('Error', 'Por favor completa los campos obligatorios');
      return;
    }

    if (role === 'doctor' && (!formData.license || !formData.fee)) {
      Alert.alert('Error', 'Los doctores requieren cédula profesional y costo de consulta');
      return;
    }

    setLoading(true);
    try {
      // 1. Registro en Auth (usando cliente secundario para no desloguear al admin)
      const { data: authData, error: authError } = await secondarySupabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
          }
        }
      });

      if (authError) throw authError;
      if (!authData?.user) throw new Error('No se pudo crear el usuario');

      const newUserId = authData.user.id;

      // Esperar un momento para que el trigger de Supabase cree el perfil inicial
      await new Promise(r => setTimeout(r, 1500));

      // 2. Actualizar Rol (usando cliente primario con sesión del admin)
      const { error: roleError } = await supabase
        .from('user_roles')
        .update({ role: role })
        .eq('user_id', newUserId);
      
      if (roleError) throw roleError;

      // 3. Actualizar Datos Médicos si es Doctor
      if (role === 'doctor') {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            specialty: formData.specialty,
            medical_license: formData.license,
            consultation_fee: parseFloat(formData.fee),
            is_active: true,
          })
          .eq('user_id', newUserId);
        
        if (profileError) throw profileError;
      }

      Alert.alert('Éxito', `El ${role === 'doctor' ? 'doctor' : 'recepcionista'} ha sido registrado correctamente.`);
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo crear el usuario');
    } finally {
      setLoading(false);
    }
  };

  const renderInput = (label: string, value: string, onChange: (t: string) => void, icon: string, placeholder: string, secure = false, keyboard: any = 'default') => (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputContainer}>
        <Ionicons name={icon as any} size={18} color={Colors.textMuted} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          secureTextEntry={secure}
          keyboardType={keyboard}
          autoCapitalize={secure ? 'none' : 'words'}
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Registrar Staff</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.roleSelector}>
            <TouchableOpacity 
              style={[styles.roleTab, role === 'doctor' && styles.roleTabActive]}
              onPress={() => setRole('doctor')}
            >
              <Ionicons name="medkit-outline" size={18} color={role === 'doctor' ? 'white' : Colors.textMuted} />
              <Text style={[styles.roleTabText, role === 'doctor' && styles.roleTabTextActive]}>Médico</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.roleTab, role === 'receptionist' && styles.roleTabActive]}
              onPress={() => setRole('receptionist')}
            >
              <Ionicons name="people-outline" size={18} color={role === 'receptionist' ? 'white' : Colors.textMuted} />
              <Text style={[styles.roleTabText, role === 'receptionist' && styles.roleTabTextActive]}>Recepción</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Acceso y Cuenta</Text>
            {renderInput('Email', formData.email, (t) => setFormData({...formData, email: t}), 'mail-outline', 'doctor@ejemplo.com', false, 'email-address')}
            {renderInput('Contraseña Inicial', formData.password, (t) => setFormData({...formData, password: t}), 'lock-closed-outline', '******', true)}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Datos Personales</Text>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                {renderInput('Nombre(s)', formData.firstName, (t) => setFormData({...formData, firstName: t}), 'person-outline', 'Juan')}
              </View>
              <View style={{ width: Spacing.md }} />
              <View style={{ flex: 1 }}>
                {renderInput('Apellidos', formData.lastName, (t) => setFormData({...formData, lastName: t}), 'person-outline', 'Pérez')}
              </View>
            </View>
          </View>

          {role === 'doctor' && (
            <View style={[styles.section, styles.medicalSection]}>
              <Text style={[styles.sectionTitle, { color: Colors.secondary }]}>Datos NOM-004 (Médico)</Text>
              
              <Text style={styles.label}>Especialidad</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.specialtyList}>
                {specialties.map(s => (
                  <TouchableOpacity 
                    key={s} 
                    style={[styles.specialtyChip, formData.specialty === s && styles.specialtyChipActive]}
                    onPress={() => setFormData({...formData, specialty: s})}
                  >
                    <Text style={[styles.specialtyText, formData.specialty === s && styles.specialtyTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {renderInput('Cédula Profesional', formData.license, (t) => setFormData({...formData, license: t}), 'id-card-outline', 'Ej: 1234567')}
              {renderInput('Costo Consulta (MXN)', formData.fee, (t) => setFormData({...formData, fee: t}), 'cash-outline', '800', false, 'numeric')}
            </View>
          )}

          <TouchableOpacity 
            style={[styles.createBtn, loading && styles.disabledBtn]} 
            onPress={handleCreate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color="white" />
                <Text style={styles.createBtnText}>Completar Registro</Text>
              </>
            )}
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.primary },
  content: { padding: Spacing.lg },
  roleSelector: { 
    flexDirection: 'row', backgroundColor: Colors.surface, padding: 4, 
    borderRadius: BorderRadius.lg, marginBottom: Spacing.xl, borderWidth: 1, borderColor: Colors.border,
  },
  roleTab: { 
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderRadius: BorderRadius.md, gap: 8,
  },
  roleTabActive: { backgroundColor: Colors.primary },
  roleTabText: { fontSize: 13, fontWeight: '700', color: Colors.textMuted },
  roleTabTextActive: { color: 'white' },
  section: { marginBottom: Spacing.xl },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: Colors.textSecondary, textTransform: 'uppercase', marginBottom: Spacing.md, letterSpacing: 0.5 },
  medicalSection: { backgroundColor: '#f0f9ff', padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: '#bae6fd' },
  inputGroup: { marginBottom: Spacing.md },
  label: { fontSize: 12, fontWeight: '700', color: Colors.primary, marginBottom: 4, marginLeft: 4 },
  inputContainer: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
  },
  inputIcon: { marginRight: Spacing.sm },
  input: { flex: 1, paddingVertical: 10, fontSize: FontSizes.md, color: Colors.text },
  row: { flexDirection: 'row' },
  specialtyList: { flexDirection: 'row', marginBottom: Spacing.md, marginTop: 4 },
  specialtyChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: BorderRadius.full, backgroundColor: Colors.surface, marginRight: 8, borderWidth: 1, borderColor: Colors.border },
  specialtyChipActive: { backgroundColor: Colors.secondary, borderColor: Colors.secondary },
  specialtyText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  specialtyTextActive: { color: 'white' },
  createBtn: { 
    backgroundColor: Colors.secondary, padding: Spacing.md, borderRadius: BorderRadius.lg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: Colors.secondary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  createBtnText: { color: 'white', fontSize: FontSizes.md, fontWeight: '700' },
  disabledBtn: { opacity: 0.6 },
});
