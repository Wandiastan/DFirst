import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, TouchableOpacity, View, Modal, TextInput, Linking, Alert } from 'react-native';
import { router, useSegments } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { logout, getCurrentUser } from '../firebase.config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

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

interface DerivOAuthTokens {
  accounts: Array<{
    account: string;
    token: string;
    currency: string;
  }>;
  selectedAccount?: {
    account: string;
    token: string;
    currency: string;
  };
}

const DERIV_API_KEY = '@deriv_api_key';
const DERIV_OAUTH_TOKENS = '@deriv_oauth_tokens';
const DERIV_WS_URL = 'wss://ws.binaryws.com/websockets/v3?app_id=67709';
const APP_ID = '67709';
const CREATE_API_KEY_URL = 'https://app.deriv.com/account/api-token?t=_30qaRjl291dMjdsyM5hasGNd7ZgqdRLk';
const CREATE_MT5_URL = 'https://app.deriv.com/mt5?t=_30qaRjl291dMjdsyM5hasGNd7ZgqdRLk';
const P2P_URL = 'https://p2p.deriv.com/advertiser/426826?advert_id=3182910&t=_30qaRjl291dMjdsyM5hasGNd7ZgqdRLk';
const BOTS_URL = 'https://app.deriv.com/bot?t=_30qaRjl291dMjdsyM5hasGNd7ZgqdRLk';
const OAUTH_URL = `https://oauth.deriv.com/oauth2/authorize?app_id=${APP_ID}&l=en&brand=deriv&app_markup_percentage=0&t=_30qaRjl291dMjdsyM5hasGNd7ZgqdRLk&redirect_uri=dfirsttrader://oauth2/callback`;

