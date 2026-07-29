import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { GlassCard, Button } from '@/components/ui';
import { useAuth } from '@/auth/auth';
import { theme } from '@/theme';

export default function SignIn() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your DynaX email and password.');
      return;
    }
    try {
      setLoading(true);
      await signIn(email.trim(), password);
      router.replace('/(app)');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll={false} contentStyle={{ justifyContent: 'center' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ gap: theme.space(6) }}>
        <View style={{ alignItems: 'center', gap: theme.space(3) }}>
          <View style={styles.badge}>
            <Ionicons name="scan-outline" size={30} color={theme.color.white} />
          </View>
          <Text style={styles.title}>DynaX Scanner</Text>
          <Text style={styles.subtitle}>Capture, reconstruct and review 3D scans on the go.</Text>
        </View>

        <GlassCard>
          <View style={{ gap: theme.space(4) }}>
            <Field icon="mail-outline" placeholder="DynaX email" value={email} onChangeText={setEmail}
              autoCapitalize="none" keyboardType="email-address" />
            <Field icon="lock-closed-outline" placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
            {error && <Text style={styles.error}>{error}</Text>}
            <Button label="Sign in with DynaX" icon="log-in-outline" onPress={submit} loading={loading} />
          </View>
        </GlassCard>

        <Text style={styles.footer}>One DynaX account across Clinic, Scanner and Studio.</Text>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Field(props: React.ComponentProps<typeof TextInput> & { icon: keyof typeof Ionicons.glyphMap }) {
  const { icon, ...rest } = props;
  return (
    <View style={styles.field}>
      <Ionicons name={icon} size={18} color={theme.color.textMuted} />
      <TextInput
        placeholderTextColor={theme.color.textFaint}
        style={styles.input}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.color.teal,
  },
  title: { color: theme.color.text, fontSize: theme.font.h1, fontWeight: '800' },
  subtitle: { color: theme.color.textMuted, fontSize: theme.font.body, textAlign: 'center', maxWidth: 280 },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: theme.space(2),
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.color.cardBorder, paddingHorizontal: theme.space(4), height: 52,
  },
  input: { flex: 1, color: theme.color.text, fontSize: theme.font.body },
  error: { color: theme.color.red, fontSize: theme.font.small },
  footer: { color: theme.color.textFaint, fontSize: theme.font.small, textAlign: 'center' },
});
