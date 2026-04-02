import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, FontSizes, BorderRadius } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Logo & Branding */}
        <View style={styles.heroSection}>
          <View style={styles.logoContainer}>
            <Image source={require('../assets/logo.png')} style={styles.logoImg} />
          </View>
          <Text style={styles.logo}>MediSpace</Text>
          <Text style={styles.subtitle}>Tu salud, nuestra prioridad</Text>
        </View>

        {/* Features */}
        <View style={styles.features}>
          <View style={styles.featureRow}>
            <Ionicons name="calendar-outline" size={22} color={Colors.secondary} />
            <Text style={styles.featureText}>Agenda citas al instante</Text>
          </View>
          <View style={styles.featureRow}>
            <Ionicons name="people-outline" size={22} color={Colors.secondary} />
            <Text style={styles.featureText}>Encuentra especialistas</Text>
          </View>
          <View style={styles.featureRow}>
            <Ionicons name="document-text-outline" size={22} color={Colors.secondary} />
            <Text style={styles.featureText}>Historial médico digital</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity 
            style={styles.primaryBtn} 
            onPress={() => router.push('/login')}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryBtnText}>Iniciar Sesión</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.secondaryBtn} 
            onPress={() => router.push('/register')}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryBtnText}>Crear Cuenta</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, paddingHorizontal: Spacing.lg, justifyContent: 'center' },
  heroSection: { alignItems: 'center', marginBottom: Spacing.xxl },
  logoContainer: {
    width: 88, height: 88, borderRadius: BorderRadius.xl,
    backgroundColor: Colors.secondaryLight, alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  logo: { fontSize: 36, fontWeight: '800', color: Colors.primary, letterSpacing: -1 },
  logoImg: {
    width: '100%', height: '100%', borderRadius: BorderRadius.xl,
    backgroundColor: Colors.secondaryLight, alignItems: 'center', justifyContent: 'center',
  },  
  subtitle: { fontSize: FontSizes.lg, color: Colors.textSecondary, marginTop: Spacing.xs },
  features: { gap: Spacing.md, marginBottom: Spacing.xxl },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
  featureText: { fontSize: FontSizes.md, color: Colors.text, fontWeight: '500' },
  actions: { gap: Spacing.md },
  primaryBtn: {
    backgroundColor: Colors.secondary, paddingVertical: 18, borderRadius: BorderRadius.full,
    alignItems: 'center', shadowColor: Colors.secondary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25, shadowRadius: 16, elevation: 8,
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: FontSizes.lg },
  secondaryBtn: {
    backgroundColor: 'transparent', paddingVertical: 18, borderRadius: BorderRadius.full,
    alignItems: 'center', borderWidth: 2, borderColor: Colors.primary,
  },
  secondaryBtnText: { color: Colors.primary, fontWeight: '700', fontSize: FontSizes.lg },
});
