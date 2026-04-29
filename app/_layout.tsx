import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Toast from 'react-native-toast-message';
import { AuthProvider, useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';
import NotificationHandler from '../components/notifications/NotificationHandler';

const queryClient = new QueryClient();

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useNotifications();

  useEffect(() => {
    if (loading) return;

    const rootSegment = segments[0];
    const inAuthGroup = segments.includes('(dashboard)');
    const isPublicPage = !rootSegment || ['login', 'register', 'forgot-password', 'index'].includes(rootSegment);

    if (user) {
      // Si está logueado y está en una página pública (como login), mandarlo al home
      // Pero solo si NO estamos ya en el dashboard para evitar el loop
      if (isPublicPage && rootSegment !== 'register') {
        router.replace('/(dashboard)/home');
      }
    } else {
      // Si NO está logueado y trata de entrar al dashboard, mandarlo al login
      if (inAuthGroup) {
        router.replace('/login');
      }
    }
  }, [user, loading, segments[0]]); // Solo dependemos del segmento principal

  return (
    <>
      <NotificationHandler />
      {children}
    </>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <AuthProvider>
          <AuthGate>
            <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', gestureEnabled: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="login" />
              <Stack.Screen name="register" />
              <Stack.Screen name="forgot-password" />
              <Stack.Screen name="(dashboard)" />
            </Stack>
          </AuthGate>
          <StatusBar style="dark" />
          <Toast />
        </AuthProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}