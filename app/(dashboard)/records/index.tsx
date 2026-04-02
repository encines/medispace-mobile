import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { Colors, Spacing } from '../../../constants/theme';

export default function MedicalRecordsScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredPatients, setFilteredPatients] = useState<any[]>([]);

  const { user, roles } = useAuth();
  const isDoctor = roles.includes('doctor');
  const isAdmin = roles.includes('admin');

  // 1. Fetch only this doctor's patients
  const { data: patients, isLoading, refetch } = useQuery({
    queryKey: ['patients-list', user?.id],
    queryFn: async () => {
      if (!isDoctor) return [];

      // Get unique patient_ids from appointments for this doctor
      const { data: appointmentData, error: aptError } = await supabase
        .from('appointments')
        .select('patient_id')
        .eq('doctor_id', user!.id);
      
      if (aptError) throw aptError;
      if (!appointmentData?.length) return [];

      const patientIds = Array.from(new Set(appointmentData.map(a => a.patient_id)));

      // Then fetch profiles for those patient IDs
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', patientIds)
        .order('first_name');

      if (profileError) throw profileError;
      return profileData || [];
    },
    enabled: !!user?.id,
  });


  useEffect(() => {
    if (patients) {
      setFilteredPatients(
        patients.filter(p => 
          `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }
  }, [searchQuery, patients]);

  if (!isDoctor && !isLoading) {
    return (
      <View style={styles.center}>
        <Ionicons name="lock-closed" size={64} color={Colors.textMuted} style={{ marginBottom: 20 }} />
        <Text style={styles.emptyText}>Acceso restringido. Los administradores no tienen permisos para ver expedientes clínicos.</Text>
        <TouchableOpacity onPress={() => router.replace('/(dashboard)/home')} style={[styles.viewBtn, { marginTop: 20, width: '60%' }]}>
          <Text style={styles.viewBtnText}>Volver al Inicio</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderPatientCard = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.patientCard}
      onPress={() => router.push(`/(dashboard)/records/${item.user_id}`)}
    >
      <View style={styles.avatarContainer}>
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitial}>{item.first_name ? item.first_name[0] : 'P'}</Text>
          </View>
        )}
      </View>
      <Text style={styles.patientName} numberOfLines={1}>{item.first_name} {item.last_name}</Text>
      <View style={styles.badgeRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{item.blood_type || 'RH'}</Text>
        </View>
        <Text style={styles.genderText}>{item.gender === 'male' ? 'Hombre' : 'Mujer'}</Text>
      </View>
      <TouchableOpacity 
        style={styles.viewBtn}
        onPress={() => router.push(`/(dashboard)/records/${item.user_id}`)}
      >
        <Text style={styles.viewBtnText}>Ver Expediente</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Expedientes</Text>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar paciente..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.secondary} />
        </View>
      ) : (
        <FlatList
          data={filteredPatients}
          keyExtractor={item => item.user_id || item.id}
          renderItem={renderPatientCard}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} colors={[Colors.secondary]} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={64} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No se encontraron pacientes</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { paddingHorizontal: 20, paddingBottom: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  title: { fontSize: 32, fontWeight: '800', color: Colors.primary, marginBottom: 16, paddingTop: 16, letterSpacing: -1 },
  searchContainer: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', 
    borderRadius: 16, paddingHorizontal: 12, height: 50,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 16, color: '#1e293b', fontWeight: '500' },
  list: { padding: 16 },
  columnWrapper: { justifyContent: 'space-between', gap: 12 },
  patientCard: { 
    width: '48%', backgroundColor: 'white', 
    padding: 16, borderRadius: 24, marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1, borderColor: '#e2e8f0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  avatarContainer: { marginBottom: 12 },
  avatar: { width: 70, height: 70, borderRadius: 35 },
  avatarPlaceholder: { 
    width: 70, height: 70, borderRadius: 35, 
    backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#dbeafe',
  },
  avatarInitial: { color: Colors.primary, fontSize: 28, fontWeight: '800' },
  patientName: { fontSize: 15, fontWeight: '800', color: '#1e293b', textAlign: 'center', marginBottom: 4 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  badge: { backgroundColor: '#f0f9ff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '800', color: Colors.secondary, textTransform: 'uppercase' },
  genderText: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  viewBtn: { backgroundColor: '#f1f5f9', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, width: '100%', alignItems: 'center' },
  viewBtnText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', marginTop: 100, gap: 16 },
  emptyText: { fontSize: 16, fontWeight: '700', color: Colors.textMuted },
});
