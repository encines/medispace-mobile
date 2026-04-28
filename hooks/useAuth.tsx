import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import Toast from 'react-native-toast-message';

type AppRole = 'admin' | 'doctor' | 'receptionist' | 'patient';

interface Profile {
  user_id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  specialty: string | null;
  consultation_fee: number | null;
  medical_license: string | null;
  date_of_birth: string | null;
  gender: string | null;
  address: string | null;
  blood_type: string | null;
  allergies: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  avatar_url: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  roles: [],
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const clearAuth = () => {
    setUser(null);
    setSession(null);
    setRoles([]);
    setProfile(null);
  };

  const fetchUserData = async (userId: string) => {
    try {
      const [rolesRes, profileRes] = await Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', userId),
        supabase.from('profiles').select('user_id, first_name, last_name, phone, specialty, consultation_fee, medical_license, date_of_birth, gender, address, blood_type, allergies, emergency_contact_name, emergency_contact_phone, avatar_url').eq('user_id', userId).single(),
      ]);
      
      if (rolesRes.error && rolesRes.error.code !== 'PGRST116') {
        console.error('Error fetching roles:', rolesRes.error);
      }
      
      if (profileRes.error && profileRes.error.code !== 'PGRST116') {
        console.error('Error fetching profile:', profileRes.error);
      }

      setRoles(rolesRes.data?.map(r => r.role as AppRole) || []);
      setProfile(profileRes.data || null);
    } catch (error) {
      console.error('Unexpected error in fetchUserData:', error);
    }
  };

  const refreshProfile = async () => {
    if (user?.id) {
      await fetchUserData(user.id);
    }
  };

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        if (error) {
          console.log('Session recovery error:', error.message);
          clearAuth();
        } else if (initialSession) {
          setSession(initialSession);
          setUser(initialSession.user);
          await fetchUserData(initialSession.user.id);
        }
      } catch (err) {
        console.error('Auth init error:', err);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log('Auth Event:', event);

      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        if (currentSession?.user) {
          await fetchUserData(currentSession.user.id);
        }
      } else if (event === 'SIGNED_OUT') {
        clearAuth();
      } else if (currentSession) {
        // Otros eventos con sesión activa
        setSession(currentSession);
        setUser(currentSession.user);
      }

      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error: any) {
      console.error('SignOut error:', error.message);
      // Forzamos limpieza local aunque falle el servidor
      clearAuth();
      Toast.show({ type: 'error', text1: 'Error al cerrar sesión', text2: 'Se ha forzado el cierre local.' });
    } finally {
      Toast.show({ type: 'success', text1: 'Sesión cerrada' });
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, roles, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
