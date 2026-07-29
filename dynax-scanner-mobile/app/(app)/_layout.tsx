import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/auth/auth';
import { theme } from '@/theme';

export default function AppLayout() {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.color.bg }}>
        <ActivityIndicator color={theme.color.teal} />
      </View>
    );
  }
  if (!token) return <Redirect href="/sign-in" />;

  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.color.bg } }} />;
}
