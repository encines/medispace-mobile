import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';

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
  branch_id: string | null;
}

  interface AuthContextType {
    user: User | null;
    session: Session | null;
    roles: AppRole[];
    profile: Profile | null;
    loading: boolean;
    signOut: () => Promise<void>;
    signOutLocal: () => Promise<void>;
    refreshProfile: (userId?: string) => Promise<void>;
    signIn: (email: string, password: string) => Promise<any>;
  }

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  roles: [],
  profile: null,
  loading: true,
  signOut: async () => {},
  signOutLocal: async () => {},
  refreshProfile: async () => {},
  signIn: async () => ({}),
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const segments = useSegments();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const queryClient = useQueryClient();

  const clearAuth = async (shouldSignOutSDK = true) => {
    // cleared local auth state
    setUser(null);
    setSession(null);
    setRoles([]);
    setProfile(null);

    if (shouldSignOutSDK) {
      try {
        // Attempt to call the SDK local signOut, but don't block forever.
        const signOutLocalPromise = supabase.auth.signOut({ scope: 'local' });
        const raced = await Promise.race([
          signOutLocalPromise.then((r) => ({ res: r })),
          new Promise((resolve) => setTimeout(() => resolve({ timedOut: true }), 3000)),
        ]) as { res?: any; timedOut?: true };

        if ((raced as any).timedOut) {
          if (__DEV__) console.warn('clearAuth: supabase.auth.signOut(local) timed out — falling back to clearing AsyncStorage keys');
          try {
            const keys = await AsyncStorage.getAllKeys();
            const keysToRemove = keys.filter((k) => typeof k === 'string' && (k.includes('supabase') || k.includes('sb:') || k.includes('sb-') || k.includes('supabase.auth')));
            if (keysToRemove.length > 0) {
          // removed persisted auth keys
              await Promise.all(keysToRemove.map((k) => AsyncStorage.removeItem(k)));
            }
          } catch (e) {
            if (__DEV__) console.warn('clearAuth: failed to remove AsyncStorage keys', e);
          }
        }
      } catch (e) {
        if (__DEV__) console.warn('clearAuth: supabase.auth.signOut failed', e);
      }
    }

    // Clear react-query caches related to authenticated requests so UI
    // doesn't keep showing stale/blocked loaders after session changes.
    try {
      queryClient.invalidateQueries();
    } catch (e) {
      if (__DEV__) console.warn('clearAuth: failed to invalidate queries', e);
    }
  };

  const fetchUserData = async (userId: string) => {
    try {
      // fetchUserData start
      // 1. Fetch user base data
      // querying profiles
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      // profiles query returned

      if (userError) {
        if (userError.message?.includes('Refresh Token') || userError.message?.includes('invalid_grant')) {
          if (__DEV__) console.warn('Auth error during fetchUserData, signing out...');
          clearAuth();
          return;
        }
        if (userError.code !== 'PGRST116') {
          console.error('Error fetching user base data:', userError);
        }
      }

      const role = (userData?.role as AppRole) || 'patient';
      // detected role
      setRoles([role]);

      let combinedProfile: Profile | null = null;

      if (userData) {
        // Build base profile
        combinedProfile = {
          user_id: userData.id,
          first_name: userData.first_name,
          last_name: userData.last_name || '',
          phone: userData.phone,
          avatar_url: userData.avatar_url,
          specialty: null,
          consultation_fee: null,
          medical_license: null,
          date_of_birth: null,
          gender: null,
          address: null,
          blood_type: null,
          allergies: null,
          emergency_contact_name: null,
          emergency_contact_phone: null,
          branch_id: userData.branch_id || null,
        };

        // Fetch details based on role
        if (role === 'patient') {
          // querying patient_details
          const { data: patientDetails, error: patientError } = await supabase
            .from('patient_details')
            .select('*')
            .eq('user_id', userId)
            .single();

          // patient_details returned

          if (patientDetails) {
            combinedProfile = {
              ...combinedProfile,
              date_of_birth: patientDetails.birth_date,
              gender: patientDetails.gender,
              address: patientDetails.address,
              blood_type: patientDetails.blood_type,
              allergies: patientDetails.allergies,
              emergency_contact_name: patientDetails.emergency_contact_name,
              emergency_contact_phone: patientDetails.emergency_contact_phone,
            };
          }
        } else if (role === 'doctor') {
          // querying doctor_details
          const { data: doctorDetails, error: doctorError } = await supabase
            .from('doctor_details')
            .select('*')
            .eq('user_id', userId)
            .single();

          // doctor_details returned

          if (doctorDetails) {
            combinedProfile = {
              ...combinedProfile,
              specialty: doctorDetails.specialty,
              consultation_fee: doctorDetails.consultation_fee,
              medical_license: doctorDetails.medical_license,
            };
          }
        }
      }

      setProfile(combinedProfile);
      // fetchUserData done
    } catch (error: any) {
      console.error('Unexpected error in fetchUserData:', error);
      if (error.message?.includes('Refresh Token')) {
        clearAuth();
      }
    }
  };

  const refreshProfile = async (userId?: string) => {
    const id = userId ?? user?.id;
    if (id) {
      await fetchUserData(id);
    }
  };

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        if (error) {
          if (__DEV__) console.warn('Session recovery error:', error.message);
          clearAuth();
        } else if (initialSession) {
          setSession(initialSession);
          setUser(initialSession.user);
          // Fetch profile in background; do not block startup if this hangs.
          fetchUserData(initialSession.user.id).catch((e) => { if (__DEV__) console.warn('checkSession: fetchUserData failed', e); });
        } else {
          // No session found, ensure local state is clear
          clearAuth();
        }
      } catch (err: any) {
        console.error('Auth init error:', err.message || err);
        clearAuth();
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      // auth event: (filtered)

      if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
        if (currentSession) {
          setSession(currentSession);
          setUser(currentSession.user);
          // Do not await here to avoid blocking auth listener if DB is slow.
          fetchUserData(currentSession.user.id).catch((e) => { if (__DEV__) console.warn('onAuthStateChange: fetchUserData failed', e); });
        } else {
          clearAuth(false);
        }
      } else if (event === 'SIGNED_OUT') {
        clearAuth(false);
      } else if (!currentSession && (event as any) === 'INITIAL_SESSION') {
        clearAuth(false);
      }

      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Fallback: if we have a valid user but profile wasn't loaded for any reason,
  // attempt to fetch it so the UI can render the account data.
  useEffect(() => {
    if (!loading && user && !profile) {
      // user present but profile missing; fetching profile
      fetchUserData(user.id).catch((e) => { if (__DEV__) console.warn('AuthProvider: fallback fetchUserData failed', e); });
    }
  }, [loading, user?.id, profile]);

  const signOutLocal = async () => {
    // Local-only clear that also removes persisted SDK session data.
    // This calls the SDK signOut with scope='local' so stored tokens are
    // cleared from the storage adapter without attempting a server call.
    await clearAuth(true);
    setLoading(false);
    try {
      // If we're inside the dashboard, force navigation to login so UI resets
      const inAuthGroup = segments.includes('(dashboard)');
      if (inAuthGroup) router.replace('/login');
    } catch (e) {
      if (__DEV__) console.warn('signOutLocal: router.replace failed', e);
    }
  };

  const signOut = async () => {
    try {
    // signOut called
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      // signOut resolved
      // Clear local auth state immediately to avoid races where the SDK's
      // onAuthStateChange arrives slightly later. This ensures consumers
      // see user===null right after signOut and navigation logic doesn't
      // redirect back into authenticated routes.
      await clearAuth(false);
      setLoading(false);
      Toast.show({ type: 'success', text1: 'Sesión cerrada' });
      // Navigate to login explicitly to ensure UI is reset
      try { router.replace('/login'); } catch (e) { if (__DEV__) console.warn('signOut: router.replace failed', e); }
    } catch (error: any) {
      console.error('SignOut error:', error?.message ?? error);
      clearAuth();
      Toast.show({ type: 'error', text1: 'Error', text2: 'No se pudo cerrar sesión. Se ha forzado el cierre local.' });
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // After sign-in, read the active session from the SDK to ensure
      // we get the canonical session object persisted by the client.
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
        if (__DEV__) console.warn('signIn: getSession returned error', sessionError);
        }
        const currentSession = (sessionData as any)?.session ?? null;
        const currentUser = currentSession?.user ?? (data as any)?.user ?? null;
        if (currentSession) setSession(currentSession as Session);
        if (currentUser) setUser(currentUser as User);

        if (currentUser?.id) {
          // Fetch profile in background; do not block signIn response on DB latency
          fetchUserData(currentUser.id).catch((e) => { if (__DEV__) console.warn('signIn: fetchUserData failed', e); });
        }
      } catch (e) {
        if (__DEV__) console.warn('signIn: failed to getSession after signIn', e);
      }

      return { data, error };
    } catch (e) {
      // Log only the message to avoid dumping a full call stack in dev
      // console — the UI already shows a friendly toast. Keeping a warn
      // helps debugging without spamming the console with stacks.
      if (__DEV__) console.warn('signIn error', (e as any)?.message ?? e);
      throw e;
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, roles, profile, loading, signOut, signOutLocal, refreshProfile, signIn }}>
      {children}
    </AuthContext.Provider>
  );
};
