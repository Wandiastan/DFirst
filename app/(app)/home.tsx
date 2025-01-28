import { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, View, Modal, TextInput, Linking, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { logout, getCurrentUser } from '../firebase.config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';

import { ThemedText } from '@/components/ThemedText';

interface DerivAccount {
  account_id: string;
  balance: number;
  currency: string;
  mt5_account?: {
    login: string;
    balance: number;
    currency: string;
  };
}

const DERIV_API_KEY = '@deriv_api_key';
const DERIV_WS_URL = 'wss://ws.binaryws.com/websockets/v3?app_id=67709';
const APP_ID = '67709';
const CREATE_API_KEY_URL = 'https://app.deriv.com/account/api-token';
const CREATE_MT5_URL = 'https://app.deriv.com/mt5';
const P2P_URL = 'https://p2p.deriv.com/advertiser/426826?advert_id=3182910';
const BOTS_URL = 'https://app.deriv.com/bot';

function HomeScreen() {
  const [showGuide, setShowGuide] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [account, setAccount] = useState<DerivAccount | null>(null);

  useFocusEffect(
    useCallback(() => {
      checkExistingApiKey();
    }, [])
  );

  const checkExistingApiKey = async () => {
    try {
      const savedKey = await AsyncStorage.getItem(DERIV_API_KEY);
      if (savedKey) {
        setApiKey(savedKey);
        const connected = await connectWithKey(savedKey);
        if (!connected) {
          setShowGuide(true);
          setAccount(null);
        }
      } else {
        setShowGuide(true);
        setAccount(null);
      }
    } catch (error) {
      console.error('Error checking API key:', error);
      setShowGuide(true);
      setAccount(null);
    }
  };

  const connectWithKey = async (key: string) => {
    setLoading(true);
    try {
      const formattedKey = key.trim();
      let ws: WebSocket | null = null;
      let authorized = false;
      let connectionTimeout: NodeJS.Timeout;
      let pingInterval: NodeJS.Timeout;

      const cleanup = () => {
        if (pingInterval) clearInterval(pingInterval);
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
          console.log('[Deriv] WebSocket connection established');
          
          const authRequest = {
            authorize: formattedKey,
            req_id: Date.now()
          };
          
          ws.send(JSON.stringify(authRequest));
          console.log('[Deriv] Sent authorization request');

          connectionTimeout = setTimeout(() => {
            if (!authorized) {
              console.log('[Deriv] Connection timeout - no authorization response');
              cleanup();
              resolve(false);
            }
          }, 10000);
        };

        ws.onmessage = (msg) => {
          try {
            const response = JSON.parse(msg.data);
            console.log(`[Deriv] Received message type: ${response.msg_type}`);

            if (response.error) {
              console.error('[Deriv] API Error:', {
                code: response.error.code,
                message: response.error.message
              });
              
              if (response.error.code === 'InvalidToken' || 
                  response.error.code === 'AuthorizationRequired') {
                AsyncStorage.removeItem(DERIV_API_KEY);
                setAccount(null);
                setShowGuide(true);
                cleanup();
                resolve(false);
              }
              return;
            }

            if (response.msg_type === 'authorize') {
              authorized = true;
              clearTimeout(connectionTimeout);
              console.log('[Deriv] Authorization successful');

              if (response.authorize) {
                setAccount({
                  account_id: response.authorize.loginid,
                  balance: Number(response.authorize.balance),
                  currency: response.authorize.currency
                });

                ws.send(JSON.stringify({
                  mt5_login_list: 1,
                  req_id: Date.now()
                }));

                pingInterval = setInterval(() => {
                  if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ ping: 1 }));
                  }
                }, 30000);

                setShowGuide(false);
                resolve(true);
              }
            }

            if (response.msg_type === 'mt5_login_list') {
              if (response.mt5_login_list?.length > 0) {
                const mt5Account = response.mt5_login_list[0];
                ws.send(JSON.stringify({
                  mt5_get_settings: 1,
                  login: mt5Account.login,
                  req_id: Date.now()
                }));
              }
            }

            if (response.msg_type === 'mt5_get_settings') {
              if (response.mt5_get_settings) {
                const mt5Settings = response.mt5_get_settings;
                setAccount(prev => {
                  if (!prev) return null;
                  return {
                    ...prev,
                    mt5_account: {
                      login: mt5Settings.login,
                      balance: Number(mt5Settings.balance),
                      currency: mt5Settings.currency
                    }
                  };
                });
              }
            }
          } catch (error) {
            console.error('[Deriv] Error processing message:', error);
            resolve(false);
          }
        };

        ws.onerror = (error) => {
          console.error('[Deriv] WebSocket error:', {
            timestamp: new Date().toISOString()
          });
          resolve(false);
        };

        ws.onclose = (event) => {
          console.log('[Deriv] WebSocket connection closed:', {
            code: event.code,
            reason: event.reason || 'Connection closed',
            wasClean: event.wasClean,
            timestamp: new Date().toISOString()
          });
          cleanup();
          setLoading(false);
          resolve(false);
        };
      });
    } catch (error) {
      console.error('[Deriv] Connection error:', error);
      setLoading(false);
      return false;
    }
  };

  const handleApiKeySubmit = async () => {
    if (!apiKey.trim()) {
      Alert.alert('Error', 'Please enter your API key');
      return;
    }

    setLoading(true);
    try {
      const connected = await connectWithKey(apiKey.trim());
      if (connected) {
        await AsyncStorage.setItem(DERIV_API_KEY, apiKey.trim());
        setShowGuide(false);
      } else {
        Alert.alert('Error', 'Failed to connect with API key');
        await AsyncStorage.removeItem(DERIV_API_KEY);
      }
    } catch (error) {
      console.error('Error saving API key:', error);
      Alert.alert('Error', 'Failed to connect with API key');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await AsyncStorage.removeItem(DERIV_API_KEY);
      setAccount(null);
      setShowGuide(true);
      Alert.alert('Success', 'Disconnected from Deriv');
    } catch (error) {
      console.error('Error disconnecting:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      await AsyncStorage.removeItem(DERIV_API_KEY);
      router.replace('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <View>
          <ThemedText style={styles.welcomeText}>Welcome back,</ThemedText>
          <ThemedText style={styles.nameText}>{getCurrentUser()?.displayName}</ThemedText>
        </View>
        <TouchableOpacity 
          style={styles.settingsButton}
          onPress={() => router.push('/(app)/settings')}
        >
          <Ionicons name="settings-outline" size={24} color="#1E293B" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.container}>
        <View style={styles.accountContainer}>
          {account ? (
            <View style={styles.accountCard}>
              <View style={styles.accountHeader}>
                <ThemedText style={styles.accountTitle}>Deriv Trading Account</ThemedText>
                <TouchableOpacity onPress={handleDisconnect}>
                  <ThemedText style={styles.disconnectText}>Disconnect</ThemedText>
                </TouchableOpacity>
              </View>
              <View style={styles.accountInfo}>
                <View style={styles.accountRow}>
                  <ThemedText style={styles.accountLabel}>Account ID</ThemedText>
                  <ThemedText style={styles.accountValue}>{account.account_id}</ThemedText>
                </View>
                <View style={styles.balanceRow}>
                  <ThemedText style={styles.balanceLabel}>Available Balance</ThemedText>
                  <ThemedText style={styles.balanceValue}>
                    {account.balance.toFixed(2)} <ThemedText style={styles.currencyText}>{account.currency}</ThemedText>
                  </ThemedText>
                </View>
                
                {/* MT5 Account Section */}
                <View style={styles.mt5Header}>
                  <ThemedText style={styles.mt5Title}>MT5 Account</ThemedText>
                  {!account.mt5_account && (
                    <TouchableOpacity 
                      onPress={() => Linking.openURL(CREATE_MT5_URL)}
                      style={styles.createMt5Button}
                    >
                      <ThemedText style={styles.createMt5Text}>Create MT5 Account</ThemedText>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.accountRow}>
                  <ThemedText style={styles.accountLabel}>MT5 Login</ThemedText>
                  <ThemedText style={[styles.accountValue, !account.mt5_account && styles.naText]}>
                    {account.mt5_account?.login || 'N/A'}
                  </ThemedText>
                </View>
                <View style={styles.balanceRow}>
                  <ThemedText style={styles.balanceLabel}>MT5 Balance</ThemedText>
                  <ThemedText style={[styles.balanceValue, !account.mt5_account && styles.naText]}>
                    {account.mt5_account ? (
                      `${account.mt5_account.balance.toFixed(2)} ${account.mt5_account.currency}`
                    ) : (
                      'N/A'
                    )}
                  </ThemedText>
                </View>

                {/* Transaction Buttons */}
                <View style={styles.transactionButtons}>
                  <TouchableOpacity 
                    style={[styles.transactionButton, styles.depositButton]}
                    onPress={() => Linking.openURL(P2P_URL)}
                  >
                    <ThemedText style={styles.transactionButtonText}>Deposit</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.transactionButton, styles.withdrawButton]}
                    onPress={() => Linking.openURL(P2P_URL)}
                  >
                    <ThemedText style={styles.transactionButtonText}>Withdraw</ThemedText>
                  </TouchableOpacity>
                </View>

                {/* Bots Button */}
                <TouchableOpacity 
                  style={[styles.botsButton]}
                  onPress={() => router.push('/(app)/bots/trading')}
                >
                  <ThemedText style={styles.botsButtonText}>Trading Bots</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </View>

        <Modal
          visible={showGuide}
          animationType="slide"
          transparent={true}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <ThemedText style={styles.modalTitle}>Connect Deriv Account</ThemedText>
              
              <View style={styles.guideContainer}>
                <ThemedText style={styles.guideTitle}>Required API Token Permissions:</ThemedText>
                <View style={styles.permissionsList}>
                  <View style={styles.permissionItem}>
                    <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                    <ThemedText style={styles.permissionText}>Read - View account balance & history</ThemedText>
                  </View>
                  <View style={styles.permissionItem}>
                    <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                    <ThemedText style={styles.permissionText}>Trade - Place trades & orders</ThemedText>
                  </View>
                  <View style={styles.permissionItem}>
                    <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                    <ThemedText style={styles.permissionText}>Payments - View account limits</ThemedText>
                  </View>
                  <View style={styles.permissionItem}>
                    <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                    <ThemedText style={styles.permissionText}>Admin - Manage account settings</ThemedText>
                  </View>
                </View>
                
                <TouchableOpacity 
                  style={styles.createKeyButton}
                  onPress={() => Linking.openURL(CREATE_API_KEY_URL)}
                >
                  <ThemedText style={styles.createKeyText}>Create API Key with All Permissions</ThemedText>
                </TouchableOpacity>
              </View>

              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Paste your API key here"
                  value={apiKey}
                  onChangeText={setApiKey}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
                <TouchableOpacity 
                  style={[styles.connectButton, loading && styles.buttonDisabled]}
                  onPress={handleApiKeySubmit}
                  disabled={loading}
                >
                  <ThemedText style={styles.connectButtonText}>
                    {loading ? 'Connecting...' : 'Connect'}
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    zIndex: 1,
  },
  welcomeText: {
    fontSize: 14,
    color: '#64748B',
  },
  nameText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E293B',
  },
  settingsButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  accountContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  logoutButton: {
    height: 50,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 20,
    textAlign: 'center',
  },
  guideContainer: {
    marginBottom: 24,
  },
  guideTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  guideSteps: {
    gap: 8,
    marginBottom: 16,
  },
  guideText: {
    fontSize: 16,
    color: '#666666',
  },
  createKeyButton: {
    backgroundColor: '#FF444F',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  createKeyText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  inputContainer: {
    gap: 12,
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
  connectButton: {
    height: 50,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  accountCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  accountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  accountTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  disconnectText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
  },
  accountInfo: {
    gap: 16,
  },
  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accountLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  accountValue: {
    fontSize: 16,
    color: '#1E293B',
    fontWeight: '600',
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 12,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  balanceValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#10B981',
  },
  currencyText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  mt5Header: {
    marginTop: 20,
    marginBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mt5Title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
  },
  createMt5Button: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  createMt5Text: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  naText: {
    color: '#94A3B8',
    fontSize: 16,
  },
  transactionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  transactionButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  depositButton: {
    backgroundColor: '#10B981',
  },
  withdrawButton: {
    backgroundColor: '#6366F1',
  },
  transactionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  botsButton: {
    height: 44,
    backgroundColor: '#8B5CF6',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  botsButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  permissionsList: {
    marginBottom: 16,
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  permissionText: {
    fontSize: 14,
    color: '#334155',
    flex: 1,
  },
});

export default HomeScreen; 