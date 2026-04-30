import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { Colors, Shadows } from '../../constants/theme';

export default function DashboardLayout() {
  const { roles, loading, user } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.secondary} />
      </View>
    );
  }

  const primaryRole = roles.includes('admin') ? 'admin'
    : roles.includes('doctor') ? 'doctor'
    : roles.includes('receptionist') ? 'receptionist'
    : 'patient';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.secondary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopWidth: 0,
          paddingBottom: 20,
          paddingTop: 12,
          height: 85,
          ...Shadows.medium,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="catalog"
        options={{
          title: 'Agendar',
          tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
          href: primaryRole === 'patient' ? '/(dashboard)/catalog' : null,
        }}
      />
      <Tabs.Screen
        name="appointments"
        options={{
          title: primaryRole === 'doctor' ? 'Agenda' : 'Citas',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar-clear" size={size} color={color} />,
          href: primaryRole === 'admin' ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="records/index"
        options={{
          title: primaryRole === 'patient' ? 'Mi Expediente' : 'Expedientes',
          tabBarIcon: ({ color, size }) => <Ionicons name="documents-outline" size={size} color={color} />,
          href: primaryRole === 'doctor' ? '/(dashboard)/records' 
            : primaryRole === 'patient' ? `/(dashboard)/records/${user?.id}` 
            : null,
        }}
      />
      <Tabs.Screen
        name="assignments"
        options={{
          title: primaryRole === 'doctor' ? 'Consultorio' : 'Horarios',
          tabBarIcon: ({ color, size }) => <Ionicons name="medical-outline" size={size} color={color} />,
          href: primaryRole === 'doctor' ? '/(dashboard)/assignments' : null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Tarifa',
          tabBarIcon: ({ color, size }) => <Ionicons name="card-outline" size={size} color={color} />,
          href: null,
        }}
      />
      
      {/* Hidden tech or role-specific screens */}
      <Tabs.Screen
        name="branches"
        options={{
          title: 'Sucursales',
          tabBarIcon: ({ color, size }) => <Ionicons name="business" size={size} color={color} />,
          href: null,
        }}
      />
      <Tabs.Screen
        name="offices"
        options={{
          title: 'Consultas',
          tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} />,
          href: null,
        }}
      />
      <Tabs.Screen
        name="user-management"
        options={{
          title: 'Usuarios',
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
          href: null,
        }}
      />
      <Tabs.Screen
        name="management"
        options={{
          title: 'Gestión',
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} />,
          href: primaryRole === 'admin' ? '/(dashboard)/management' : null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
          href: null,
        }}
      />

      <Tabs.Screen
        name="receptionist-ops"
        options={{
          title: 'Operaciones',
          tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} />,
          href: primaryRole === 'receptionist' ? '/(dashboard)/receptionist-ops' : null,
        }}
      />

      <Tabs.Screen name="records/[patientId]" options={{ href: null }} />
      <Tabs.Screen name="book/[doctorId]" options={{ href: null }} />
      <Tabs.Screen name="faq" options={{ href: null }} />
      <Tabs.Screen name="legal" options={{ href: null }} />
      <Tabs.Screen name="edit-profile" options={{ href: null }} />
      <Tabs.Screen name="change-password" options={{ href: null }} />
      <Tabs.Screen name="create-staff" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
});

