import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Image, Dimensions, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import { supabase } from '../lib/supabase';
import { Colors, Spacing, FontSizes, BorderRadius, Gradients, Shadows } from '../constants/theme';

const { width } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Toast.show({ type: 'error', text1: 'Campos requeridos', text2: 'Por favor ingresa tu correo y contraseña' });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      Toast.show({ type: 'success', text1: '¡Bienvenido!' });
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Error de acceso', text2: error.message === 'Invalid login credentials' ? 'Credenciales incorrectas' : error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient 
        colors={Gradients.primary} 
        style={[
          styles.headerBackground, 
          isKeyboardVisible && styles.headerBackgroundCollapsed
        ]}
      >
        <SafeAreaView>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={Colors.white} />
          </TouchableOpacity>
        </SafeAreaView>
        
        <View style={[styles.headerContent, isKeyboardVisible && styles.headerContentCollapsed]}>
          <Image 
            source={require('../assets/logo_completo.png')} 
            style={[styles.logo, isKeyboardVisible && styles.logoCollapsed]} 
            resizeMode="contain"
          />
          {!isKeyboardVisible && (
            <>
              <Text style={styles.brandName}>MediSpace</Text>
              <Text style={styles.brandSlogan}>— CONSULTORIOS MÉDICOS —</Text>
              <Text style={styles.title}>Bienvenido</Text>
              <Text style={styles.subtitle}>Salud Digital a un Clic</Text>
            </>
          )}
        </View>
      </LinearGradient>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={[styles.formArea, isKeyboardVisible && styles.formAreaCollapsed]}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Inicia Sesión</Text>
            
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

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Contraseña</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                  <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={styles.forgotBtn}>
              <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={loading} activeOpacity={0.8}>
              <LinearGradient colors={Gradients.secondary} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={styles.gradientBtn}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginBtnText}>Entrar a MediSpace</Text>}
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>¿No tienes cuenta? </Text>
              <TouchableOpacity onPress={() => router.replace('/register')}>
                <Text style={styles.footerLink}>Regístrate aquí</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  headerBackground: { height: 430, borderBottomLeftRadius: 60, borderBottomRightRadius: 60, overflow: 'hidden' },
  headerBackgroundCollapsed: { height: 160, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerContent: { alignItems: 'center', justifyContent: 'center', marginTop: -40 },
  headerContentCollapsed: { marginTop: 0, flexDirection: 'row', paddingHorizontal: 20 },
  backBtn: { marginLeft: Spacing.lg, marginTop: Spacing.sm },
  logo: { width: 280, height: 140, marginBottom: -15 }, 
  logoCollapsed: { width: 100, height: 50, marginBottom: 0 },
  brandName: { fontSize: 26, fontWeight: '900', color: Colors.white, letterSpacing: 0.5, marginBottom: 2 },
  brandSlogan: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.8)', letterSpacing: 1.5, marginBottom: 40 },
  title: { fontSize: 22, fontWeight: '900', color: Colors.white, letterSpacing: -0.5 },
  subtitle: { fontSize: 16, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  
  formArea: { flex: 1, marginTop: -70 },
  formAreaCollapsed: { marginTop: -20 },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: 40 },
  formCard: { 
    backgroundColor: Colors.white, borderRadius: BorderRadius.xxl, 
    padding: Spacing.xl, ...Shadows.large,
  },
  formTitle: { fontSize: 22, fontWeight: '800', color: Colors.primary, marginBottom: 28, textAlign: 'center' },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 11, fontWeight: '800', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginLeft: 4 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc',
    borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, borderWidth: 1, borderColor: '#f1f5f9',
  },
  inputIcon: { marginRight: Spacing.sm },
  input: { flex: 1, paddingVertical: 14, fontSize: 16, color: Colors.primary, fontWeight: '600' },
  eyeBtn: { padding: Spacing.sm },
  
  forgotBtn: { alignSelf: 'flex-end', marginBottom: 28 },
  forgotText: { color: Colors.accent, fontSize: 13, fontWeight: '700' },
  
  loginBtn: { borderRadius: BorderRadius.full, overflow: 'hidden', ...Shadows.medium },
  gradientBtn: { paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  loginBtnText: { color: '#fff', fontSize: 17, fontWeight: '900', letterSpacing: 0.5 },
  
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 32 },
  footerText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '500' },
  footerLink: { color: Colors.secondary, fontSize: 14, fontWeight: '800' },
});