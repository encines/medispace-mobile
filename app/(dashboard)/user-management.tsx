import { useState, useCallback, useMemo, memo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, RefreshControl, Image, TextInput, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';

export default function BentoUserManagementScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'doctor' | 'receptionist'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [assigningUser, setAssigningUser] = useState<any>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  const { data: users, isLoading, refetch } = useQuery({
    queryKey: ['admin-staff-users-bento'],
    queryFn: async () => {
      const { data: profilesResult, error: pError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, phone, avatar_url, is_active, role, branch_id, branches(name)')
        .order('first_name');
      
      if (pError) throw pError;

      return (profilesResult || [])
        .map((u: any) => ({
          user_id: u.id,
          first_name: u.first_name,
          last_name: u.last_name,
          phone: u.phone,
          avatar_url: u.avatar_url,
          is_active: u.is_active,
          branch_id: u.branch_id,
          branch_name: Array.isArray(u.branches) ? u.branches[0]?.name : u.branches?.name,
          roles: [u.role]
        }))
        .filter(u => u.roles.some((r: any) => r !== 'patient'));
    },
  });

  const { data: branches } = useQuery({
    queryKey: ['admin-branches-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name, status')
        .order('name');
      if (error) throw error;
      return data || [];
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

  const assignBranchMutation = useMutation({
    mutationFn: async ({ userId, branchId }: { userId: string; branchId: string }) => {
      const alreadyAssigned = (users || []).find((u: any) =>
        u.user_id !== userId &&
        u.roles.includes('receptionist') &&
        u.is_active !== false &&
        u.branch_id === branchId
      );

      if (alreadyAssigned) {
        throw new Error(`La sucursal ya tiene recepcionista: ${alreadyAssigned.first_name} ${alreadyAssigned.last_name}`);
      }

      const { error } = await supabase
        .from('profiles')
        .update({ branch_id: branchId })
        .eq('id', userId)
        .eq('role', 'receptionist');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-staff-users-bento'] });
      queryClient.invalidateQueries({ queryKey: ['admin-branches-bento'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-appointments'] });
      setAssigningUser(null);
      setSelectedBranchId(null);
      Alert.alert('Exito', 'Sucursal asignada');
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return (users || []).filter(u => {
      if (!q) return filter === 'all' || u.roles.includes(filter);
      const fullName = `${u.first_name} ${u.last_name}`.toLowerCase();
      const phone = (u.phone || '').toLowerCase();
      return (fullName.includes(q) || phone.includes(q)) && (filter === 'all' || u.roles.includes(filter));
    });
  }, [users, filter, searchQuery]);

  const renderUser = useCallback(({ item }: { item: any }) => {
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
            {item.roles.includes('receptionist') && (
              <View style={styles.branchLine}>
                <Ionicons name="business-outline" size={13} color={item.branch_id ? Colors.secondary : '#ef4444'} />
                <Text style={[styles.branchText, !item.branch_id && styles.branchTextMissing]} numberOfLines={1}>
                  {item.branch_name || 'Sin sucursal asignada'}
                </Text>
              </View>
            )}
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
            style={[
              styles.statusBtn, 
              { borderColor: isActive ? '#ef4444' : Colors.secondary },
              item.user_id === user?.id && { opacity: 0.3, borderColor: '#ccc' }
            ]}
            disabled={item.user_id === user?.id}
            onPress={() => {
              if (item.user_id === user?.id) return;
              Alert.alert(isActive ? 'Baja' : 'Alta', `¿Deseas ${isActive ? 'desactivar' : 'activar'} a ${item.first_name}?`, [
                { text: 'No' },
                { text: 'Sí', onPress: () => toggleActiveMutation.mutate({ userId: item.user_id, currentStatus: isActive }) }
              ]);
            }}
          >
            <Ionicons 
              name={isActive ? "remove-circle-outline" : "add-circle-outline"} 
              size={16} 
              color={item.user_id === user?.id ? '#ccc' : (isActive ? '#ef4444' : Colors.secondary)} 
            />
            <Text style={[styles.statusBtnText, { color: item.user_id === user?.id ? '#ccc' : (isActive ? '#ef4444' : Colors.secondary) }]}>
              {isActive ? 'Dar Baja' : 'Activar'}
            </Text>
          </TouchableOpacity>

          {item.roles.includes('receptionist') && (
            <TouchableOpacity
              style={styles.assignBtn}
              onPress={() => {
                setAssigningUser(item);
                setSelectedBranchId(item.branch_id || null);
              }}
            >
              <Ionicons name="business-outline" size={16} color={Colors.primary} />
              <Text style={styles.assignBtnText}>Sucursal</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }, [user?.id, toggleActiveMutation]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Gestión de Usuarios</Text>
          <Text style={styles.headerSubtitle}>Administración de equipo</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/(dashboard)/create-staff')}>
          <Ionicons name="person-add" size={20} color="white" />
          <Text style={styles.addBtnText}>Nuevo</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={Colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Buscar por nombre o teléfono..."
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filterRow}>
        {([
          { id: 'all' as const, label: 'Todos' },
          { id: 'doctor' as const, label: 'Médicos' },
          { id: 'receptionist' as const, label: 'Recepción' }
        ] as const).map(btn => (
          <TouchableOpacity 
            key={btn.id}
            style={[styles.filterBtn, filter === btn.id && styles.filterBtnActive]}
            onPress={() => setFilter(btn.id)}
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
          initialNumToRender={10}
          maxToRenderPerBatch={5}
          windowSize={5}
          removeClippedSubviews={true}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={64} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No hay usuarios</Text>
            </View>
          }
        />
      )}

      <Modal visible={!!assigningUser} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Asignar sucursal</Text>
                <Text style={styles.modalSubtitle}>{assigningUser?.first_name} {assigningUser?.last_name}</Text>
              </View>
              <TouchableOpacity onPress={() => setAssigningUser(null)}>
                <Ionicons name="close" size={24} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.branchList}>
              {(branches || []).map((branch: any) => {
                const assignedTo = (users || []).find((u: any) =>
                  u.user_id !== assigningUser?.user_id &&
                  u.roles.includes('receptionist') &&
                  u.is_active !== false &&
                  u.branch_id === branch.id
                );
                const disabled = !!assignedTo || branch.status === 'suspended';
                const selected = selectedBranchId === branch.id;

                return (
                  <TouchableOpacity
                    key={branch.id}
                    style={[styles.branchOption, selected && styles.branchOptionSelected, disabled && styles.branchOptionDisabled]}
                    disabled={disabled}
                    onPress={() => setSelectedBranchId(branch.id)}
                  >
                    <View style={styles.branchOptionIcon}>
                      <Ionicons name={selected ? 'checkmark-circle' : 'business-outline'} size={20} color={selected ? Colors.secondary : Colors.textMuted} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.branchOptionName}>{branch.name}</Text>
                      <Text style={styles.branchOptionMeta}>
                        {assignedTo ? `Ocupada por ${assignedTo.first_name} ${assignedTo.last_name}` : branch.status === 'suspended' ? 'Sucursal suspendida' : 'Disponible'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveBranchBtn, !selectedBranchId && styles.saveBranchBtnDisabled]}
              disabled={!selectedBranchId || assignBranchMutation.isPending}
              onPress={() => assignBranchMutation.mutate({ userId: assigningUser.user_id, branchId: selectedBranchId! })}
            >
              <Text style={styles.saveBranchBtnText}>{assignBranchMutation.isPending ? 'Guardando...' : 'Guardar asignacion'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xl,
  },
  backBtn: { marginRight: 12, padding: 4 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: Colors.primary },
  headerSubtitle: { fontSize: 13, color: Colors.textMuted, fontWeight: '600' },
  addBtn: { 
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.secondary,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
  },
  addBtnText: { color: 'white', fontWeight: '800', fontSize: 13 },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'white',
    marginHorizontal: Spacing.lg, marginBottom: Spacing.md,
    borderRadius: 16, paddingHorizontal: 14, borderWidth: 1, borderColor: '#e2e8f0',
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: Colors.text },
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
  branchLine: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  branchText: { flex: 1, fontSize: 12, fontWeight: '700', color: Colors.secondary },
  branchTextMissing: { color: '#ef4444' },
  inactiveTag: { backgroundColor: '#fee2e2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  inactiveTagText: { color: '#ef4444', fontSize: 10, fontWeight: '900' },
  cardFooter: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap',
    borderTopWidth: 1, borderTopColor: '#f1f5f9', marginTop: Spacing.md, paddingTop: Spacing.md,
  },
  phoneGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  phoneText: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  statusBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  statusBtnText: { fontSize: 12, fontWeight: '800' },
  assignBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  assignBtnText: { fontSize: 12, fontWeight: '800', color: Colors.primary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: Colors.textMuted, fontWeight: '600', marginTop: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: 20, fontWeight: '900', color: Colors.primary },
  modalSubtitle: { fontSize: 13, color: Colors.textMuted, fontWeight: '700', marginTop: 2 },
  branchList: { gap: 10, paddingBottom: Spacing.md },
  branchOption: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  branchOptionSelected: { borderColor: Colors.secondary, backgroundColor: '#f0fdf4' },
  branchOptionDisabled: { opacity: 0.45 },
  branchOptionIcon: { width: 28, alignItems: 'center' },
  branchOptionName: { fontSize: 15, fontWeight: '800', color: Colors.primary },
  branchOptionMeta: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, marginTop: 2 },
  saveBranchBtn: { backgroundColor: Colors.secondary, alignItems: 'center', padding: 14, borderRadius: 16 },
  saveBranchBtnDisabled: { opacity: 0.5 },
  saveBranchBtnText: { color: 'white', fontSize: 14, fontWeight: '900' },
});
