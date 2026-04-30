import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useAdminStats } from '../../hooks/useDashboardData';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatsSkeleton } from './DashboardSkeletons';
import { Colors, Spacing, BorderRadius, Shadows } from '../../constants/theme';

export default function AdminDashboard() {
  const adminStatsQuery = useAdminStats();

  if (adminStatsQuery.isLoading) {
    return <StatsSkeleton />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <LinearGradient colors={['#eff6ff', '#dbeafe']} style={styles.statIconGradient}>
            <Ionicons name="medical" size={20} color="#3b82f6" />
          </LinearGradient>
          <Text style={styles.statVal}>{adminStatsQuery.data?.doctors || 0}</Text>
          <Text style={styles.statLab}>Médicos</Text>
        </View>
        <View style={styles.statCard}>
          <LinearGradient colors={['#fff7ed', '#ffedd5']} style={styles.statIconGradient}>
            <Ionicons name="people" size={20} color="#ea580c" />
          </LinearGradient>
          <Text style={styles.statVal}>{adminStatsQuery.data?.receptionists || 0}</Text>
          <Text style={styles.statLab}>Recep.</Text>
        </View>
        <View style={styles.statCard}>
          <LinearGradient colors={['#f0fdf4', '#dcfce7']} style={styles.statIconGradient}>
            <Ionicons name="business" size={20} color="#16a34a" />
          </LinearGradient>
          <Text style={styles.statVal}>{adminStatsQuery.data?.branches || 0}</Text>
          <Text style={styles.statLab}>Sedes</Text>
        </View>
        <View style={styles.statCard}>
          <LinearGradient colors={['#faf5ff', '#f3e8ff']} style={styles.statIconGradient}>
            <Ionicons name="grid" size={20} color="#9333ea" />
          </LinearGradient>
          <Text style={styles.statVal}>{adminStatsQuery.data?.offices || 0}</Text>
          <Text style={styles.statLab}>Consul.</Text>
        </View>
      </View>

      <View style={styles.managementInfoCard}>
        <Ionicons name="information-circle-outline" size={20} color={Colors.secondary} />
        <Text style={styles.managementInfoText}>
          Toda la gestión operativa ahora se encuentra en la nueva pestaña de <Text style={{fontWeight: '800'}}>Gestión</Text>.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.md },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  statCard: { 
    width: '48%', 
    aspectRatio: 1, 
    backgroundColor: 'white', 
    padding: 16, 
    borderRadius: BorderRadius.xxl, 
    ...Shadows.medium, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  statIconGradient: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  statVal: { fontSize: 28, fontWeight: '900', color: Colors.primary },
  statLab: { fontSize: 11, fontWeight: '800', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  managementInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#eff6ff',
    padding: 16,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: '#dbeafe',
    marginTop: 20,
  },
  managementInfoText: {
    flex: 1,
    fontSize: 14,
    color: Colors.primary,
    lineHeight: 20,
    fontWeight: '500',
  },
});
