import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../constants/theme';

export default function EditProfileScreen() {
  const router = useRouter();
  const { profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    phone: profile?.phone || '',
    address: profile?.address || '',
    blood_type: profile?.blood_type || '',
    allergies: profile?.allergies || '',
    emergency_contact_name: profile?.emergency_contact_name || '',
    emergency_contact_phone: profile?.emergency_contact_phone || '',
  });

  const handleSave = async () => {
    if (!profile?.user_id) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          phone: formData.phone,
          address: formData.address,
          blood_type: formData.blood_type,
          allergies: formData.allergies,
          emergency_contact_name: formData.emergency_contact_name,
          emergency_contact_phone: formData.emergency_contact_phone,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', profile.user_id);

      if (error) throw error;

      await refreshProfile();
      Alert.alert('Éxito', 'Perfil actualizado correctamente');
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo actualizar el perfil');
    } finally {
      setLoading(false);
    }
  };

  const renderInput = (label: string, key: keyof typeof formData, icon: string, placeholder: string, keyboardType: any = 'default') => (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputContainer}>
        <Ionicons name={icon as any} size={20} color={Colors.textMuted} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          value={formData[key]}
          onChangeText={(text) => setFormData(prev => ({ ...prev, [key]: text }))}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          keyboardType={keyboardType}
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Editar Perfil</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.sectionTitle}>Información de Contacto</Text>
          {renderInput('Teléfono', 'phone', 'call-outline', 'Tu número de teléfono', 'phone-pad')}
          {renderInput('Dirección', 'address', 'location-outline', 'Tu dirección')}

          <Text style={[styles.sectionTitle, { marginTop: Spacing.xl }]}>Información Médica</Text>
          {renderInput('Tipo de Sangre', 'blood_type', 'water-outline', 'Ej: O+', 'default')}
          {renderInput('Alergias', 'allergies', 'alert-circle-outline', 'Ej: Penicilina, Polen')}

          <Text style={[styles.sectionTitle, { marginTop: Spacing.xl }]}>Contacto de Emergencia</Text>
          {renderInput('Nombre del Contacto', 'emergency_contact_name', 'person-outline', 'Nombre completo')}
          {renderInput('Teléfono de Emergencia', 'emergency_contact_phone', 'call-outline', 'Número del contacto', 'phone-pad')}

          <TouchableOpacity 
            style={[styles.saveBtn, loading && styles.saveBtnDisabled]} 
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.saveBtnText}>Guardar Cambios</Text>
            )}
          </TouchableOpacity>
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
  sectionTitle: { fontSize: FontSizes.sm, fontWeight: '800', color: Colors.secondary, textTransform: 'uppercase', marginBottom: Spacing.md, letterSpacing: 0.5 },
  inputGroup: { marginBottom: Spacing.md },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6, marginLeft: 4 },
  inputContainer: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
  },
  inputIcon: { marginRight: Spacing.sm },
  input: { flex: 1, paddingVertical: 12, fontSize: FontSizes.md, color: Colors.text },
  saveBtn: { 
    backgroundColor: Colors.secondary, padding: Spacing.md, borderRadius: BorderRadius.lg,
    alignItems: 'center', marginTop: Spacing.xxl, marginBottom: Spacing.xl,
    shadowColor: Colors.secondary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: 'white', fontSize: FontSizes.md, fontWeight: '700' },
});