function HomeScreen() {
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [account, setAccount] = useState<DerivAccount | null>(null);
  const [previousApiKey, setPreviousApiKey] = useState('');
  const [oauthTokens, setOauthTokens] = useState<DerivOAuthTokens | null>(null);
  const [isOAuthConnected, setIsOAuthConnected] = useState(false);
  const [isFirstLogin, setIsFirstLogin] = useState(true);

  useFocusEffect(
    useCallback(() => {
      checkExistingConnections();
    }, [])
  );

  const checkExistingConnections = async () => {
    try {
      const savedTokens = await AsyncStorage.getItem(DERIV_OAUTH_TOKENS);
      const savedKey = await AsyncStorage.getItem(DERIV_API_KEY);
      const firstLoginFlag = await AsyncStorage.getItem('@first_login');
      
      setIsFirstLogin(!firstLoginFlag);
      
      if (savedTokens) {
        const tokens = JSON.parse(savedTokens) as DerivOAuthTokens;
        setOauthTokens(tokens);
        setIsOAuthConnected(true);
        if (tokens.selectedAccount) {
          connectWithOAuth(tokens.selectedAccount.token);
        }
      } else if (savedKey) {
        setApiKey(savedKey);
        const connected = await connectWithKey(savedKey);
        if (!connected) {
          setAccount(null);
        }
      }
    } catch (error) {
      console.error('Error checking connections:', error);
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
          console.log('[Home] Closing connection as expected - balance check complete');
          ws.onclose = null;
          ws.onerror = null;
          ws.close();
        }
      };

      return new Promise<boolean>((resolve) => {
        ws = new WebSocket(DERIV_WS_URL);

        ws.onopen = () => {
          console.log('[Home] WebSocket connection established for balance check');
          
          if (ws) {
          const authRequest = {
            authorize: formattedKey,
            req_id: Date.now()
          };
          
          ws.send(JSON.stringify(authRequest));
          }

          connectionTimeout = setTimeout(() => {
            if (!authorized) {
              console.log('[Home] Balance check timeout - closing connection');
              cleanup();
              resolve(false);
            }
          }, 10000);
        };

        ws.onmessage = (msg) => {
          try {
            const response = JSON.parse(msg.data);

            if (response.error) {
              console.log('[Home] API Error during balance check:', response.error.message);
                cleanup();
                resolve(false);
              return;
            }

            if (response.msg_type === 'authorize') {
              authorized = true;
              clearTimeout(connectionTimeout);

              if (response.authorize) {
                setAccount({
                  account_id: response.authorize.loginid,
                  balance: Number(response.authorize.balance),
                  currency: response.authorize.currency
                });

                if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  mt5_login_list: 1,
                  req_id: Date.now()
                }));
                  }
              }
            }

            if (response.msg_type === 'mt5_login_list') {
              if (response.mt5_login_list?.length > 0) {
                const mt5Account = response.mt5_login_list[0];
                if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  mt5_get_settings: 1,
                  login: mt5Account.login,
                  req_id: Date.now()
                }));
                }
              } else {
                cleanup();
                resolve(true);
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
              cleanup();
              resolve(true);
            }
          } catch (error) {
            console.log('[Home] Error processing message during balance check:', error);
            resolve(false);
          }
        };

        ws.onerror = () => {
          console.log('[Home] WebSocket error during balance check');
          resolve(false);
        };

        ws.onclose = () => {
          console.log('[Home] WebSocket connection closed after balance check');
          cleanup();
          setLoading(false);
          resolve(false);
        };
      });
    } catch (error) {
      console.log('[Home] Connection error during balance check:', error);
      setLoading(false);
      return false;
    }
  };

  const handleDisconnect = async () => {
    try {
      if (isOAuthConnected) {
        await AsyncStorage.removeItem(DERIV_OAUTH_TOKENS);
        setOauthTokens(null);
        setIsOAuthConnected(false);
      } else {
        await AsyncStorage.removeItem(DERIV_API_KEY);
      }
      setAccount(null);
      setLoading(false);
      setShowDisconnectModal(false);
    } catch (error) {
      console.error('Error disconnecting:', error);
      setLoading(false);
    }
  };

  const handleApiKeyChange = (text: string) => {
    setApiKey(text);
  };

  const handleReconnect = async () => {
    if (previousApiKey) {
      setApiKey(previousApiKey);
      handleApiKeySubmit(previousApiKey);
    }
  };

  const handleApiKeySubmit = async (keyToUse = apiKey) => {
    if (!keyToUse.trim()) {
      Alert.alert('Error', 'Please enter your API key');
      return;
    }

    setLoading(true);
    try {
      const connected = await connectWithKey(keyToUse.trim());
      if (connected) {
        await AsyncStorage.setItem(DERIV_API_KEY, keyToUse.trim());
        setPreviousApiKey('');
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

  const handleLogout = async () => {
    try {
      await logout();
      await AsyncStorage.removeItem(DERIV_API_KEY);
      router.replace('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleOAuthLogin = async () => {
    try {
      await AsyncStorage.setItem('@first_login', 'true');
      setIsFirstLogin(false);
      await Linking.openURL(OAUTH_URL);
    } catch (error) {
      console.error('Error opening OAuth URL:', error);
      Alert.alert('Error', 'Failed to open OAuth login');
    }
  };

  const parseOAuthCallback = (url: string): DerivOAuthTokens => {
    const params = new URLSearchParams(url.split('?')[1]);
    const accounts = [];
    let i = 1;
    
    while (params.has(`acct${i}`) && params.has(`token${i}`) && params.has(`cur${i}`)) {
      accounts.push({
        account: params.get(`acct${i}`)!,
        token: params.get(`token${i}`)!,
        currency: params.get(`cur${i}`)!.toUpperCase()
      });
      i++;
    }

    return {
      accounts,
      selectedAccount: accounts[0] // Default to first account
    };
  };

  const handleOAuthCallback = async (url: string) => {
    try {
      const tokens = parseOAuthCallback(url);
      await AsyncStorage.setItem(DERIV_OAUTH_TOKENS, JSON.stringify(tokens));
      setOauthTokens(tokens);
      setIsOAuthConnected(true);
      
      if (tokens.selectedAccount) {
        connectWithOAuth(tokens.selectedAccount.token);
      }
    } catch (error) {
      console.error('Error handling OAuth callback:', error);
      Alert.alert('Error', 'Failed to process OAuth login');
    }
  };

  const connectWithOAuth = async (token: string) => {
    setLoading(true);
    try {
      let ws: WebSocket | null = null;
      let authorized = false;
      let connectionTimeout: NodeJS.Timeout;

      const cleanup = () => {
        if (connectionTimeout) clearTimeout(connectionTimeout);
        if (ws) {
          console.log('[Home] Closing OAuth connection as expected - balance check complete');
          ws.onclose = null;
          ws.onerror = null;
          ws.close();
        }
      };

      return new Promise<boolean>((resolve) => {
        ws = new WebSocket(DERIV_WS_URL);

        ws.onopen = () => {
          console.log('[Home] OAuth WebSocket connection established for balance check');
          
          if (ws) {
            const authRequest = {
              authorize: token,
              req_id: Date.now()
            };
            
            ws.send(JSON.stringify(authRequest));
          }

          connectionTimeout = setTimeout(() => {
            if (!authorized) {
              console.log('[Home] OAuth balance check timeout - closing connection');
              cleanup();
              resolve(false);
            }
          }, 10000);
        };

        ws.onmessage = (msg) => {
          try {
            const response = JSON.parse(msg.data);

            if (response.error) {
              console.log('[Home] API Error during balance check:', response.error.message);
              cleanup();
              resolve(false);
              return;
            }

            if (response.msg_type === 'authorize') {
              authorized = true;
              clearTimeout(connectionTimeout);

              if (response.authorize) {
                setAccount({
                  account_id: response.authorize.loginid,
                  balance: Number(response.authorize.balance),
                  currency: response.authorize.currency
                });

                if (ws && ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({
                    mt5_login_list: 1,
                    req_id: Date.now()
                  }));
                }
              }
            }

            if (response.msg_type === 'mt5_login_list') {
              if (response.mt5_login_list?.length > 0) {
                const mt5Account = response.mt5_login_list[0];
                if (ws && ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({
                    mt5_get_settings: 1,
                    login: mt5Account.login,
                    req_id: Date.now()
                  }));
                }
              } else {
                cleanup();
                resolve(true);
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
              cleanup();
              resolve(true);
            }
          } catch (error) {
            console.log('[Home] Error processing message during balance check:', error);
            resolve(false);
          }
        };

        ws.onerror = () => {
          console.log('[Home] WebSocket error during balance check');
          resolve(false);
        };

        ws.onclose = () => {
          console.log('[Home] WebSocket connection closed after balance check');
          cleanup();
          setLoading(false);
          resolve(false);
        };
      });
    } catch (error) {
      console.log('[Home] OAuth connection error during balance check:', error);
      setLoading(false);
      return false;
    }
  };

  useEffect(() => {
    const subscription = Linking.addEventListener('url', (event) => {
      if (event.url.includes('dfirsttrader://oauth2/callback')) {
        handleOAuthCallback(event.url);
        // Ensure we're on the home screen after OAuth callback
        router.replace('/(app)/home');
      }
    });

    // Check for initial URL (app opened via OAuth callback)
    Linking.getInitialURL().then(url => {
      if (url && url.includes('dfirsttrader://oauth2/callback')) {
        handleOAuthCallback(url);
        // Ensure we're on the home screen for initial URL
        router.replace('/(app)/home');
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <View>
          <ThemedText style={styles.welcomeText}>Welcome back,</ThemedText>
          <ThemedText style={styles.nameText}>{getCurrentUser()?.displayName}</ThemedText>
        </View>
        <TouchableOpacity 
          style={styles.headerButton}
          onPress={() => router.push('/(app)/settings')}
        >
          <Ionicons name="settings-outline" size={24} color="#1E293B" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.container}>
        <View style={styles.accountContainer}>
          {!account && !isOAuthConnected ? (
            <View style={styles.welcomeCardContainer}>
              <View style={styles.welcomeCard}>
                <View style={styles.welcomeIconContainer}>
                  <Ionicons name="wallet-outline" size={48} color="#FF444F" />
                </View>
                <ThemedText style={styles.welcomeDescription}>
                  Connect to deposit, withdraw, and trade on Deriv
                </ThemedText>
                <View style={styles.oauthCard}>
                  <ThemedText style={styles.oauthTitle}>Connect with Deriv</ThemedText>
                  <ThemedText style={styles.oauthDescription}>
                    Sign in with your Deriv account to start trading
                  </ThemedText>
                  <TouchableOpacity
                    style={styles.oauthButton}
                    onPress={handleOAuthLogin}
                  >
                    <ThemedText style={styles.oauthButtonText}>Connect Account</ThemedText>
                  </TouchableOpacity>
                  
                  <View style={styles.dividerContainer}>
                    <View style={styles.divider} />
                    <ThemedText style={styles.dividerText}>Don't have an account yet?</ThemedText>
                    <View style={styles.divider} />
                  </View>

                  <TouchableOpacity
                    style={[styles.oauthButton, styles.joinButton]}
                    onPress={() => Linking.openURL('https://track.deriv.com/_30qaRjl291dMjdsyM5hasGNd7ZgqdRLk/1/')}
                  >
                    <ThemedText style={styles.oauthButtonText}>Create Deriv Account</ThemedText>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity 
                  onPress={() => router.push('/(app)/settings')}
                  style={styles.apiKeyLink}
                >
                  <ThemedText style={styles.apiKeyLinkText}>Use API Key Instead</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          ) : account ? (
            <View style={styles.accountCard}>
              <View style={styles.accountHeader}>
                <ThemedText style={styles.accountTitle}>Deriv Trading Account</ThemedText>
                <TouchableOpacity onPress={() => setShowDisconnectModal(true)}>
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
          visible={showDisconnectModal}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setShowDisconnectModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>Disconnect Account</ThemedText>
                <TouchableOpacity 
                  onPress={() => setShowDisconnectModal(false)}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color="#64748B" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                <View style={styles.warningIcon}>
                  <Ionicons name="warning" size={48} color="#F59E0B" />
                  </View>
                <ThemedText style={styles.disconnectWarning}>
                  Are you sure you want to disconnect your Deriv account? You'll need to reconnect to access your trading features.
                </ThemedText>
                </View>
                
              <View style={styles.modalFooter}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setShowDisconnectModal(false)}
                >
                  <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.disconnectModalButton]}
                  onPress={handleDisconnect}
                >
                  <ThemedText style={styles.disconnectModalButtonText}>Disconnect</ThemedText>
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
  headerButton: {
    padding: 8,
    borderRadius: 8,
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
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E293B',
  },
  closeButton: {
    padding: 8,
  },
  modalBody: {
    padding: 24,
    alignItems: 'center',
  },
  warningIcon: {
    marginBottom: 16,
  },
  disconnectWarning: {
    fontSize: 16,
    color: '#334155',
    textAlign: 'center',
    lineHeight: 24,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  modalButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F1F5F9',
  },
  cancelButtonText: {
    color: '#64748B',
    fontSize: 16,
    fontWeight: '600',
  },
  disconnectModalButton: {
    backgroundColor: '#EF4444',
  },
  disconnectModalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  welcomeCardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  welcomeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  welcomeIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 68, 79, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  welcomeDescription: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    maxWidth: 300,
  },
  oauthCard: {
    width: '100%',
    padding: 24,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  oauthTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 16,
  },
  oauthDescription: {
    fontSize: 16,
    color: '#64748B',
    marginBottom: 24,
  },
  oauthButton: {
    width: '100%',
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FF444F',
  },
  oauthButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    width: '100%',
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    color: '#64748B',
    paddingHorizontal: 16,
    fontSize: 14,
  },
  joinButton: {
    backgroundColor: '#0891B2',
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
  apiKeyLink: {
    marginTop: 24,
    padding: 8,
  },
  apiKeyLinkText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});

export default HomeScreen; 