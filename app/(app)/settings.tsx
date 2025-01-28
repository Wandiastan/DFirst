import { useState, useEffect } from 'react';
import { StyleSheet, View, TextInput, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemedText } from '@/components/ThemedText';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const DERIV_API_KEY = '@deriv_api_key';
const DERIV_WS_URL = 'wss://ws.binaryws.com/websockets/v3?app_id=1089';

export default function SettingsScreen() {
  const [apiKey, setApiKey] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadApiKey();
  }, []);

  const loadApiKey = async () => {
    try {
      const savedKey = await AsyncStorage.getItem(DERIV_API_KEY);
      if (savedKey) {
        setApiKey(savedKey);
        setIsConnected(true);
      }
    } catch (error) {
      console.error('Error loading API key:', error);
    }
  };

  const connectWithKey = async (key: string) => {
    setLoading(true);
    try {
      const formattedKey = key.trim();
      let ws: WebSocket | null = null;
      let authorized = false;
      let connectionTimeout: NodeJS.Timeout;

      const cleanup = () => {
        if (connectionTimeout) clearTimeout(connectionTimeout);
        if (ws) {
          ws.onclose = null;
          ws.onerror = null;
          ws.close();
        }
      };

      return new Promise<boolean>((resolve) => {
        ws = new WebSocket(DERIV_WS_URL);

        ws.onopen = () => {
          console.log('[Settings] WebSocket connection established');
          
          const authRequest = {
            authorize: formattedKey,
            req_id: Date.now()
          };
          
          ws.send(JSON.stringify(authRequest));
          console.log('[Settings] Sent authorization request');

          connectionTimeout = setTimeout(() => {
            if (!authorized) {
              console.log('[Settings] Connection timeout - no authorization response');
              cleanup();
              resolve(false);
            }
          }, 10000);
        };

        ws.onmessage = (msg) => {
          try {
            const response = JSON.parse(msg.data);
            console.log(`[Settings] Received message type: ${response.msg_type}`);

            if (response.error) {
              console.error('[Settings] API Error:', response.error);
              cleanup();
              resolve(false);
              return;
            }

            if (response.msg_type === 'authorize') {
              authorized = true;
              clearTimeout(connectionTimeout);
              console.log('[Settings] Authorization successful');
              cleanup();
              resolve(true);
            }
          } catch (error) {
            console.error('[Settings] Error processing message:', error);
            resolve(false);
          }
        };

        ws.onerror = (error) => {
          console.error('[Settings] WebSocket error:', error);
          resolve(false);
        };

        ws.onclose = () => {
          cleanup();
          resolve(false);
        };
      });
    } catch (error) {
      console.error('[Settings] Connection error:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const saveApiKey = async () => {
    if (!apiKey.trim()) {
      Alert.alert('Error', 'Please enter your API key');
      return;
    }

    try {
      const connected = await connectWithKey(apiKey.trim());
      if (connected) {
        await AsyncStorage.setItem(DERIV_API_KEY, apiKey.trim());
        setIsConnected(true);
        Alert.alert('Success', 'API key connected successfully', [
          { 
            text: 'OK',
            onPress: () => router.replace('/(app)/home')
          }
        ]);
      } else {
        Alert.alert('Error', 'Failed to connect with API key');
      }
    } catch (error) {
      console.error('Error saving API key:', error);
      Alert.alert('Error', 'Failed to save API key');
    }
  };

  const disconnectAccount = async () => {
    try {
      await AsyncStorage.removeItem(DERIV_API_KEY);
      setApiKey('');
      setIsConnected(false);
      Alert.alert('Success', 'Account disconnected successfully', [
        { 
          text: 'OK',
          onPress: () => router.replace('/(app)/home')
        }
      ]);
    } catch (error) {
      console.error('Error disconnecting account:', error);
      Alert.alert('Error', 'Failed to disconnect account');
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <ThemedText style={styles.title}>Settings</ThemedText>
      </View>

      <View style={styles.content}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>API Key</ThemedText>
            {isConnected && (
              <View style={styles.connectedBadge}>
                <ThemedText style={styles.connectedText}>Connected</ThemedText>
              </View>
            )}
          </View>
          
          <TextInput
            style={styles.input}
            value={apiKey}
            onChangeText={setApiKey}
            placeholder="Enter your Deriv API key"
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.button, styles.saveButton, loading && styles.buttonDisabled]}
              onPress={saveApiKey}
              disabled={loading}
            >
              <ThemedText style={styles.buttonText}>
                {loading ? 'Connecting...' : (isConnected ? 'Update Connection' : 'Connect')}
              </ThemedText>
            </TouchableOpacity>
            
            {isConnected && (
              <TouchableOpacity 
                style={[styles.button, styles.disconnectButton]}
                onPress={disconnectAccount}
                disabled={loading}
              >
                <ThemedText style={[styles.buttonText, styles.disconnectText]}>Disconnect Account</ThemedText>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E293B',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  connectedBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  connectedText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '500',
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: '#F8FAFC',
    marginBottom: 12,
  },
  buttonContainer: {
    gap: 12,
  },
  button: {
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#10B981',
  },
  disconnectButton: {
    backgroundColor: '#FEE2E2',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  disconnectText: {
    color: '#EF4444',
  },
  buttonDisabled: {
    backgroundColor: '#E5E7EB',
  },
}); 