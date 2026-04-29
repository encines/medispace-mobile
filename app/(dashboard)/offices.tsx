import { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, ActivityIndicator, Alert, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../constants/theme';

export default function GlobalOfficesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { branchId: paramBranchId, branchName: paramBranchName } = useLocalSearchParams();
  
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>((paramBranchId as string) || null);
  const [editingOffice, setEditingOffice] = useState<any>(null);
  const [name, setName] = useState('');
  const [floor, setFloor] = useState('');
  const [status, setStatus] = useState<'active' | 'suspended'>('active');


  const { data: branches } = useQuery({
    queryKey: ['admin-branches-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('branches').select('*').order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: offices, isLoading, refetch } = useQuery({
    queryKey: ['admin-offices-global', selectedBranchId],
    queryFn: async () => {
      let query = supabase.from('offices').select('*, branches(name)').order('name');
      if (selectedBranchId) {
        query = query.eq('branch_id', selectedBranchId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBranchId || !name) return;
      
      const payload = { 
        name, 
        floor, 
        branch_id: selectedBranchId,
        status 
      };

      if (editingOffice) {
        const { error } = await supabase
          .from('offices')
          .update(payload)
          .eq('id', editingOffice.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('offices')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-offices'] });
      queryClient.invalidateQueries({ queryKey: ['admin-offices-all'] });
      queryClient.invalidateQueries({ queryKey: ['admin-offices-global'] });
      Alert.alert('Éxito', editingOffice ? 'Consultorio actualizado' : 'Consultorio creado');
      closeModal();
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const openModal = (office?: any) => {
    if (office) {
      setEditingOffice(office);
      setName(office.name);
      setFloor(office.floor || '');
      setStatus(office.status || 'active');
      setSelectedBranchId(office.branch_id);
    } else {
      setEditingOffice(null);
      setName('');
      setFloor('');
      setStatus('active');
    }
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingOffice(null);
    setName('');
    setFloor('');
    setStatus('active');
  };

  const renderOffice = ({ item }: { item: any }) => {
    const isActive = item.status === 'active';
    return (
      <View style={[styles.card, !isActive && styles.cardInactive]}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconBox, { backgroundColor: isActive ? '#f0fdf4' : '#f1f5f9' }]}>
            <Ionicons name="enter-outline" size={24} color={isActive ? '#16a34a' : Colors.textMuted} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.officeName}>{item.name}</Text>
            <Text style={styles.officeBranch}>{item.branches?.name} {item.floor && `· ${item.floor}`}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: isActive ? '#f0fdf4' : '#fee2e2' }]}>
            <Text style={[styles.statusBadgeText, { color: isActive ? '#16a34a' : '#ef4444' }]}>
              {isActive ? 'Activo' : 'Suspendido'}
            </Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <TouchableOpacity 
            style={styles.footerAction}
            onPress={() => openModal(item)}
          >
            <Ionicons name="create-outline" size={16} color={Colors.primary} />
            <Text style={styles.footerActionText}>Editar</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.footerAction}
            onPress={() => router.push({ pathname: '/(dashboard)/assignments', params: { officeId: item.id, officeName: item.name, branchName: item.branches?.name } })}
          >
            <Ionicons name="calendar-outline" size={16} color={Colors.secondary} />
            <Text style={[styles.footerActionText, { color: Colors.secondary }]}>Horarios</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Consultorios</Text>
          <Text style={styles.headerSubtitle}>Infraestructura operativa</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={26} color="white" />
        </TouchableOpacity>
      </View>

      <View style={styles.filterSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <TouchableOpacity 
            style={[styles.filterChip, !selectedBranchId && styles.filterChipActive]}
            onPress={() => setSelectedBranchId(null)}
          >
            <Text style={[styles.filterChipText, !selectedBranchId && styles.filterChipTextActive]}>Todas los consultorios</Text>
          </TouchableOpacity>
          {branches?.map(b => (
            <TouchableOpacity 
              key={b.id} 
              style={[styles.filterChip, selectedBranchId === b.id && styles.filterChipActive]}
              onPress={() => setSelectedBranchId(b.id)}
            >
              <Text style={[styles.filterChipText, selectedBranchId === b.id && styles.filterChipTextActive]}>{b.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.secondary} />
        </View>
      ) : (
        <FlatList
          data={offices}
          renderItem={renderOffice}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} colors={[Colors.secondary]} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="home-outline" size={64} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No hay consultorios registrados</Text>
            </View>
          }
        />
      )}

      <Modal visible={modalVisible} animationType="fade" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingOffice ? 'Editar' : 'Nuevo'} Consultorio</Text>
            
            <View style={styles.form}>
              <Text style={styles.label}>Sucursal</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.branchSelect}>
                {branches?.map(b => (
                  <TouchableOpacity 
                    key={b.id} 
                    style={[styles.miniChip, selectedBranchId === b.id && styles.miniChipActive]}
                    onPress={() => setSelectedBranchId(b.id)}
                  >
                    <Text style={[styles.miniChipText, selectedBranchId === b.id && { color: 'white' }]}>{b.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TextInput 
                style={styles.input} 
                value={name} 
                onChangeText={setName} 
                placeholder="Nombre (ej. Consultorio 1)"
                placeholderTextColor={Colors.textMuted}
              />

              <TextInput 
                style={styles.input} 
                value={floor} 
                onChangeText={setFloor} 
                placeholder="Ubicación/Piso (ej. Planta Baja)"
                placeholderTextColor={Colors.textMuted}
              />

              <Text style={styles.label}>Estatus</Text>
              <View style={styles.statusRow}>
                <TouchableOpacity 
                  style={[styles.statusOption, status === 'active' && styles.statusOptionActive]}
                  onPress={() => setStatus('active')}
                >
                  <Text style={[styles.statusOptionText, status === 'active' && { color: 'white' }]}>Activo</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.statusOption, status === 'suspended' && styles.statusOptionSuspended]}
                  onPress={() => {
                    Alert.alert(
                      'Suspender Consultorio',
                      '¿Estás seguro de que deseas suspender este consultorio? Los pacientes no podrán agendar citas aquí hasta que se reactive.',
                      [
                        { text: 'Cancelar', style: 'cancel' },
                        { text: 'Si, suspender', style: 'destructive', onPress: () => setStatus('suspended') }
                      ]
                    );
                  }}
                >
                  <Text style={[styles.statusOptionText, status === 'suspended' && { color: 'white' }]}>Suspendido</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.confirmBtn, (!selectedBranchId || !name) && styles.disabledBtn]} 
                  onPress={() => saveMutation.mutate()}
                  disabled={!selectedBranchId || !name || saveMutation.isPending}
                >
                  <Text style={styles.confirmBtnText}>{saveMutation.isPending ? 'Sincronizando...' : (editingOffice ? 'Guardar' : 'Crear')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fcfcfc' },
  header: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xl,
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: Colors.primary },
  headerSubtitle: { fontSize: 13, color: Colors.textMuted, fontWeight: '600' },
  addBtn: { 
    width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', elevation: 4,
  },
  filterSection: { marginBottom: Spacing.md },
  filterScroll: { paddingHorizontal: Spacing.lg, gap: 10 },
  filterChip: { 
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, 
    borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: 'white',
  },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  filterChipTextActive: { color: 'white' },
  list: { padding: Spacing.lg, paddingBottom: 100 },
  card: { 
    backgroundColor: 'white', borderRadius: 20, padding: Spacing.md, 
    marginBottom: Spacing.md, borderWidth: 1, borderColor: '#f1f5f9',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  cardInactive: { opacity: 0.6, backgroundColor: '#f8fafc' },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, marginLeft: Spacing.md },
  officeName: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  officeBranch: { fontSize: 12, color: '#94a3b8', marginTop: 2, fontWeight: '600' },
  statusBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  cardFooter: { 
    borderTopWidth: 1, borderTopColor: '#f1f5f9', marginTop: Spacing.md, paddingTop: Spacing.md,
  },
  footerAction: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerActionText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: Spacing.xl },
  modalContent: { backgroundColor: 'white', borderRadius: 24, padding: Spacing.xl },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.primary, marginBottom: Spacing.lg },
  form: { gap: Spacing.md },
  label: { fontSize: 13, fontWeight: '700', color: '#64748b', marginLeft: 4 },
  branchSelect: { flexDirection: 'row', marginBottom: 4 },
  miniChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#f1f5f9', marginRight: 6 },
  miniChipActive: { backgroundColor: Colors.secondary },
  miniChipText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  input: { 
    backgroundColor: '#f8fafc', borderRadius: 12, padding: 14, 
    fontSize: 14, color: Colors.text, borderWidth: 1, borderColor: '#e2e8f0',
  },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: Spacing.lg },
  cancelBtn: { flex: 1, padding: 14, alignItems: 'center' },
  cancelBtnText: { color: '#ef4444', fontWeight: '700' },
  confirmBtn: { flex: 1, backgroundColor: Colors.secondary, padding: 14, borderRadius: 12, alignItems: 'center' },
  confirmBtnText: { color: 'white', fontWeight: '800' },
  disabledBtn: { opacity: 0.5 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', marginTop: 100, gap: Spacing.md },
  emptyText: { fontSize: FontSizes.md, color: Colors.textMuted, fontWeight: '600' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusBadgeText: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  statusRow: { flexDirection: 'row', gap: 10 },
  statusOption: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: '#f1f5f9', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  statusOptionActive: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  statusOptionSuspended: { backgroundColor: '#ef4444', borderColor: '#ef4444' },
  statusOptionText: { fontSize: 13, fontWeight: '700', color: '#475569' },
});
