import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../constants/theme';

export default function CatalogScreen() {
  const { roles, user } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState('');

  const primaryRole = roles.includes('admin') ? 'admin'
    : roles.includes('doctor') ? 'doctor'
    : roles.includes('receptionist') ? 'receptionist'
    : 'patient';

  const { data: doctors, isLoading, error, refetch } = useQuery({
    queryKey: ['doctors-catalog'],
    queryFn: async () => {
      try {
        // 1. Obtener IDs de doctores con asignaciones
        const { data: assignments } = await supabase
          .from('doctor_assignments')
          .select('doctor_id');
        const assignedIds = (assignments || []).map(a => a.doctor_id);

        // 2. Obtener perfiles que tengan especialidad o asignación
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('*');
        
        if (profilesError) throw profilesError;

        const doctorsList = (profiles || []).filter(p => 
          (p.specialty && p.specialty.trim() !== '') || assignedIds.includes(p.user_id)
        );

        // 3. Obtener Ratings
        const { data: ratings } = await supabase.from('ratings').select('doctor_id, score');
        const ratingMap: Record<string, { sum: number; count: number }> = {};
        ratings?.forEach(r => {
          if (!ratingMap[r.doctor_id]) ratingMap[r.doctor_id] = { sum: 0, count: 0 };
          ratingMap[r.doctor_id].sum += r.score;
          ratingMap[r.doctor_id].count += 1;
        });

        return doctorsList.map(p => ({
          ...p,
          avgRating: ratingMap[p.user_id] ? (ratingMap[p.user_id].sum / ratingMap[p.user_id].count).toFixed(1) : '5.0',
          totalReviews: ratingMap[p.user_id]?.count || 0,
        }));
      } catch (err: any) {
        throw err;
      }
    },
  });

  const filtered = doctors?.filter(d =>
    `${d.first_name || ''} ${d.last_name || ''} ${d.specialty || ''}`.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Nuestros Especialistas</Text>
        <Text style={styles.subtitle}>Encuentra al doctor ideal para ti</Text>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nombre o especialidad..."
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color={Colors.secondary} style={{ marginTop: Spacing.xxl }} />
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No se encontraron doctores</Text>
          </View>
        ) : (
          filtered.map((doctor, i) => (
            <TouchableOpacity
              key={i}
              style={styles.doctorCard}
              activeOpacity={0.7}
              onPress={() => router.push(`/(dashboard)/book/${doctor.user_id}`)}
            >
              <View style={styles.avatar}>
                {doctor.avatar_url ? (
                  <Image source={{ uri: doctor.avatar_url }} style={styles.avatarImage} cachePolicy="memory-disk" />
                ) : (
                  <Text style={styles.avatarText}>
                    {doctor.first_name?.[0]}{doctor.last_name?.[0]}
                  </Text>
                )}
              </View>
              <View style={styles.doctorInfo}>
                <Text style={styles.doctorName}>Dr. {doctor.first_name} {doctor.last_name}</Text>
                <Text style={styles.doctorSpecialty}>{doctor.specialty || 'Medicina General'}</Text>
                <View style={styles.doctorMeta}>
                  {doctor.avgRating && (
                    <View style={styles.ratingBadge}>
                      <Ionicons name="star" size={12} color="#f59e0b" />
                      <Text style={styles.ratingText}>{doctor.avgRating} ({doctor.totalReviews})</Text>
                    </View>
                  )}
                  {doctor.consultation_fee && (
                    <Text style={styles.feeText}>${doctor.consultation_fee}</Text>
                  )}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg },
  title: { fontSize: FontSizes.xxl, fontWeight: '800', color: Colors.primary },
  subtitle: { fontSize: FontSizes.md, color: Colors.textSecondary, marginBottom: Spacing.lg },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, marginBottom: Spacing.lg,
  },
  searchInput: { flex: 1, paddingVertical: 14, marginLeft: Spacing.sm, fontSize: FontSizes.md, color: Colors.text },
  doctorCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.secondaryLight,
    alignItems: 'center', justifyContent: 'center', marginRight: Spacing.md, overflow: 'hidden',
  },
  avatarImage: { width: 52, height: 52 },
  avatarText: { fontSize: FontSizes.lg, fontWeight: '800', color: Colors.secondary },
  doctorInfo: { flex: 1 },
  doctorName: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.primary },
  doctorSpecialty: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginTop: 2 },
  doctorMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.xs },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: FontSizes.xs, fontWeight: '600', color: Colors.textSecondary },
  feeText: { fontSize: FontSizes.sm, fontWeight: '800', color: Colors.secondary },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.md },
  emptyText: { fontSize: FontSizes.md, color: Colors.textMuted },
});
