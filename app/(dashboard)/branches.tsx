import { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, ActivityIndicator, Alert, RefreshControl, ScrollView, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../constants/theme';

export default function BentoBranchesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBranch, setEditingBranch] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    status: 'active' as 'active' | 'suspended',
  });

  const { data: branches, isLoading, refetch } = useQuery({
    queryKey: ['admin-branches-bento'],
    queryFn: async () => {
      const { data, error } = await supabase.from('branches').select('*').order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingBranch) {
        const { error } = await supabase.from('branches').update(formData).eq('id', editingBranch.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('branches').insert(formData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-branches-bento'] });
      queryClient.invalidateQueries({ queryKey: ['admin-branches-list'] });
      Alert.alert('Éxito', 'Sucursal guardada');
      closeModal();
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const openModal = (branch?: any) => {
    if (branch) {
      setEditingBranch(branch);
      setFormData({ 
        name: branch.name, 
        address: branch.address, 
        phone: branch.phone || '', 
        status: (branch.status || 'active') as 'active' | 'suspended' 
      });
    } else {
      setEditingBranch(null);
      setFormData({ name: '', address: '', phone: '', status: 'active' });
    }
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingBranch(null);
  };

  const renderBranch = ({ item, index }: { item: any, index: number }) => {
    const isMain = index === 0;
    return (
      <View style={[styles.branchCard, isMain && styles.mainBranchCard]}>
        <View style={styles.cardTop}>
          <View style={[styles.iconBox, { backgroundColor: isMain ? '#eff6ff' : '#f8fafc' }]}>
            <Ionicons name={isMain ? "business" : "location"} size={24} color={isMain ? Colors.primary : Colors.textMuted} />
          </View>
          <View style={styles.headerBadges}>
            {isMain && (
              <View style={styles.principalBadge}>
                <Text style={styles.principalBadgeText}>SEDE PRINCIPAL</Text>
              </View>
            )}
              <View style={[styles.statusBadge, { backgroundColor: item.status === 'active' || !item.status ? '#f0fdf4' : '#fee2e2' }]}>
                <Text style={[styles.statusBadgeText, { color: item.status === 'active' || !item.status ? '#16a34a' : '#ef4444' }]}>
                  {item.status === 'active' || !item.status ? 'Activo' : 'Suspendido'}
                </Text>
              </View>
          </View>
        </View>

        <View style={styles.cardContent}>
          <Text style={styles.branchName}>{item.name}</Text>
          <View style={styles.infoRow}>
            <Ionicons name="map-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.branchAddress} numberOfLines={2}>{item.address}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.branchPhone}>{item.phone || 'N/A'}</Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <TouchableOpacity 
            style={styles.editBtn}
            onPress={() => openModal(item)}
          >
            <Ionicons name="create-outline" size={16} color={Colors.primary} />
            <Text style={styles.editBtnText}>Editar</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.officesBtn}
            onPress={() => router.push({ pathname: '/(dashboard)/offices', params: { branchId: item.id, branchName: item.name } })}
          >
            <Text style={styles.officesBtnText}>Consultorios</Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.secondary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Sucursales</Text>
          <Text style={styles.headerSubtitle}>Gestión de red MediSpace</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => openModal()}>
          <Ionicons name="add-circle" size={24} color="white" />
          <Text style={styles.addBtnText}>Añadir</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.secondary} />
        </View>
      ) : (
        <FlatList
          data={branches}
          renderItem={renderBranch}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} colors={[Colors.secondary]} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="location-outline" size={64} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No hay sucursales</Text>
            </View>
          }
        />
      )}

      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={styles.modalBg}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{editingBranch ? 'Editar' : 'Nueva'} Sucursal</Text>
              
              <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                <View style={styles.form}>
                  <Text style={styles.inputLabel}>Nombre de Sede</Text>
                  <TextInput 
                    style={styles.input} 
                    value={formData.name} 
                    onChangeText={t => setFormData({...formData, name: t})} 
                    placeholder="Escribe el nombre aquí..."
                    placeholderTextColor={Colors.textMuted}
                  />
                  
                  <Text style={styles.inputLabel}>Dirección Completa</Text>
                  <TextInput 
                    style={[styles.input, { height: 100, textAlignVertical: 'top' }]} 
                    value={formData.address} 
                    onChangeText={t => setFormData({...formData, address: t})} 
                    placeholder="Calle, número, colonia, CP..."
                    placeholderTextColor={Colors.textMuted}
                    multiline
                  />
                  
                  <Text style={styles.inputLabel}>Teléfono de Contacto</Text>
                  <TextInput 
                    style={styles.input} 
                    value={formData.phone} 
                    onChangeText={t => setFormData({...formData, phone: t})} 
                    placeholder="Número telefónico"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="phone-pad"
                  />

                  <Text style={styles.inputLabel}>Estatus de Sede</Text>
                  <View style={styles.statusSwitch}>
                    <TouchableOpacity 
                      style={[styles.statusOption, formData.status === 'active' && styles.statusOptionActive]}
                      onPress={() => setFormData({...formData, status: 'active'})}
                    >
                      <Ionicons name="checkmark-circle" size={18} color={formData.status === 'active' ? 'white' : Colors.textMuted} />
                      <Text style={[styles.statusOptionText, formData.status === 'active' && styles.statusOptionTextActive]}>Activo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.statusOption, formData.status === 'suspended' && styles.statusOptionSuspended]}
                      onPress={() => {
                        Alert.alert(
                          'Suspender Sucursal',
                          '¿Estás seguro? Al suspender esta sede, todos sus consultorios dejarán de estar disponibles para nuevas citas.',
                          [
                            { text: 'Cancelar', style: 'cancel' },
                            { text: 'Confirmar Suspensión', style: 'destructive', onPress: () => setFormData({...formData, status: 'suspended'}) }
                          ]
                        );
                      }}
                    >
                      <Ionicons name="pause-circle" size={18} color={formData.status === 'suspended' ? 'white' : Colors.textMuted} />
                      <Text style={[styles.statusOptionText, formData.status === 'suspended' && styles.statusOptionTextActive]}>Suspendido</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.modalButtons}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                      <Text style={styles.cancelBtnText}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.confirmBtn, !formData.name && styles.disabledBtn]} 
                      onPress={() => saveMutation.mutate()}
                      disabled={!formData.name || saveMutation.isPending}
                    >
                      <Text style={styles.confirmBtnText}>{saveMutation.isPending ? 'Sincronizando...' : 'Confirmar'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
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
  headerTitle: { fontSize: 26, fontWeight: '800', color: Colors.primary },
  headerSubtitle: { fontSize: 13, color: Colors.textMuted, fontWeight: '600' },
  addBtn: { 
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: Colors.primary,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
  },
  addBtnText: { color: 'white', fontWeight: '800', fontSize: 13 },
  list: { padding: Spacing.lg, paddingBottom: 100 },
  branchCard: { 
    backgroundColor: 'white', borderRadius: 24, padding: Spacing.md, 
    marginBottom: Spacing.md, borderWidth: 1, borderColor: '#e2e8f0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2,
  },
  mainBranchCard: { borderColor: Colors.primary, borderWidth: 1.5 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.sm },
  iconBox: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  principalBadge: { backgroundColor: '#eff6ff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  principalBadgeText: { color: Colors.primary, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  headerBadges: { alignItems: 'flex-end', gap: 6 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusBadgeText: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  cardContent: { marginBottom: Spacing.md },
  branchName: { fontSize: 18, fontWeight: '800', color: '#1e293b', marginBottom: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 4 },
  branchAddress: { fontSize: 13, color: '#64748b', fontWeight: '500', flex: 1 },
  branchPhone: { fontSize: 12, color: '#94a3b8', fontWeight: '600' },
  cardFooter: { 
    flexDirection: 'row', justifyContent: 'space-between', 
    borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: Spacing.md,
  },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editBtnText: { fontSize: 13, fontWeight: '800', color: Colors.primary },
  officesBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  officesBtnText: { fontSize: 13, fontWeight: '800', color: Colors.secondary },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { 
    backgroundColor: 'white', borderTopLeftRadius: 40, borderTopRightRadius: 40, 
    padding: Spacing.xl, shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, 
    shadowOpacity: 0.1, shadowRadius: 20, maxHeight: '90%' 
  },
  modalTitle: { fontSize: 24, fontWeight: '800', color: Colors.primary, marginBottom: Spacing.lg },
  form: { gap: Spacing.md, paddingBottom: 40 },
  inputLabel: { fontSize: 12, fontWeight: '800', color: Colors.textMuted, textTransform: 'uppercase', marginBottom: -4, marginLeft: 4 },
  input: { 
    backgroundColor: '#f8fafc', borderRadius: 16, padding: 16, 
    fontSize: 15, color: Colors.text, borderWidth: 1, borderColor: '#e2e8f0',
  },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: Spacing.lg },
  cancelBtn: { flex: 1, padding: 16, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { color: '#ef4444', fontWeight: '800', fontSize: 15 },
  confirmBtn: { flex: 1, backgroundColor: Colors.secondary, padding: 16, borderRadius: 20, alignItems: 'center', justifyContent: 'center', shadowColor: Colors.secondary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  confirmBtnText: { color: 'white', fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, fontSize: 13 },
  disabledBtn: { opacity: 0.5 },
  statusSwitch: { flexDirection: 'row', gap: 10, marginTop: 4 },
  statusOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 16, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  statusOptionActive: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  statusOptionSuspended: { backgroundColor: '#ef4444', borderColor: '#ef4444' },
  statusOptionText: { fontSize: 14, fontWeight: '700', color: Colors.textMuted },
  statusOptionTextActive: { color: 'white' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', marginTop: 100, gap: Spacing.md },
  emptyText: { fontSize: FontSizes.md, color: Colors.textMuted, fontWeight: '600' },
});
