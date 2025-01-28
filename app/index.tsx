import { useState, useEffect } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View, Alert } from 'react-native';
import { Link, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, withSpring, Easing } from 'react-native-reanimated';
import { loginWithEmail } from './firebase.config';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ThemedText } from '@/components/ThemedText';

const SAVED_EMAIL_KEY = '@saved_email';

function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasEmail, setHasEmail] = useState(false);
  const rotation = useSharedValue(0);
  const emailPosition = useSharedValue(0);
  const emailScale = useSharedValue(1);

  useEffect(() => {
    loadSavedEmail();
    rotation.value = withRepeat(
      withSequence(
        withTiming(-10, { duration: 200, easing: Easing.ease }),
        withTiming(10, { duration: 200, easing: Easing.ease }),
        withTiming(0, { duration: 200, easing: Easing.ease })
      ),
      2
    );
  }, []);

  const loadSavedEmail = async () => {
    try {
      const savedEmail = await AsyncStorage.getItem(SAVED_EMAIL_KEY);
      if (savedEmail) {
        setEmail(savedEmail);
        setHasEmail(true);
        // Animate email input
        emailPosition.value = withSpring(-25);
        emailScale.value = withSpring(0.85);
      }
    } catch (error) {
      console.error('Error loading saved email:', error);
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const animatedEmailStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: emailPosition.value },
      { scale: emailScale.value }
    ],
  }));

  const handleLogin = async () => {
    if (loading) return;
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await loginWithEmail(email, password);
      await AsyncStorage.setItem(SAVED_EMAIL_KEY, email);
      console.log('User logged in:', userCredential.user.uid);
      router.replace('/(app)/home');
    } catch (error: any) {
      console.error('Login error:', error);
      Alert.alert(
        'Login Error',
        error.message || 'An error occurred during login'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (!hasEmail && text.length > 0) {
      emailPosition.value = withSpring(-25);
      emailScale.value = withSpring(0.85);
    } else if (!hasEmail && text.length === 0) {
      emailPosition.value = withSpring(0);
      emailScale.value = withSpring(1);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <ThemedText style={styles.title}>Welcome Back</ThemedText>
            <Animated.Text style={[styles.waveEmoji, animatedStyle]}>👋</Animated.Text>
          </View>
          <ThemedText style={styles.subtitle}>Sign in to continue</ThemedText>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Animated.Text style={[styles.floatingLabel, animatedEmailStyle]}>
              Email
            </Animated.Text>
            <TextInput
              style={styles.input}
              placeholder={hasEmail ? '' : 'Email'}
              value={email}
              onChangeText={handleEmailChange}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!loading}
            />
          </View>
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
            onPress={handleLogin}
            disabled={loading}
          >
            <ThemedText style={styles.buttonText}>
              {loading ? 'Signing in...' : 'Sign In'}
            </ThemedText>
          </TouchableOpacity>

          <View style={styles.footer}>
            <ThemedText style={styles.footerText}>Don't have an account? </ThemedText>
            <Link href="/explore" asChild>
              <TouchableOpacity>
                <ThemedText style={styles.link}>Sign Up</ThemedText>
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
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
    paddingTop: 8,
  },
  waveEmoji: {
    fontSize: 32,
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
  inputContainer: {
    position: 'relative',
    height: 50,
  },
  floatingLabel: {
    position: 'absolute',
    left: 16,
    top: 12,
    fontSize: 16,
    color: '#666666',
    backgroundColor: '#f8f8f8',
    paddingHorizontal: 4,
    zIndex: 1,
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

export default LoginScreen;
