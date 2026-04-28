import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import { supabase } from '../lib/supabase';
import { Colors, Spacing, BorderRadius, Gradients, Shadows } from '../constants/theme';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async () => {
    if (!email.trim()) {
      Toast.show({ type: 'error', text1: 'Correo requerido', text2: 'Ingresa tu correo para continuar' });
      return;
    }

    setLoading(true);
    try {
      // Nota: Para que el redireccionamiento funcione en producción, debes configurar el Deep Link
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: 'medispace://reset-password',
      });
      
      if (error) throw error;

      Toast.show({ 
        type: 'success', 
        text1: '¡Correo enviado!', 
        text2: 'Revisa tu bandeja de entrada para restablecer tu contraseña.' 
      });
      
      // Regresar al login después de un pequeño delay
      setTimeout(() => router.back(), 3000);
    } catch (error: any) {
      Toast.show({ 
        type: 'error', 
        text1: 'Error', 
        text2: error.message 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={Gradients.primary} style={styles.headerBackground}>
        <SafeAreaView>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={Colors.white} />
          </TouchableOpacity>
        </SafeAreaView>
        
        <View style={styles.headerContent}>
          <Ionicons name="lock-open-outline" size={80} color={Colors.white} style={{ marginBottom: 10 }} />
          <Text style={styles.title}>Recuperar Acceso</Text>
          <Text style={styles.subtitle}>Te enviaremos un enlace a tu correo</Text>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.formArea}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.formCard}>
            <Text style={styles.infoText}>
              Ingresa el correo electrónico asociado a tu cuenta de MediSpace para recibir las instrucciones de recuperación.
            </Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Correo electrónico</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="mail-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="ejemplo@medispace.com"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
            </View>

            <TouchableOpacity 
              style={styles.resetBtn} 
              onPress={handleResetPassword} 
              disabled={loading}
              activeOpacity={0.8}
            >
              <LinearGradient 
                colors={Gradients.secondary} 
                start={{x: 0, y: 0}} 
                end={{x: 1, y: 0}} 
                style={styles.gradientBtn}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.resetBtnText}>Enviar Enlace</Text>}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.back()} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancelar y volver al login</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  headerBackground: { height: 300, borderBottomLeftRadius: 60, borderBottomRightRadius: 60 },
  headerContent: { alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  backBtn: { marginLeft: Spacing.lg, marginTop: Spacing.sm },
  title: { fontSize: 28, fontWeight: '900', color: Colors.white, letterSpacing: -0.5 },
  subtitle: { fontSize: 16, color: 'rgba(255,255,255,0.8)', fontWeight: '500', marginTop: 5 },
  
  formArea: { flex: 1, marginTop: -50 },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: 40 },
  formCard: { 
    backgroundColor: Colors.white, borderRadius: BorderRadius.xxl, 
    padding: Spacing.xl, ...Shadows.large,
  },
  infoText: { 
    fontSize: 14, color: Colors.textSecondary, textAlign: 'center', 
    lineHeight: 22, marginBottom: 30, fontWeight: '500' 
  },
  inputGroup: { marginBottom: 30 },
  label: { fontSize: 11, fontWeight: '800', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginLeft: 4 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc',
    borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, borderWidth: 1, borderColor: '#f1f5f9',
  },
  inputIcon: { marginRight: Spacing.sm },
  input: { flex: 1, paddingVertical: 14, fontSize: 16, color: Colors.primary, fontWeight: '600' },
  
  resetBtn: { borderRadius: BorderRadius.full, overflow: 'hidden', ...Shadows.medium },
  gradientBtn: { paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  resetBtnText: { color: '#fff', fontSize: 17, fontWeight: '900', letterSpacing: 0.5 },
  
  cancelBtn: { marginTop: 25, alignItems: 'center' },
  cancelText: { color: Colors.textMuted, fontSize: 14, fontWeight: '700' },
});
