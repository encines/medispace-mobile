import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../../constants/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, roles, signOut, user, refreshProfile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const isDoctor = roles.includes('doctor');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshProfile();
    setRefreshing(false);
  };

  const primaryRole = roles.includes('admin') ? 'Administrador'
    : roles.includes('doctor') ? 'Doctor'
    : roles.includes('receptionist') ? 'Recepcionista'
    : 'Paciente';

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Necesitamos acceso a tu galería para cambiar la foto.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true, // Solicitar base64 explícitamente
    });

    if (!result.canceled && result.assets[0].base64) {
      uploadAvatar(result.assets[0].uri, result.assets[0].base64);
    }
  };

  const uploadAvatar = async (uri: string, base64Data: string) => {
    if (!user) return;
    setUploading(true);

    try {
      // 1. Convert Base64 to Uint8Array (the most stable way in RN)
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);

      if (byteArray.length === 0) {
        throw new Error("Los datos de la imagen están vacíos.");
      }

      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // 2. Upload to storage using Uint8Array
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, byteArray, {
          contentType: `image/${fileExt === 'jpg' || fileExt === 'jpeg' ? 'jpeg' : fileExt}`,
          upsert: true
        });

      if (uploadError) throw uploadError;

      // 3. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // 4. Update Profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      console.log("Avatar updated with Base64. URL:", publicUrl, "Bytes:", byteArray.length);

      await refreshProfile();
      Toast.show({ type: 'success', text1: '¡Éxito!', text2: 'Foto de perfil actualizada correctamente' });
    } catch (error: any) {
      console.error("Avatar upload error:", error);
      Alert.alert('Error de Subida', error.message || 'No se pudo procesar la imagen seleccionada.');
    } finally {
      setUploading(false);
    }
  };

  const menuItems = [
    { 
      id: 'edit', 
      title: 'Editar Perfil', 
      icon: 'person-outline', 
      color: Colors.secondary, 
      onPress: () => router.push('/(dashboard)/edit-profile') 
    },
    { 
      id: 'password', 
      title: 'Cambiar Contraseña', 
      icon: 'lock-closed-outline', 
      color: '#6366f1', 
      onPress: () => router.push('/(dashboard)/change-password') 
    },
    { 
      id: 'faq', 
      title: 'Preguntas Frecuentes', 
      icon: 'help-circle-outline', 
      color: '#10b981', 
      onPress: () => router.push('/(dashboard)/faq') 
    },
    { 
      id: 'legal', 
      title: 'Aviso de Privacidad y Legal', 
      icon: 'document-text-outline', 
      color: '#64748b', 
      onPress: () => router.push('/(dashboard)/legal') 
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.headerTitle}>Mi Cuenta</Text>

        {/* Avatar & Name Header */}
        <View style={styles.profileHeader}>
          <TouchableOpacity 
            style={styles.avatarContainer} 
            onPress={pickImage} 
            disabled={uploading}
            activeOpacity={0.8}
          >
            {profile?.avatar_url ? (
              <Image 
                key={`${profile.avatar_url}-${Date.now()}`}
                source={{ uri: `${profile.avatar_url}?t=${Date.now()}` }} 
                style={styles.avatarImage} 
                onError={(e) => {
                  console.warn("Failed to load avatar:", e.nativeEvent.error, "URL:", profile.avatar_url);
                }}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {profile?.first_name?.[0]}{profile?.last_name?.[0]}
                </Text>
              </View>
            )}
            <View style={styles.cameraIconContainer}>
              {uploading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="camera" size={14} color="white" />
              )}
            </View>
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.name}>{profile?.first_name} {profile?.last_name}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{primaryRole}</Text>
            </View>
          </View>
        </View>

        {/* Action Menu */}
        <View style={styles.menuContainer}>
          {menuItems.map((item) => (
            <TouchableOpacity 
              key={item.id} 
              style={styles.menuItem} 
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: `${item.color}15` }]}>
                <Ionicons name={item.icon as any} size={22} color={item.color} />
              </View>
              <Text style={styles.menuTitle}>{item.title}</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Danger Zone */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.logoutBtn} onPress={signOut} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={20} color={Colors.error} />
            <Text style={styles.logoutText}>Cerrar Sesión</Text>
          </TouchableOpacity>
          <Text style={styles.version}>MediSpace Mobile v1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg },
  headerTitle: { fontSize: 28, fontWeight: '800', color: Colors.primary, marginBottom: Spacing.xl, marginTop: Spacing.sm },
  profileHeader: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, 
    padding: Spacing.lg, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border,
    marginBottom: Spacing.xl,
  },
  avatarContainer: {
    width: 80, height: 80, borderRadius: 40, position: 'relative',
  },
  avatarPlaceholder: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.secondaryLight,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  avatarImage: { width: 80, height: 80, borderRadius: 40, borderWidth: 1, borderColor: Colors.border },
  cameraIconContainer: {
    position: 'absolute', bottom: 0, right: 0, backgroundColor: Colors.secondary,
    width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'white',
  },
  avatarText: { fontSize: FontSizes.xxl, fontWeight: '800', color: Colors.secondary },
  headerInfo: { marginLeft: Spacing.lg, flex: 1 },
  name: { fontSize: FontSizes.lg, fontWeight: '800', color: Colors.primary },
  roleBadge: {
    backgroundColor: Colors.secondaryLight, paddingHorizontal: Spacing.md,
    paddingVertical: 2, borderRadius: BorderRadius.full, marginTop: 4, alignSelf: 'flex-start',
  },
  roleText: { fontSize: 12, fontWeight: '700', color: Colors.secondary },
  menuContainer: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  menuItem: { 
    flexDirection: 'row', alignItems: 'center', padding: Spacing.md, 
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  menuIconContainer: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.md },
  menuTitle: { flex: 1, fontSize: FontSizes.md, fontWeight: '600', color: Colors.text },
  footer: { marginTop: Spacing.xxl },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, padding: Spacing.md, borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.error, marginBottom: Spacing.lg,
  },
  logoutText: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.error },
  version: { textAlign: 'center', fontSize: FontSizes.xs, color: Colors.textMuted },
});
