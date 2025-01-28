import { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, TextInput, Alert, Modal, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DIFFERbot from './DIFFERbot';
import evenbot from './evenbot';
import touchbot from './touchbot';
import overbot from './overbot';
import notouchbot from './notouchbot';
import oddbot from './oddbot';
import higherlowerbot from './higherlowerbot';
import evenoddbot from './evenoddbot';
import overunderbot from './overunderbot';
import risefallbot from './risefallbot';
import underbot from './underbot';

interface BotConfig {
  initialStake: string;
  takeProfit: string;
  stopLoss: string;
  martingaleMultiplier: string;
}

interface TradeHistory {
  time: Date;
  stake: number;
  result: 'win' | 'loss';
  profit: number;
  type?: string;
}

interface BotStats {
  currentStake: number;
  totalProfit: number;
  totalTrades: number;
  winRate: string;
  consecutiveLosses: number;
  runningTime: string;
  progressToTarget: string;
  tradeHistory?: TradeHistory[];
}

interface AccountInfo {
  account_id: string;
  balance: number;
  currency: string;
}

const botMap = {
  DIFFERbot,
  evenbot,
  touchbot,
  overbot,
  notouchbot,
  oddbot,
  higherlowerbot,
  evenoddbot,
  overunderbot,
  risefallbot,
  underbot
};

const DERIV_API_KEY = '@deriv_api_key';
const DERIV_WS_URL = 'wss://ws.binaryws.com/websockets/v3?app_id=1089';
const BOT_RUNNING_KEY = '@bot_running_state';
const DISCLAIMER_SHOWN_KEY = '@disclaimer_shown';

function BotScreen() {
  const { bot } = useLocalSearchParams();
  const [isRunning, setIsRunning] = useState(false);
  const [config, setConfig] = useState<BotConfig>({
    initialStake: '1',
    takeProfit: '100',
    stopLoss: '50',
    martingaleMultiplier: '2'
  });
  const [stats, setStats] = useState<BotStats>({
    currentStake: 0,
    totalProfit: 0,
    totalTrades: 0,
    winRate: '0',
    consecutiveLosses: 0,
    runningTime: '00:00:00',
    progressToTarget: '0'
  });
  const [tradeHistory, setTradeHistory] = useState<TradeHistory[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [targetMessage, setTargetMessage] = useState({ type: '', message: '' });
  const [statusBadge, setStatusBadge] = useState<'running' | 'analyzing' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [skipDisclaimer, setSkipDisclaimer] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [lastClickTime, setLastClickTime] = useState(0);
  const [cooldownTime, setCooldownTime] = useState(0);
  const [cooldownInterval, setCooldownInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadSavedConfig();
    loadRunningState();
  }, [bot]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    if (isRunning) {
      setStatusBadge('running');
      intervalId = setInterval(() => {
        setStatusBadge(prev => prev === 'running' ? 'analyzing' : 'running');
      }, 1500); // Alternate every 1.5 seconds
    } else {
      setStatusBadge(null);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isRunning]);

  useEffect(() => {
    let timerInterval: NodeJS.Timeout;
    
    if (isRunning && startTime) {
      timerInterval = setInterval(() => {
        const now = new Date();
        const diff = Math.floor((now.getTime() - startTime.getTime()) / 1000);
        const hours = Math.floor(diff / 3600).toString().padStart(2, '0');
        const minutes = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
        const seconds = (diff % 60).toString().padStart(2, '0');
        setStats(prev => ({
          ...prev,
          runningTime: `${hours}:${minutes}:${seconds}`
        }));
      }, 1000);
    }

    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, [isRunning, startTime]);

  useEffect(() => {
    return () => {
      if (cooldownInterval) {
        clearInterval(cooldownInterval);
      }
    };
  }, [cooldownInterval]);

  const loadSavedConfig = async () => {
    try {
      const savedConfig = await AsyncStorage.getItem(`@bot_config_${bot}`);
      if (savedConfig) {
        setConfig(JSON.parse(savedConfig));
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
  };

  const saveConfig = async () => {
    try {
      await AsyncStorage.setItem(`@bot_config_${bot}`, JSON.stringify(config));
    } catch (error) {
      console.error('Error saving config:', error);
    }
  };

  const loadRunningState = async () => {
    try {
      const savedState = await AsyncStorage.getItem(BOT_RUNNING_KEY);
      if (savedState) {
        const { isRunning: wasRunning, botType } = JSON.parse(savedState);
        if (wasRunning && botType === bot) {
          setIsRunning(true);
          // Reconnect WebSocket if bot was running
          handleStartBot();
        }
      }
    } catch (error) {
      console.error('Error loading running state:', error);
    }
  };

  const saveRunningState = async (running: boolean) => {
    try {
      if (running) {
        await AsyncStorage.setItem(BOT_RUNNING_KEY, JSON.stringify({ isRunning: true, botType: bot }));
      } else {
        await AsyncStorage.removeItem(BOT_RUNNING_KEY);
      }
    } catch (error) {
      console.error('Error saving running state:', error);
    }
  };

  const checkDisclaimerPreference = async () => {
    try {
      const disclaimerShown = await AsyncStorage.getItem(DISCLAIMER_SHOWN_KEY);
      return disclaimerShown === 'true';
    } catch (error) {
      console.error('Error checking disclaimer preference:', error);
      return false;
    }
  };

  const startCooldown = () => {
    setCooldownTime(10);
    const interval = setInterval(() => {
      setCooldownTime(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    setCooldownInterval(interval);
  };

  const handleStartBot = async () => {
    if (isLoading) return;

    // If bot is running, stop it immediately without cooldown
    if (isRunning) {
      setIsLoading(true);
      try {
        setStartTime(null);
        console.log('Stopping bot...');
        
        // First set states to prevent any new operations
        setIsRunning(false);
        await saveRunningState(false);
        
        // Then handle WebSocket cleanup
        if (ws) {
          try {
            // First stop the bot instance to prevent any new trades
            if (ws.botInstance) {
              ws.botInstance.stop();
            }
            
            // Only then handle WebSocket cleanup
            if (ws.readyState === WebSocket.OPEN) {
              // Remove all handlers first
              ws.onclose = null;
              ws.onerror = null;
              ws.onmessage = null;
              
              // Then send forget_all and close
              await new Promise<void>((resolve) => {
                ws.send(JSON.stringify({ forget_all: ['ticks', 'proposal', 'proposal_open_contract'] }));
                setTimeout(resolve, 100); // Give a small delay for the message to be sent
              });
            }
            ws.close();
          } catch (error) {
            console.log('Cleanup error:', error);
          }
          setWs(null);
        }
        console.log('Bot stopped');
        startCooldown();
      } catch (error) {
        console.error('Error handling bot:', error);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Check cooldown before starting
    if (cooldownTime > 0) return;

    // Starting bot logic
    const shouldSkipDisclaimer = await checkDisclaimerPreference();
    if (shouldSkipDisclaimer) {
      startBotAfterDisclaimer();
    } else {
      setShowDisclaimer(true);
    }
  };

  const startBotAfterDisclaimer = async () => {
    setShowDisclaimer(false);
    if (skipDisclaimer) {
      try {
        await AsyncStorage.setItem(DISCLAIMER_SHOWN_KEY, 'true');
      } catch (error) {
        console.error('Error saving disclaimer preference:', error);
      }
    }
    setIsLoading(true);
    
    try {
      setStartTime(new Date());
      setIsRunning(true);
      
      // Save running state immediately
      await saveRunningState(true);
      
      const savedKey = await AsyncStorage.getItem(DERIV_API_KEY);
      if (!savedKey) {
        setIsRunning(false);
        await saveRunningState(false);
        Alert.alert('Error', 'Please connect your Deriv account first');
        router.push('/(app)/home');
        return;
      }

      const wsInstance = new WebSocket(DERIV_WS_URL);
      setWs(wsInstance);

      wsInstance.onopen = () => {
        console.log('WebSocket connected, authorizing...');
        wsInstance.send(JSON.stringify({ 
          authorize: savedKey,
          req_id: Date.now()
        }));
      };

      wsInstance.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          console.log('Received message type:', data.msg_type);
          
          if (data.error) {
            console.error('WebSocket error:', data.error);
            Alert.alert('Error', 'Failed to connect to trading server');
            wsInstance.close();
            setWs(null);
            return;
          }

          // Handle ping messages
          if (data.msg_type === 'ping') {
            wsInstance.send(JSON.stringify({ pong: 1 }));
            return;
          }

          if (data.msg_type === 'authorize' && data.authorize) {
            console.log('Authorization successful, getting balance...');
            wsInstance.send(JSON.stringify({ 
              balance: 1,
              subscribe: 1
            }));
          }
          
          if (data.msg_type === 'balance') {
            console.log('Balance received:', data.balance);
            const accountInfo = {
              account_id: data.balance?.loginid || 'Unknown',
              balance: parseFloat(data.balance?.balance || '0'),
              currency: data.balance?.currency || 'USD'
            };
            setAccountInfo(accountInfo);

            if (accountInfo.balance < parseFloat(config.initialStake)) {
              Alert.alert(
                'Insufficient Balance',
                `Your account (${accountInfo.account_id}) balance of $${accountInfo.balance.toFixed(2)} is lower than the initial stake of $${config.initialStake}.`,
                [
                  {
                    text: 'Deposit',
                    onPress: () => {
                      Alert.alert(
                        'Deposit',
                        'Please deposit funds to your account using the Deriv platform.',
                        [{ text: 'OK' }]
                      );
                    },
                  },
                  {
                    text: 'Cancel',
                    style: 'cancel',
                  },
                ]
              );
              wsInstance.close();
              setWs(null);
              return;
            }

            // Start bot if balance is sufficient
            const BotClass = botMap[bot as keyof typeof botMap];
            if (!BotClass) {
              Alert.alert('Error', 'Bot not found');
              wsInstance.close();
              setWs(null);
              return;
            }

            console.log('Starting bot:', bot);
            const botInstance = new BotClass(wsInstance, {
              initialStake: parseFloat(config.initialStake),
              takeProfit: parseFloat(config.takeProfit),
              stopLoss: parseFloat(config.stopLoss),
              martingaleMultiplier: parseFloat(config.martingaleMultiplier)
            });

            // Store bot instance in WebSocket for cleanup
            wsInstance.botInstance = botInstance;

            botInstance.setUpdateCallback((stats: BotStats) => {
              console.log('Bot stats update:', stats);
              const targetAmount = parseFloat(config.takeProfit);
              const stopLossAmount = parseFloat(config.stopLoss);
              const totalRange = targetAmount + stopLossAmount;
              const currentPosition = stats.totalProfit + stopLossAmount;
              const progressPercentage = (currentPosition / totalRange * 100).toFixed(2);
              
              setStats({
                ...stats,
                progressToTarget: progressPercentage
              });
              
              if (stats.tradeHistory) {
                setTradeHistory(stats.tradeHistory);
              }

              // Check for target reached
              if (stats.totalProfit >= parseFloat(config.takeProfit) || stats.totalProfit <= -parseFloat(config.stopLoss)) {
                setStartTime(null);
                // First, stop the bot and reset states
                setIsRunning(false);
                saveRunningState(false);
                if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
                  wsInstance.send(JSON.stringify({ forget_all: ['ticks', 'proposal', 'proposal_open_contract'] }));
                  wsInstance.close();
                }
                setWs(null);
                
                // Then show the popup
                showTargetReachedPopup(
                  stats.totalProfit >= parseFloat(config.takeProfit) ? 'profit' : 'loss',
                  Math.abs(stats.totalProfit)
                );
              }
            });

            // Start the bot before setting up message handler
            botInstance.start();
            console.log('Bot started successfully');

            // Set up message handler after bot is started
            wsInstance.onmessage = (msg) => {
              try {
                const data = JSON.parse(msg.data);
                
                // Handle ping messages
                if (data.msg_type === 'ping') {
                  wsInstance.send(JSON.stringify({ pong: 1 }));
                  return;
                }
                
                // Handle balance updates
                if (data.msg_type === 'balance' && data.balance) {
                  const updatedAccountInfo = {
                    account_id: data.balance.loginid || accountInfo?.account_id || 'Unknown',
                    balance: parseFloat(data.balance.balance || '0'),
                    currency: data.balance.currency || 'USD'
                  };
                  setAccountInfo(updatedAccountInfo);
                }

                // Forward messages to bot while running
                if (wsInstance.botInstance && wsInstance.botInstance.isRunning) {
                  wsInstance.botInstance.handleMessage(msg.data);
                }
              } catch (error) {
                console.error('Error processing message:', error);
              }
            };
          }
        } catch (error) {
          console.error('Error processing message:', error);
        }
      };

      wsInstance.onerror = async (error) => {
        console.error('WebSocket error:', error);
        if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
          wsInstance.close();
        }
        setWs(null);
        setIsRunning(false);
        setIsLoading(false);
        await saveRunningState(false);
        Alert.alert('Connection Error', 'Failed to connect to trading server. Please try again.');
      };

      wsInstance.onclose = async () => {
        console.log('WebSocket connection closed');
        if (wsInstance && wsInstance.botInstance) {
          wsInstance.botInstance.stop();
        }
        setWs(null);
        setIsRunning(false);
        setIsLoading(false);
        await saveRunningState(false);
      };

    } catch (error) {
      console.error('Error handling bot:', error);
      setIsRunning(false);
      await saveRunningState(false);
      if (ws) {
        ws.close();
        setWs(null);
      }
      Alert.alert('Error', 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const showTargetReachedPopup = async (type: 'profit' | 'loss', amount: number) => {
    const message = type === 'profit' 
      ? `🎉 TARGET REACHED!\n\nCongratulations!\nYou've hit your take profit target.\n\nTotal Profit: $${amount.toFixed(2)}`
      : `⚠️ TRADING STOPPED!\n\nStop loss limit reached.\n\nTotal Loss: $${amount.toFixed(2)}`;
    
    setTargetMessage({ 
      type, 
      message 
    });
    setShowTargetModal(true);
  };

  return (
    <>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
          {/* Configuration Card */}
          <View style={styles.card}>
            <ThemedText style={styles.cardTitle}>Bot Configuration</ThemedText>
            <View style={styles.inputGroup}>
              <View style={styles.inputWrapper}>
                <ThemedText style={styles.label}>Initial Stake ($)</ThemedText>
                <TextInput
                  style={styles.input}
                  value={config.initialStake}
                  onChangeText={(value) => setConfig({ ...config, initialStake: value })}
                  keyboardType="decimal-pad"
                  placeholder="1.00"
                />
              </View>
              <View style={styles.inputWrapper}>
                <ThemedText style={styles.label}>Take Profit ($)</ThemedText>
                <TextInput
                  style={styles.input}
                  value={config.takeProfit}
                  onChangeText={(value) => setConfig({ ...config, takeProfit: value })}
                  keyboardType="decimal-pad"
                  placeholder="100.00"
                />
              </View>
            </View>
            <View style={styles.inputGroup}>
              <View style={styles.inputWrapper}>
                <ThemedText style={styles.label}>Stop Loss ($)</ThemedText>
                <TextInput
                  style={styles.input}
                  value={config.stopLoss}
                  onChangeText={(value) => setConfig({ ...config, stopLoss: value })}
                  keyboardType="decimal-pad"
                  placeholder="50.00"
                />
              </View>
              <View style={styles.inputWrapper}>
                <ThemedText style={styles.label}>Martingale</ThemedText>
                <TextInput
                  style={styles.input}
                  value={config.martingaleMultiplier}
                  onChangeText={(value) => setConfig({ ...config, martingaleMultiplier: value })}
                  keyboardType="decimal-pad"
                  placeholder="2.00"
                />
              </View>
            </View>
            <TouchableOpacity 
              style={[
                styles.button,
                isRunning ? styles.stopButton : styles.startButton,
                (isLoading || (!isRunning && cooldownTime > 0)) && styles.disabledButton
              ]}
              onPress={handleStartBot}
              disabled={isLoading || (!isRunning && cooldownTime > 0)}
            >
              <ThemedText style={styles.buttonText}>
                {isRunning ? 'Stop Bot' : `Start Bot${!isRunning && cooldownTime > 0 ? ` (${cooldownTime}s)` : ''}`}
              </ThemedText>
            </TouchableOpacity>
          </View>

          {/* Statistics Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <ThemedText style={styles.cardTitle}>Live Statistics</ThemedText>
              {statusBadge && (
                <View style={[
                  styles.statusBadge,
                  statusBadge === 'running' ? styles.runningBadge : styles.analyzingBadge
                ]}>
                  <ThemedText style={styles.statusText}>
                    {statusBadge === 'running' ? 'RUNNING' : 'ANALYZING'}
                  </ThemedText>
                </View>
              )}
            </View>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <ThemedText style={styles.statLabel}>Current Stake</ThemedText>
                <ThemedText style={styles.statValue}>${stats.currentStake.toFixed(2)}</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText style={styles.statLabel}>Total Profit</ThemedText>
                <ThemedText style={[styles.statValue, { color: stats.totalProfit >= 0 ? '#10B981' : '#EF4444' }]}>
                  ${stats.totalProfit.toFixed(2)}
                </ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText style={styles.statLabel}>Total Trades</ThemedText>
                <ThemedText style={styles.statValue}>{stats.totalTrades}</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText style={styles.statLabel}>Win Rate</ThemedText>
                <ThemedText style={styles.statValue}>{stats.winRate}%</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText style={styles.statLabel}>Running Time</ThemedText>
                <ThemedText style={styles.statValue}>{stats.runningTime}</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText style={styles.statLabel}>Progress to Take Profit</ThemedText>
                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <View 
                      style={[
                        styles.progressFill, 
                        { width: `${Math.min(parseFloat(stats.progressToTarget), 100)}%` }
                      ]} 
                    />
                  </View>
                  <ThemedText style={styles.progressText}>{stats.progressToTarget}%</ThemedText>
                </View>
              </View>
            </View>
          </View>

          {/* Trade History Card */}
          <View style={styles.card}>
            <ThemedText style={styles.cardTitle}>Trade History</ThemedText>
            {tradeHistory.map((trade, index) => (
              <View key={index} style={styles.tradeItem}>
                <View style={styles.tradeHeader}>
                  <ThemedText style={styles.tradeTime}>
                    {trade.time.toLocaleTimeString()}
                  </ThemedText>
                  <View style={[
                    styles.tradeResult,
                    trade.result === 'win' ? styles.winResult : styles.lossResult
                  ]}>
                    <ThemedText style={[
                      styles.tradeResultText,
                      trade.result === 'win' ? styles.winResultText : styles.lossResultText
                    ]}>
                      {trade.result.toUpperCase()}
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.tradeDetails}>
                  <ThemedText style={styles.tradeDetail}>
                    Stake: ${trade.stake.toFixed(2)}
                  </ThemedText>
                  <ThemedText style={[
                    styles.tradeProfit,
                    { color: trade.profit >= 0 ? '#10B981' : '#EF4444' }
                  ]}>
                    {trade.profit >= 0 ? '+' : ''}{trade.profit.toFixed(2)}
                  </ThemedText>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>

      <Modal
        transparent
        visible={showTargetModal}
        animationType="fade"
        onRequestClose={() => setShowTargetModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[
            styles.modalContent,
            targetMessage.type === 'profit' ? styles.profitModal : styles.lossModal
          ]}>
            <ThemedText style={styles.modalTitle}>
              {targetMessage.message}
            </ThemedText>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setShowTargetModal(false)}
            >
              <ThemedText style={styles.modalButtonText}>Close</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Disclaimer Modal */}
      <Modal
        transparent
        visible={showDisclaimer}
        animationType="fade"
        onRequestClose={() => setShowDisclaimer(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.disclaimerModal]}>
            <ThemedText style={styles.disclaimerTitle}>⚠️ Risk Warning</ThemedText>
            <ThemedText style={styles.disclaimerText}>
              Trading involves significant risk and can result in the loss of your invested capital. Please ensure that you fully understand the risks involved before using this bot:
            </ThemedText>
            <View style={styles.disclaimerPoints}>
              <ThemedText style={styles.disclaimerPoint}>• Past performance is not indicative of future results</ThemedText>
              <ThemedText style={styles.disclaimerPoint}>• The bot's performance can vary based on market conditions</ThemedText>
              <ThemedText style={styles.disclaimerPoint}>• Never trade with money you cannot afford to lose</ThemedText>
              <ThemedText style={styles.disclaimerPoint}>• Always monitor the bot's activity</ThemedText>
            </View>
            <TouchableOpacity
              style={styles.disclaimerLink}
              onPress={() => {
                Alert.alert(
                  'External Link',
                  'This will open Deriv\'s risk disclosure in your browser.',
                  [
                    {
                      text: 'Open',
                      onPress: () => router.push('https://docs.deriv.com/tnc/risk-disclosure.pdf')
                    },
                    {
                      text: 'Cancel',
                      style: 'cancel'
                    }
                  ]
                );
              }}
            >
              <ThemedText style={styles.disclaimerLinkText}>Read Deriv's Full Risk Disclosure →</ThemedText>
            </TouchableOpacity>
            <View style={styles.disclaimerCheckbox}>
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => setSkipDisclaimer(!skipDisclaimer)}
              >
                <View style={[styles.checkbox, skipDisclaimer && styles.checkboxChecked]}>
                  {skipDisclaimer && <ThemedText style={styles.checkmark}>✓</ThemedText>}
                </View>
                <ThemedText style={styles.checkboxLabel}>Don't show this warning again</ThemedText>
              </TouchableOpacity>
            </View>
            <View style={styles.disclaimerButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.smallButton, styles.declineButton]}
                onPress={() => setShowDisclaimer(false)}
              >
                <ThemedText style={[styles.modalButtonText, styles.smallButtonText]}>Decline</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.smallButton, styles.acceptButton]}
                onPress={startBotAfterDisclaimer}
              >
                <ThemedText style={[styles.modalButtonText, styles.smallButtonText]}>I Understand</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 16,
  },
  inputGroup: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  inputWrapper: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 4,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: '#F8FAFC',
  },
  button: {
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  startButton: {
    backgroundColor: '#10B981',
  },
  stopButton: {
    backgroundColor: '#EF4444',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  statItem: {
    width: '45%',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
    minWidth: 45,
  },
  tradeItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 12,
  },
  tradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tradeTime: {
    fontSize: 14,
    color: '#64748B',
  },
  tradeResult: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  winResult: {
    backgroundColor: '#D1FAE5',
  },
  lossResult: {
    backgroundColor: '#FEE2E2',
  },
  tradeResultText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#047857',
  },
  winResultText: {
    color: '#047857',
  },
  lossResultText: {
    color: '#DC2626',
  },
  tradeDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tradeDetail: {
    fontSize: 14,
    color: '#1E293B',
  },
  tradeProfit: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 32,
    width: '95%',
    maxWidth: 400,
    alignItems: 'center',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    transform: [{ scale: 1.1 }],
  },
  profitModal: {
    backgroundColor: '#ECFDF5',
    borderWidth: 4,
    borderColor: '#10B981',
    borderLeftWidth: 10,
    borderLeftColor: '#10B981',
  },
  lossModal: {
    backgroundColor: '#FEF2F2',
    borderWidth: 4,
    borderColor: '#EF4444',
    borderLeftWidth: 10,
    borderLeftColor: '#EF4444',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 32,
    color: '#1E293B',
    textShadowColor: 'rgba(0, 0, 0, 0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  modalButton: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 24,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    width: '80%',
  },
  modalButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  runningBadge: {
    backgroundColor: '#10B981',
  },
  analyzingBadge: {
    backgroundColor: '#6366F1',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  disabledButton: {
    opacity: 0.7,
  },
  disclaimerModal: {
    backgroundColor: '#FFFFFF',
    padding: 24,
  },
  disclaimerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#DC2626',
    marginBottom: 16,
    textAlign: 'center',
  },
  disclaimerText: {
    fontSize: 16,
    color: '#1E293B',
    lineHeight: 24,
    marginBottom: 16,
    textAlign: 'left',
  },
  disclaimerPoints: {
    marginBottom: 20,
  },
  disclaimerPoint: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 22,
    marginBottom: 8,
    paddingLeft: 8,
  },
  disclaimerLink: {
    marginBottom: 24,
  },
  disclaimerLinkText: {
    color: '#2563EB',
    fontSize: 14,
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
  disclaimerButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 8,
  },
  smallButton: {
    width: 120,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  smallButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  disclaimerCheckbox: {
    marginBottom: 16,
    width: '100%',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#64748B',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  declineButton: {
    flex: 1,
    backgroundColor: '#EF4444',
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#10B981',
  },
});

export default BotScreen; 