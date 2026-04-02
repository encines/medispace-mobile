import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../hooks/useAuth';
import { Colors, Spacing, FontSizes, BorderRadius, Gradients, Shadows } from '../../constants/theme';

export default function ManagementScreen() {
  const { profile } = useAuth();
  const router = useRouter();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={Gradients.primary} style={styles.heroBackground}>
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Gestión</Text>
              <Text style={styles.subtitle}>Operativa de la clínica</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/(dashboard)/profile')} style={styles.profileBtn}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.profileImage} />
              ) : (
                <View style={styles.profilePlaceholder}>
                  <Ionicons name="person" size={24} color="white" />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Gestión de Operativa</Text>
        
        <View style={styles.bentoGrid}>
          <TouchableOpacity style={styles.bentoItem} onPress={() => router.push('/(dashboard)/branches')}>
            <View style={[styles.bentoIcon, { backgroundColor: '#ecfdf5' }]}>
              <Ionicons name="business-outline" size={26} color="#10b981" />
            </View>
            <View>
              <Text style={styles.bentoTitle}>Sucursales</Text>
              <Text style={styles.bentoSub}>Control de sedes</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.bentoItem} onPress={() => router.push('/(dashboard)/offices')}>
            <View style={[styles.bentoIcon, { backgroundColor: '#fffbeb' }]}>
              <Ionicons name="grid-outline" size={26} color="#f59e0b" />
            </View>
            <View>
              <Text style={styles.bentoTitle}>Consultorios</Text>
              <Text style={styles.bentoSub}>Disponibilidad</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.bentoItem} onPress={() => router.push('/(dashboard)/assignments')}>
            <View style={[styles.bentoIcon, { backgroundColor: '#eff6ff' }]}>
              <Ionicons name="calendar-outline" size={26} color="#3b82f6" />
            </View>
            <View>
              <Text style={styles.bentoTitle}>Horarios</Text>
              <Text style={styles.bentoSub}>Staff Global</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.bentoItem} onPress={() => router.push('/(dashboard)/user-management')}>
            <View style={[styles.bentoIcon, { backgroundColor: '#f5f3ff' }]}>
              <Ionicons name="people-outline" size={26} color="#8b5cf6" />
            </View>
            <View>
              <Text style={styles.bentoTitle}>Usuarios</Text>
              <Text style={styles.bentoSub}>Roles y permisos</Text>
            </View>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.mainActionBtn} onPress={() => router.push('/(dashboard)/create-staff')}>
          <LinearGradient colors={Gradients.accent} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={styles.mainActionGradient}>
            <Ionicons name="person-add" size={22} color="white" />
            <Text style={styles.mainActionBtnText}>Registrar Staff Médico</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  heroBackground: { paddingHorizontal: Spacing.lg, paddingBottom: 30, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  title: { fontSize: 28, fontWeight: '900', color: 'white', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  profileBtn: { ...Shadows.medium },
  profileImage: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: 'white' },
  profilePlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  
  scrollContent: { padding: Spacing.lg, paddingBottom: 100 },
  sectionTitle: { fontSize: 20, fontWeight: '900', color: Colors.primary, marginBottom: 20, marginTop: 10 },
  
  bentoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  bentoItem: { width: '48%', backgroundColor: 'white', padding: 16, borderRadius: BorderRadius.xl, ...Shadows.small, gap: 12 },
  bentoIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  bentoTitle: { fontSize: 15, fontWeight: '800', color: Colors.primary },
  bentoSub: { fontSize: 11, color: Colors.textMuted },

  mainActionBtn: { borderRadius: BorderRadius.xl, overflow: 'hidden', ...Shadows.large },
  mainActionGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 18 },
  mainActionBtnText: { color: 'white', fontWeight: '900', fontSize: 16 },
});
