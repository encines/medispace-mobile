import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, StatusBar } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../hooks/useAuth';
import { Colors, Spacing, BorderRadius, Gradients, Shadows } from '../../constants/theme';

// Import Role Dashboards
import AdminDashboard from '../../components/dashboard/AdminDashboard';
import DoctorDashboard from '../../components/dashboard/DoctorDashboard';
import PatientDashboard from '../../components/dashboard/PatientDashboard';
import ReceptionistDashboard from '../../components/dashboard/ReceptionistDashboard';

export default function HomeScreen() {
  const { user, profile, roles } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const primaryRole = roles.includes('admin') ? 'admin'
    : roles.includes('doctor') ? 'doctor'
    : roles.includes('receptionist') ? 'receptionist'
    : 'patient';

  const onRefresh = async () => {
    setRefreshing(true);
    // Invalidate ALL dashboard queries to trigger a global refetch
    await queryClient.invalidateQueries({ queryKey: ['upcoming-appointments'] });
    await queryClient.invalidateQueries({ queryKey: ['admin-dashboard-stats'] });
    await queryClient.invalidateQueries({ queryKey: ['my-reviews'] });
    setRefreshing(false);
  };

  const greeting = new Date().getHours() < 12 ? 'Buenos días' : new Date().getHours() < 18 ? 'Buenas tardes' : 'Buenas noches';

  const renderDashboard = () => {
    switch (primaryRole) {
      case 'admin': return <AdminDashboard />;
      case 'doctor': return <DoctorDashboard />;
      case 'receptionist': return <ReceptionistDashboard />;
      default: return <PatientDashboard />;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={Gradients.primary} style={styles.heroBackground}>
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>{greeting},</Text>
              <Text style={styles.userName}>{profile?.first_name || 'Usuario'}</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/(dashboard)/profile')} style={styles.profileBtn}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.profileImage} cachePolicy="memory-disk" />
              ) : (
                <View style={styles.profilePlaceholder}>
                  <Ionicons name="person" size={24} color="white" />
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.heroAction}>
            <View style={styles.roleTag}>
              <Ionicons 
                name={primaryRole === 'admin' ? 'shield-checkmark' : primaryRole === 'doctor' ? 'medkit' : primaryRole === 'receptionist' ? 'briefcase' : 'person'} 
                size={14} color="white" 
              />
              <Text style={styles.roleTagText}>
                {primaryRole.toUpperCase()}
              </Text>
            </View>
            {primaryRole === 'patient' && (
              <TouchableOpacity style={styles.heroBookBtn} onPress={() => router.push('/(dashboard)/catalog')}>
                <Text style={styles.heroBookText}>Agenda hoy</Text>
                <Ionicons name="arrow-forward" size={16} color={Colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.secondary} />}
        showsVerticalScrollIndicator={false}
      >
        {renderDashboard()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  heroBackground: { paddingHorizontal: Spacing.lg, paddingBottom: 40, borderBottomLeftRadius: 40, borderBottomRightRadius: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  greeting: { fontSize: 16, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  userName: { fontSize: 32, fontWeight: '900', color: 'white', letterSpacing: -1 },
  profileBtn: { ...Shadows.medium },
  profileImage: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: 'white' },
  profilePlaceholder: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  
  heroAction: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 },
  roleTag: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.full },
  roleTagText: { color: 'white', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  heroBookBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'white', paddingHorizontal: 16, paddingVertical: 10, borderRadius: BorderRadius.full },
  heroBookText: { color: Colors.primary, fontSize: 14, fontWeight: '800' },

  scrollContent: { padding: Spacing.lg, paddingBottom: 100 },
});
