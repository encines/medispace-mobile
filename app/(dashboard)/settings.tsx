import { View, Text, StyleSheet, ScrollView, RefreshControl, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../constants/theme';

export default function FeeSettingsScreen() {
  const { profile, user, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const [fee, setFee] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (profile?.consultation_fee !== undefined) {
      setFee(profile.consultation_fee?.toString() || '0');
    }
  }, [profile]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshProfile();
    setRefreshing(false);
  };

  const updateFeeMutation = useMutation({
    mutationFn: async (newFee: number) => {
      const { error } = await supabase
        .from('profiles')
        .update({ consultation_fee: newFee })
        .eq('user_id', user?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      refreshProfile();
      Alert.alert('Éxito', 'Tarifa actualizada correctamente');
    },
    onError: (err: any) => {
      Alert.alert('Error', 'No se pudo actualizar la tarifa: ' + err.message);
    }
  });

  const handleSave = () => {
    const numFee = parseFloat(fee);
    if (isNaN(numFee) || numFee < 0) {
      Alert.alert('Error', 'Por favor ingresa un monto válido');
      return;
    }
    updateFeeMutation.mutate(numFee);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.secondary]} />}
      >
        <Text style={styles.title}>Mi Tarifa</Text>
        
        <View style={styles.card}>
          <View style={styles.iconContainer}>
            <Ionicons name="cash-outline" size={32} color={Colors.secondary} />
          </View>
          
          <Text style={styles.cardTitle}>Costo de Consulta</Text>
          <Text style={styles.cardSubtitle}>Define el precio estándar para tus citas médicas.</Text>
          
          <View style={styles.inputWrapper}>
            <Text style={styles.currency}>$</Text>
            <TextInput
              style={styles.input}
              value={fee}
              onChangeText={setFee}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          <TouchableOpacity 
            style={[styles.saveBtn, updateFeeMutation.isPending && styles.disabledBtn]}
            onPress={handleSave}
            disabled={updateFeeMutation.isPending}
          >
            {updateFeeMutation.isPending ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.saveBtnText}>Guardar Cambios</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color={Colors.textSecondary} />
          <Text style={styles.infoText}>
            Esta tarifa será visible para los pacientes al momento de agendar una cita contigo.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: Spacing.lg },
  title: { fontSize: 32, fontWeight: '800', color: Colors.primary, marginBottom: Spacing.xl, letterSpacing: -1 },
  card: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    alignItems: 'center',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f0f9ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  cardTitle: { fontSize: 20, fontWeight: '800', color: '#1e293b', marginBottom: 4 },
  cardSubtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: Spacing.xl },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
    paddingHorizontal: 20,
    width: '100%',
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  currency: { fontSize: 24, fontWeight: '700', color: Colors.primary, marginRight: 8 },
  input: {
    flex: 1,
    height: 60,
    fontSize: 24,
    fontWeight: '800',
    color: Colors.primary,
  },
  saveBtn: {
    backgroundColor: Colors.secondary,
    width: '100%',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: { color: 'white', fontSize: 16, fontWeight: '800' },
  disabledBtn: { opacity: 0.7 },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    padding: Spacing.md,
    borderRadius: 16,
    marginTop: Spacing.xl,
    gap: 12,
    alignItems: 'center',
  },
  infoText: { flex: 1, fontSize: 13, color: '#64748b', lineHeight: 18 },
});
