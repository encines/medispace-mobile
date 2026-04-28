import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';
import Toast from 'react-native-toast-message';
import { supabase } from '../lib/supabase';
import { Colors, Spacing, FontSizes, BorderRadius } from '../constants/theme';

export default function RegisterScreen() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // New States
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [gender, setGender] = useState<'male' | 'female' | 'other' | null>(null);
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    return () => {
      keyboardDidHideListener.remove();
      keyboardDidShowListener.remove();
    };
  }, []);

  const handleRegister = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim() || !birthDate || !gender) {
      Toast.show({ type: 'error', text1: 'Campos requeridos', text2: 'Completa todos los campos obligatorios' });
      return;
    }
    if (password !== confirmPassword) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Las contraseñas no coinciden' });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { 
            first_name: firstName.trim(), 
            last_name: lastName.trim(), 
            phone: phone.trim() || null,
            birth_date: format(birthDate, 'yyyy-MM-dd'),
            gender,
            clinical_notes: clinicalNotes.trim() || null
          },
        },
      });
      if (error) throw error;
      Toast.show({ type: 'success', text1: '¡Cuenta creada!', text2: 'Revisa tu correo para confirmar' });
      router.replace('/login');
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Error al registrar', text2: error.message });
    } finally {
      setLoading(false);
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setBirthDate(selectedDate);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Back Button */}
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={Colors.primary} />
          </TouchableOpacity>

          {/* Header */}
          <View style={[styles.header, isKeyboardVisible && styles.headerCollapsed]}>
            <Text style={[styles.title, isKeyboardVisible && styles.titleCollapsed]}>Crear Cuenta</Text>
            {!isKeyboardVisible && <Text style={styles.subtitle}>Únete a MediSpace</Text>}
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>  
                <Text style={styles.label}>Nombre *</Text>
                <TextInput style={styles.input} placeholder="Juan" placeholderTextColor={Colors.textMuted} value={firstName} onChangeText={setFirstName} />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Apellido *</Text>
                <TextInput style={styles.input} placeholder="Pérez" placeholderTextColor={Colors.textMuted} value={lastName} onChangeText={setLastName} />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Correo *</Text>
              <TextInput style={styles.input} placeholder="tu@correo.com" placeholderTextColor={Colors.textMuted} keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Teléfono</Text>
              <TextInput style={styles.input} placeholder="667 136 1586"  placeholderTextColor={Colors.textMuted} keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>F. Nacimiento *</Text>
                <TouchableOpacity style={styles.dateInput} onPress={() => setShowDatePicker(true)}>
                  <Ionicons name="calendar-outline" size={18} color={Colors.textMuted} />
                  <Text style={[styles.dateText, !birthDate && { color: Colors.textMuted }]}>
                    {birthDate ? format(birthDate, 'dd/MM/yyyy') : 'Seleccionar'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.inputGroup, { flex: 1.2 }]}>
                <Text style={styles.label}>Sexo *</Text>
                <View style={styles.genderRow}>
                  {(['male', 'female', 'other'] as const).map((g) => (
                    <TouchableOpacity 
                      key={g} 
                      style={[styles.genderBtn, gender === g && styles.genderBtnActive]} 
                      onPress={() => setGender(g)}
                    >
                      <Text style={[styles.genderBtnText, gender === g && styles.genderBtnTextActive]}>
                        {g === 'male' ? 'M' : g === 'female' ? 'F' : 'O'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={birthDate || new Date()}
                mode="date"
                display="default"
                themeVariant="light"
                textColor={Colors.primary}
                onChange={onDateChange}
                maximumDate={new Date()}
              />
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Datos Clínicos (Opcional)</Text>
              <TextInput 
                style={[styles.input, styles.textArea]} 
                placeholder="Alergias, enfermedades crónicas, cirugías..." 
                placeholderTextColor={Colors.textMuted} 
                multiline
                numberOfLines={3}
                value={clinicalNotes} 
                onChangeText={setClinicalNotes} 
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Contraseña *</Text>
              <TextInput style={styles.input} placeholder="Mínimo 6 caracteres" placeholderTextColor={Colors.textMuted} secureTextEntry autoCapitalize="none" value={password} onChangeText={setPassword} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirmar Contraseña *</Text>
              <TextInput style={styles.input} placeholder="Repite tu contraseña" placeholderTextColor={Colors.textMuted} secureTextEntry autoCapitalize="none" value={confirmPassword} onChangeText={setConfirmPassword} />
            </View>

            <TouchableOpacity style={styles.registerBtn} onPress={handleRegister} disabled={loading} activeOpacity={0.8}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.registerBtnText}>Crear Cuenta</Text>}
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>¿Ya tienes cuenta? </Text>
            <TouchableOpacity onPress={() => router.replace('/login')}>
              <Text style={styles.footerLink}>Iniciar sesión</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { flexGrow: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.xxl },
  backBtn: { position: 'absolute', top: Spacing.md, left: 0, padding: Spacing.sm, zIndex: 10 },
  header: { alignItems: 'center', marginBottom: Spacing.xl, marginTop: Spacing.lg },
  headerCollapsed: { marginBottom: Spacing.sm, marginTop: Spacing.sm, alignItems: 'center' },
  title: { fontSize: FontSizes.xxl, fontWeight: '800', color: Colors.primary },
  titleCollapsed: { fontSize: FontSizes.lg },
  subtitle: { fontSize: FontSizes.md, color: Colors.textSecondary, marginTop: Spacing.xs },
  form: { gap: Spacing.md },
  row: { flexDirection: 'row', gap: Spacing.md },
  inputGroup: { gap: Spacing.xs },
  label: { fontSize: FontSizes.xs, fontWeight: '700', color: Colors.primary, textTransform: 'uppercase', letterSpacing: 1 },
  input: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: 14,
    fontSize: FontSizes.md, color: Colors.text,
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  dateInput: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: 14,
  },
  dateText: { fontSize: FontSizes.md, color: Colors.text },
  genderRow: { flexDirection: 'row', gap: 8 },
  genderBtn: {
    flex: 1, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: BorderRadius.md, paddingVertical: 14, alignItems: 'center',
  },
  genderBtnActive: { backgroundColor: Colors.secondary, borderColor: Colors.secondary },
  genderBtnText: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.textSecondary },
  genderBtnTextActive: { color: '#fff' },
  registerBtn: {
    backgroundColor: Colors.secondary, paddingVertical: 18, borderRadius: BorderRadius.full,
    alignItems: 'center', marginTop: Spacing.sm,
    shadowColor: Colors.secondary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 8,
  },
  registerBtnText: { color: '#fff', fontSize: FontSizes.lg, fontWeight: '800' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.xl, paddingBottom: Spacing.xl },
  footerText: { color: Colors.textSecondary, fontSize: FontSizes.md },
  footerLink: { color: Colors.secondary, fontSize: FontSizes.md, fontWeight: '700' },
});
