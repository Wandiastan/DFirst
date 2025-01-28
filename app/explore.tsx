import { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View, Alert } from 'react-native';
import { Link, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createAccount } from './firebase.config';

import { ThemedText } from '@/components/ThemedText';

function SignUpScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (loading) return;
    if (!name || !email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createAccount(email, password, name);
      console.log('User account created:', userCredential.user.uid);
      router.replace('/(app)/home');
    } catch (error: any) {
      console.error('Signup error:', error);
      Alert.alert(
        'Signup Error',
        error.message || 'An error occurred during signup'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <ThemedText style={styles.title}>Create Account</ThemedText>
          <ThemedText style={styles.subtitle}>Sign up to get started</ThemedText>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Full Name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            editable={!loading}
          />
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!loading}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!loading}
          />
          
          <TouchableOpacity 
            style={[styles.button, loading && styles.buttonDisabled]} 
            onPress={handleSignUp}
            disabled={loading}
          >
            <ThemedText style={styles.buttonText}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </ThemedText>
          </TouchableOpacity>

          <View style={styles.footer}>
            <ThemedText style={styles.footerText}>Already have an account? </ThemedText>
            <Link href="/" asChild>
              <TouchableOpacity>
                <ThemedText style={styles.link}>Sign In</ThemedText>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  header: {
    marginTop: 0,
    marginBottom: 50,
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
    paddingTop: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
  },
  form: {
    gap: 16,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#f8f8f8',
  },
  button: {
    height: 50,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    color: '#666666',
  },
  link: {
    color: '#007AFF',
    fontWeight: '600',
  },
});

export default SignUpScreen;
