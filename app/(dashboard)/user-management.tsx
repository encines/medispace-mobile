import { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, RefreshControl, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../constants/theme';

export default function BentoUserManagementScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'doctor' | 'receptionist'>('all');

  const { data: users, isLoading, refetch } = useQuery({
    queryKey: ['admin-staff-users-bento'],
    queryFn: async () => {
      const { data: profilesResult, error: pError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, phone, avatar_url, is_active, role')
        .order('first_name');
      
      if (pError) throw pError;

      return (profilesResult || [])
        .map(u => ({
          user_id: u.id,
          first_name: u.first_name,
          last_name: u.last_name,
          phone: u.phone,
          avatar_url: u.avatar_url,
          is_active: u.is_active,
          roles: [u.role]
        }))
        .filter(u => u.roles.some((r: any) => r !== 'patient'));
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ userId, currentStatus }: { userId: string; currentStatus: boolean }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !currentStatus })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-staff-users-bento'] });
      Alert.alert('Éxito', 'Estado actualizado');
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const filteredUsers = users?.filter(u => filter === 'all' || u.roles.includes(filter)) || [];

  const renderUser = ({ item }: { item: any }) => {
    const isActive = item.is_active !== false;
    
    return (
      <View style={[styles.card, !isActive && styles.cardInactive]}>
        <View style={styles.cardMain}>
          <View style={[styles.avatar, { backgroundColor: isActive ? '#eff6ff' : '#f1f5f9' }]}>
            {item.avatar_url ? (
              <Image source={{ uri: item.avatar_url }} style={styles.avatarImage} />
            ) : (
              <Text style={[styles.avatarText, { color: isActive ? Colors.primary : Colors.textMuted }]}>
                {item.first_name[0]}{item.last_name[0]}
              </Text>
            )}
          </View>
          
          <View style={styles.info}>
            <Text style={styles.userName}>{item.first_name} {item.last_name}</Text>
            <View style={styles.badgeRow}>
              {item.roles.map((role: string) => (
                <View key={role} style={[styles.roleBadge, { backgroundColor: role === 'admin' ? '#f5f3ff' : role === 'doctor' ? '#f0fdf4' : '#fff7ed' }]}>
                  <Text style={[styles.roleText, { color: role === 'admin' ? '#7c3aed' : role === 'doctor' ? '#16a34a' : '#ea580c' }]}>
                    {role === 'admin' ? 'Admin' : role === 'doctor' ? 'Médico' : 'Recepción'}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {!isActive && (
            <View style={styles.inactiveTag}>
              <Text style={styles.inactiveTagText}>Inactivo</Text>
            </View>
          )}
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.phoneGroup}>
            <Ionicons name="call" size={14} color={Colors.textMuted} />
            <Text style={styles.phoneText}>{item.phone || 'S/N'}</Text>
          </View>

          <TouchableOpacity 
            style={[styles.statusBtn, { borderColor: isActive ? '#ef4444' : Colors.secondary }]}
            onPress={() => {
              Alert.alert(isActive ? 'Baja' : 'Alta', `¿Deseas ${isActive ? 'desactivar' : 'activar'} a ${item.first_name}?`, [
                { text: 'No' },
                { text: 'Sí', onPress: () => toggleActiveMutation.mutate({ userId: item.user_id, currentStatus: isActive }) }
              ]);
            }}
          >
            <Ionicons name={isActive ? "remove-circle-outline" : "add-circle-outline"} size={16} color={isActive ? '#ef4444' : Colors.secondary} />
            <Text style={[styles.statusBtnText, { color: isActive ? '#ef4444' : Colors.secondary }]}>
              {isActive ? 'Dar Baja' : 'Activar'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Gestión de Usuarios</Text>
          <Text style={styles.headerSubtitle}>Administración de equipo</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/(dashboard)/create-staff')}>
          <Ionicons name="person-add" size={20} color="white" />
          <Text style={styles.addBtnText}>Nuevo</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        {[
          { id: 'all', label: 'Todos' },
          { id: 'doctor', label: 'Médicos' },
          { id: 'receptionist', label: 'Recepción' }
        ].map(btn => (
          <TouchableOpacity 
            key={btn.id}
            style={[styles.filterBtn, filter === btn.id && styles.filterBtnActive]}
            onPress={() => setFilter(btn.id as any)}
          >
            <Text style={[styles.filterBtnText, filter === btn.id && { color: 'white' }]}>{btn.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.secondary} />
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          renderItem={renderUser}
          keyExtractor={item => item.user_id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} colors={[Colors.secondary]} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={64} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No hay usuarios</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xl,
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: Colors.primary },
  headerSubtitle: { fontSize: 13, color: Colors.textMuted, fontWeight: '600' },
  addBtn: { 
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.secondary,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
  },
  addBtnText: { color: 'white', fontWeight: '800', fontSize: 13 },
  filterRow: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: 10, marginBottom: Spacing.md },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: 'white', borderWidth: 1, borderColor: '#e2e8f0' },
  filterBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterBtnText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  list: { padding: Spacing.lg, paddingBottom: 100 },
  card: { 
    backgroundColor: 'white', borderRadius: 24, padding: Spacing.md, 
    marginBottom: Spacing.md, borderWidth: 1, borderColor: '#e2e8f0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2,
  },
  cardInactive: { opacity: 0.6, backgroundColor: '#f8fafc' },
  cardMain: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: 50, height: 50 },
  avatarText: { fontSize: 18, fontWeight: '800' },
  info: { flex: 1, marginLeft: Spacing.md },
  userName: { fontSize: 17, fontWeight: '800', color: '#1e293b' },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  roleText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  inactiveTag: { backgroundColor: '#fee2e2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  inactiveTagText: { color: '#ef4444', fontSize: 10, fontWeight: '900' },
  cardFooter: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: '#f1f5f9', marginTop: Spacing.md, paddingTop: Spacing.md,
  },
  phoneGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  phoneText: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  statusBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  statusBtnText: { fontSize: 12, fontWeight: '800' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: Colors.textMuted, fontWeight: '600', marginTop: 10 },
});
