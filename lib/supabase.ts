import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Adapter para almacenamiento: SecureStore en móvil, localStorage en Web
const isWeb = Platform.OS === 'web';

const storageAdapter = {
  getItem: (key: string) => {
    if (isWeb) {
      if (typeof window !== 'undefined') {
        return window.localStorage.getItem(key);
      }
      return null;
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    if (isWeb) {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, value);
      }
      return;
    }
    SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    if (isWeb) {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
      return;
    }
    SecureStore.deleteItemAsync(key);
  },
};

// IMPORTANTE: Usa las mismas credenciales que tu proyecto web
const SUPABASE_URL = 'https://lzajurbkaynigljrsfab.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6YWp1cmJrYXluaWdsanJzZmFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MDI4MzAsImV4cCI6MjA5MDI3ODgzMH0.eCQlThFo5PmZbWayKwpERp-OrAh5DmY-LgGNZEclYXc';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: storageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
