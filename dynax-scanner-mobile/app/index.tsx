import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/auth/auth';
import { theme } from '@/theme';

export default function Index() {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.color.bg }}>
        <ActivityIndicator color={theme.color.teal} />
      </View>
    );
  }
  return <Redirect href={token ? '/(app)' : '/sign-in'} />;
}
