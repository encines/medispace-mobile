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

  const fetchUserData = async (userId: string) => {
    const [rolesRes, profileRes] = await Promise.all([
      supabase.from('user_roles').select('role').eq('user_id', userId),
      supabase.from('profiles').select('user_id, first_name, last_name, phone, specialty, consultation_fee, medical_license, date_of_birth, gender, address, blood_type, allergies, emergency_contact_name, emergency_contact_phone, avatar_url').eq('user_id', userId).single(),
    ]);
    if (rolesRes.data) setRoles(rolesRes.data.map(r => r.role as AppRole));
    if (profileRes.data) setProfile(profileRes.data);
  };

  const refreshProfile = async () => {
    if (user?.id) await fetchUserData(user.id);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchUserData(session.user.id);
      } else {
        setRoles([]);
        setProfile(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchUserData(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      Toast.show({ type: 'success', text1: 'Sesión cerrada correctamente' });
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.message });
    } finally {
      setUser(null);
      setSession(null);
      setRoles([]);
      setProfile(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, roles, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
