import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { useEffect } from 'react';
import { useAuth } from './useAuth';

export const useNotifications = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (user?.id) {
      registerForPushNotificationsAsync().then(token => {
        if (token) {
          saveTokenToSupabase(user.id, token);
        }
      });
    }
  }, [user?.id]);
};

async function saveTokenToSupabase(userId: string, token: string) {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ expo_push_token: token })
      .eq('user_id', userId);
    
    if (error) {
      console.warn('Error saving push token to Supabase:', error.message);
    } else {
      console.log('Push token saved successfully for user:', userId);
    }
  } catch (err) {
    console.error('Unexpected error saving push token:', err);
  }
}

async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }
    
    // NOTE: This requires 'projectId' in app.json for production/real device testing.
    // In development mode (Expo Go), it should just work.
    try {
      token = (await Notifications.getExpoPushTokenAsync()).data;
      console.log('Expo Push Token generated:', token);
    } catch (e) {
      console.warn('Error getting Expo push token:', e);
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}
