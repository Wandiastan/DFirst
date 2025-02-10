import { StyleSheet, View, ScrollView, TouchableOpacity, Modal, Linking, Alert, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/ThemedText';
import { router } from 'expo-router';
import { useState, useEffect } from 'react';
import { getCurrentUser } from '../../firebase.config';
import { 
  initializePayment, 
  checkSubscriptionStatus, 
  getBotTier, 
  isBotFree, 
  handlePaymentCallback,
  Subscription,
  getSubscriptionTimeRemaining,
  initializeMPesaPayment
} from './bots_payments/bots_subscriptions';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface BotCard {
  name: string;
  description: string;
  symbol: string;
  features: string[];
  file: string;
  color: string;
  rating: number;
}

const bots: BotCard[] = [
  {
    name: 'Safe Over Bot',
    description: 'Low-risk trading on digits over 0 with consecutive pattern analysis',
    symbol: 'R_10',
    features: ['Low Risk', 'Zero Pattern Analysis', 'Conservative Trading'],
    file: 'safeoverbot',
    color: '#4CAF50',
    rating: 4.7
  },
  {
    name: 'Safe Under Bot',
    description: 'Low-risk trading on digits under 9 with consecutive pattern analysis',
    symbol: 'R_10',
    features: ['Low Risk', 'Nine Pattern Analysis', 'Conservative Trading'],
    file: 'safeunderbot',
    color: '#2196F3',
    rating: 4.7
  },
  {
    name: 'Russian Odds Bot',
    description: 'Fast-paced even/odd trading with 5-tick pattern analysis and relaxed recovery',
    symbol: 'R_50',
    features: ['5-Tick Analysis', 'Quick Recovery', 'Pattern Trading'],
    file: 'russianodds',
    color: '#FF4081',
    rating: 4.6
  },
  {
    name: 'Smart Volatility Bot',
    description: 'Advanced volatility trading with dynamic timeframes and smart risk adjustment',
    symbol: 'R_75',
    features: ['Volatility Measurement', 'Dynamic Timeframes', 'Smart Risk Adjustment'],
    file: 'smartvolatility',
    color: '#E91E63',
    rating: 4.7
  },
  {
    name: 'Smart Even Bot',
    description: 'Advanced even/odd trading with smart pattern analysis and recovery',
    symbol: 'R_50',
    features: ['Pattern Analysis', 'Smart Recovery', 'Streak Detection'],
    file: 'smarteven',
    color: '#673AB7',
    rating: 4.8
  },
  {
    name: 'Metro Differ Bot',
    description: 'Smart digit differ trading with random and pattern-based strategies',
    symbol: 'R_25',
    features: ['Random Strategy', 'Pattern Analysis', 'Smart Recovery'],
    file: 'metrodiffer',
    color: '#9C27B0',
    rating: 4.6
  },
  {
    name: 'Alien Rise Fall Bot',
    description: 'Advanced rise/fall trading with smart trend confirmation and recovery',
    symbol: 'R_10',
    features: ['Smart Recovery', 'Trend Analysis', 'Adaptive Trading'],
    file: 'alienrisefall',
    color: '#00BCD4',
    rating: 4.8
  },
  {
    name: 'DIFFER Bot',
    description: 'Trades on digit difference patterns with advanced pattern recognition',
    symbol: 'R_25',
    features: ['Pattern Recognition', 'Martingale Strategy', 'Real-time Stats'],
    file: 'DIFFERbot',
    color: '#FF6B6B',
    rating: 4.5
  },
  {
    name: 'No Touch Bot',
    description: 'Advanced technical analysis with volatility-based trading',
    symbol: 'R_100',
    features: ['Technical Analysis', 'Volatility Trading', 'Risk Management'],
    file: 'notouchbot',
    color: '#D4A5A5',
    rating: 4.6
  },
  {
    name: 'Rise Fall Bot',
    description: 'Comprehensive technical analysis with multiple indicators',
    symbol: 'R_10',
    features: ['Multiple Indicators', 'Volume Analysis', 'Risk Management'],
    file: 'risefallbot',
    color: '#2A363B',
    rating: 4.9
  },
  {
    name: 'High Risk Over Bot',
    description: 'High-risk trading on digits over 4-5 with higher payouts',
    symbol: 'R_10',
    features: ['High Risk', 'High Payout', 'Dynamic Barriers'],
    file: 'overbot',
    color: '#FFA726',
    rating: 4.4
  },
  {
    name: 'High Risk Under Bot',
    description: 'High-risk trading on digits under 5-6 with higher payouts',
    symbol: 'R_100',
    features: ['High Risk', 'High Payout', 'Dynamic Barriers'],
    file: 'underbot',
    color: '#99B898',
    rating: 4.3
  }
];

const MPESA_NUMBER_KEY = '@mpesa_number';

function BotCard({ bot }: { bot: BotCard }) {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<'weekly' | 'monthly'>('weekly');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isModalLoading, setIsModalLoading] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<'mpesa' | 'card'>('mpesa');
  const [phoneNumber, setPhoneNumber] = useState('');

  useEffect(() => {
    checkBotAccess();
  }, [bot.name]);

  useEffect(() => {
    const loadMpesaNumber = async () => {
      try {
        const savedNumber = await AsyncStorage.getItem(MPESA_NUMBER_KEY);
        if (savedNumber) {
          setPhoneNumber(savedNumber);
        }
      } catch (error) {
        console.error('Error loading M-Pesa number:', error);
      }
    };
    loadMpesaNumber();
  }, []);

  const checkBotAccess = async () => {
    try {
      setIsCheckingAccess(true);
      const user = getCurrentUser();
      if (!user) return;

      const botSubscription = await checkSubscriptionStatus(user.uid, bot.name);
      setSubscription(botSubscription);
    } catch (error) {
      console.error('[Trading] Failed to check bot access:', error);
    } finally {
      setIsCheckingAccess(false);
    }
  };

  const handleBotAccess = async () => {
    try {
      setIsModalLoading(true);
      console.log('[Trading] Checking bot access for:', bot.name);
      if (isBotFree(bot.name)) {
        console.log('[Trading] Bot is free, redirecting to:', bot.file);
        router.push(`/bots/${bot.file}`);
        return;
      }

      const user = getCurrentUser();
      console.log('[Trading] Current user:', user?.uid);
      if (!user) {
        console.log('[Trading] No user found, redirecting to auth');
        Alert.alert('Login Required', 'Please login to access this bot');
        router.push('/');
        return;
      }

      // Check if user has active subscription for this bot
      const botSubscription = await checkSubscriptionStatus(user.uid, bot.name);
      if (botSubscription) {
        console.log('[Trading] Active subscription found, redirecting to bot');
        router.push(`/bots/${bot.file}`);
        return;
      }

      console.log('[Trading] No active subscription, showing payment modal');
      setShowPaymentModal(true);
    } catch (error) {
      console.error('[Trading] Access check failed:', error);
      Alert.alert('Error', 'Failed to check bot access. Please try again.');
    } finally {
      setIsModalLoading(false);
    }
  };

  const handlePayment = async () => {
    if (isProcessing) return;

    try {
      console.log('[Trading] Initializing payment process');
      setIsProcessing(true);
      const user = getCurrentUser();
      console.log('[Trading] User details:', { uid: user?.uid, email: user?.email });
      
      if (!user || !user.email) {
        console.log('[Trading] No user or email found');
        Alert.alert('Error', 'Please log in to continue');
        return;
      }

      const botTier = getBotTier(bot.name);
      console.log('[Trading] Bot tier details:', botTier);
      if (!botTier) {
        console.log('[Trading] Invalid bot tier for:', bot.name);
        Alert.alert('Error', 'Invalid bot tier');
        return;
      }

      const amount = selectedDuration === 'weekly' ? botTier.weeklyPrice : botTier.monthlyPrice;
      console.log('[Trading] Payment details:', {
        amount,
        duration: selectedDuration,
        tier: botTier.name
      });

      if (paymentMethod === 'mpesa') {
        // Format and validate phone number
        let formattedPhone = phoneNumber;
        if (phoneNumber.length === 9) {
          formattedPhone = '0' + phoneNumber;
        }
        if (!formattedPhone.startsWith('0')) {
          formattedPhone = '0' + formattedPhone;
        }
        
        // Save the M-Pesa number
        await AsyncStorage.setItem(MPESA_NUMBER_KEY, formattedPhone);
        
        // Convert to international format for M-Pesa
        formattedPhone = '254' + formattedPhone.substring(1);
        
        console.log('[Trading] Processing M-Pesa payment:', {
          originalNumber: phoneNumber,
          formattedNumber: formattedPhone,
          amount,
          metadata: {
            botName: bot.name,
            userId: user.uid,
            tier: botTier.name,
            subscriptionType: selectedDuration
          }
        });

        if (formattedPhone.length !== 12) {
          Alert.alert('Error', 'Please enter a valid phone number (e.g., 0712345678)');
          return;
        }

        try {
          const session = await initializeMPesaPayment(
            formattedPhone,
            amount,
            { 
              botName: bot.name,
              userId: user.uid,
              tier: botTier.name,
              subscriptionType: selectedDuration
            }
          );

          console.log('[Trading] M-Pesa session response:', session);
          if (!session || !session.checkoutRequestID) {
            console.error('[Trading] Invalid M-Pesa session:', {
              session,
              error: 'Missing checkoutRequestID'
            });
            Alert.alert('Error', 'Failed to initialize M-Pesa payment. Please try again.');
            return;
          }

          Alert.alert(
            'STK Push Sent',
            'Please check your phone for the M-Pesa payment prompt and enter your PIN to complete the payment.',
            [{ text: 'OK' }]
          );
          setShowPaymentModal(false);
        } catch (error) {
          console.error('[Trading] M-Pesa payment error:', {
            error,
            phoneNumber: formattedPhone,
            amount,
            metadata: {
              botName: bot.name,
              userId: user.uid,
              tier: botTier.name
            }
          });
          Alert.alert('Error', 'Failed to process M-Pesa payment. Please try again.');
        }
      } else {
        const session = await initializePayment(
          amount,
          user.email,
          botTier.name,
          selectedDuration,
          { 
            botName: bot.name,
            userId: user.uid,
            returnUrl: 'https://dfirst-payments.onrender.com/payment/verify'
          }
        );

        console.log('[Trading] Card payment session created:', session);
        if (!session || !session.authorization_url) {
          console.error('[Trading] Invalid payment session:', session);
          Alert.alert('Error', 'Failed to initialize card payment. Please try again.');
          return;
        }

        await Linking.openURL(session.authorization_url);
        setShowPaymentModal(false);
      }
    } catch (error) {
      console.error('[Trading] Payment failed:', error);
      if (error instanceof Error) {
        console.error('[Trading] Payment error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
      }
      Alert.alert(
        'Payment Error',
        'Failed to initialize payment. Please try again later.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <View style={[styles.card, { borderLeftColor: bot.color }]}>
      <View style={styles.cardHeader}>
        <ThemedText style={styles.botName}>{bot.name}</ThemedText>
        <View style={styles.headerRight}>
          <View style={[styles.ratingTag, { backgroundColor: bot.color + '20' }]}>
            <ThemedText style={[styles.ratingText, { color: bot.color }]}>★ {bot.rating}</ThemedText>
          </View>
          <View style={[styles.symbolTag, { backgroundColor: bot.color }]}>
            <ThemedText style={styles.symbolText}>{bot.symbol}</ThemedText>
          </View>
        </View>
      </View>
      
      <ThemedText style={styles.description}>{bot.description}</ThemedText>
      
      <View style={styles.features}>
        {bot.features.map((feature, index) => (
          <View key={index} style={[styles.featureTag, { backgroundColor: `${bot.color}20` }]}>
            <ThemedText style={[styles.featureText, { color: bot.color }]}>{feature}</ThemedText>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.accessButton, { backgroundColor: bot.color }]}
        onPress={handleBotAccess}
        disabled={isModalLoading || isCheckingAccess}
      >
        {isModalLoading || isCheckingAccess ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <View style={styles.accessButtonContent}>
            <ThemedText style={styles.buttonText}>
              {isBotFree(bot.name) ? 'Access Bot' : 
               subscription ? 'Access Bot' : 'Subscribe to Access'}
            </ThemedText>
            {subscription && (
              <View style={[styles.durationBadge, { backgroundColor: '#FFFFFF30' }]}>
                <ThemedText style={[styles.durationText, { color: '#FFFFFF' }]}>
                  {getSubscriptionTimeRemaining(subscription.endDate)}
                </ThemedText>
              </View>
            )}
            {isBotFree(bot.name) && (
              <View style={[styles.freeBadge, { backgroundColor: '#FFFFFF30' }]}>
                <ThemedText style={[styles.freeBadgeText, { color: '#FFFFFF' }]}>
                  FREE
                </ThemedText>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>

      <Modal
        visible={showPaymentModal}
        transparent
        animationType="slide"
        onRequestClose={() => !isProcessing && setShowPaymentModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={[styles.modalHeader, { backgroundColor: bot.color + '20' }]}>
              <ThemedText style={[styles.modalBotName, { color: bot.color }]}>{bot.name}</ThemedText>
              <ThemedText style={styles.modalRating}>★ {bot.rating}</ThemedText>
            </View>
            
            <ThemedText style={styles.modalHype}>
              {bot.features[0]} • {bot.features[1]} • {bot.features[2]}
            </ThemedText>

            <View style={styles.durationContainer}>
              <TouchableOpacity
                style={[
                  styles.durationButton,
                  selectedDuration === 'weekly' && [styles.selectedDuration, { borderColor: bot.color }]
                ]}
                onPress={() => !isProcessing && setSelectedDuration('weekly')}
                disabled={isProcessing}
              >
                <View style={styles.durationContent}>
                  <ThemedText style={[
                    styles.durationText,
                    selectedDuration === 'weekly' && { color: bot.color }
                  ]}>
                    Weekly
                  </ThemedText>
                  <ThemedText style={[
                    styles.priceText,
                    selectedDuration === 'weekly' && { color: bot.color }
                  ]}>
                    KES {getBotTier(bot.name)?.weeklyPrice}
                  </ThemedText>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.durationButton,
                  selectedDuration === 'monthly' && [styles.selectedDuration, { borderColor: bot.color }]
                ]}
                onPress={() => !isProcessing && setSelectedDuration('monthly')}
                disabled={isProcessing}
              >
                <View style={styles.durationContent}>
                  <ThemedText style={[
                    styles.durationText,
                    selectedDuration === 'monthly' && { color: bot.color }
                  ]}>
                    Monthly
                  </ThemedText>
                  <ThemedText style={[
                    styles.priceText,
                    selectedDuration === 'monthly' && { color: bot.color }
                  ]}>
                    KES {getBotTier(bot.name)?.monthlyPrice}
                  </ThemedText>
                  <ThemedText style={styles.savingsTag}>Save 20%</ThemedText>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.paymentSection}>
              <View style={styles.paymentMethodContainer}>
                <TouchableOpacity
                  style={[
                    styles.paymentMethodButton,
                    paymentMethod === 'mpesa' && [styles.selectedPaymentMethod, { borderColor: bot.color }]
                  ]}
                  onPress={() => setPaymentMethod('mpesa')}
                  disabled={isProcessing}
                >
                  <ThemedText style={[
                    styles.paymentMethodText,
                    paymentMethod === 'mpesa' && { color: bot.color }
                  ]}>
                    M-Pesa
                  </ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.paymentMethodButton,
                    paymentMethod === 'card' && [styles.selectedPaymentMethod, { borderColor: bot.color }]
                  ]}
                  onPress={() => setPaymentMethod('card')}
                  disabled={isProcessing}
                >
                  <ThemedText style={[
                    styles.paymentMethodText,
                    paymentMethod === 'card' && { color: bot.color }
                  ]}>
                    Card
                  </ThemedText>
                </TouchableOpacity>
              </View>

              {paymentMethod === 'mpesa' && (
                <View style={styles.phoneInputContainer}>
                  <TextInput
                    style={styles.phoneInput}
                    placeholder="Phone Number (e.g., 0712345678)"
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    keyboardType="phone-pad"
                    maxLength={10}
                    editable={!isProcessing}
                  />
                </View>
              )}
            </View>

            <TouchableOpacity
              style={[
                styles.paymentButton,
                { backgroundColor: bot.color, opacity: isProcessing ? 0.7 : 1 }
              ]}
              onPress={handlePayment}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color="#FFFFFF" />
                  <ThemedText style={[styles.paymentButtonText, styles.loadingText]}>
                    Processing...
                  </ThemedText>
                </View>
              ) : (
                <ThemedText style={styles.paymentButtonText}>
                  {paymentMethod === 'mpesa' ? 'Pay with M-Pesa' : 'Pay with Card'}
                </ThemedText>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => !isProcessing && setShowPaymentModal(false)}
              disabled={isProcessing}
            >
              <ThemedText style={[styles.cancelText, isProcessing && styles.disabledText]}>
                Cancel
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function TradingScreen() {
  useEffect(() => {
    const subscription = Linking.addEventListener('url', async (event) => {
      if (event.url.includes('dfirsttrader://payment/verify')) {
        console.log('[Trading] Payment callback received:', event.url);
        const result = await handlePaymentCallback(event.url);
        
        if (result.success) {
          Alert.alert('Success', 'Payment successful! You now have access to the bot.');
          // If we're not already on the trading screen, navigate there
          if (result.screen === 'trading') {
            router.push('/bots/trading');
          }
        } else {
          Alert.alert('Error', 'Payment verification failed. Please contact support if you were charged.');
          // Still navigate to trading screen on error to maintain UX
          if (result.screen === 'trading') {
            router.push('/bots/trading');
          }
        }
      }
    });

    // Check for initial URL (app opened via payment callback)
    Linking.getInitialURL().then(async (url) => {
      if (url && url.includes('dfirsttrader://payment/verify')) {
        console.log('[Trading] Initial payment callback:', url);
        const result = await handlePaymentCallback(url);
        
        if (result.success) {
          Alert.alert('Success', 'Payment successful! You now have access to the bot.');
          // If we're not already on the trading screen, navigate there
          if (result.screen === 'trading') {
            router.push('/bots/trading');
          }
        } else {
          Alert.alert('Error', 'Payment verification failed. Please contact support if you were charged.');
          // Still navigate to trading screen on error to maintain UX
          if (result.screen === 'trading') {
            router.push('/bots/trading');
          }
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <ThemedText style={styles.title}>Trading Bots</ThemedText>
          <ThemedText style={styles.subtitle}>Choose a bot to start trading</ThemedText>
        </View>
        
        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          {bots.map((bot, index) => (
            <BotCard key={index} bot={bot} />
          ))}
        </ScrollView>
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
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E293B',
    paddingTop: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  botName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600',
  },
  symbolTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  symbolText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  description: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 12,
    lineHeight: 20,
  },
  features: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  featureTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  featureText: {
    fontSize: 12,
    fontWeight: '500',
  },
  accessButton: {
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  accessButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '90%',
    maxWidth: 320,
    overflow: 'hidden',
  },
  modalHeader: {
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalBotName: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalRating: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalHype: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  durationContainer: {
    padding: 12,
    gap: 8,
  },
  durationButton: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  durationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 55,
  },
  selectedDuration: {
    backgroundColor: '#FFFFFF',
  },
  durationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  priceText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  savingsTag: {
    position: 'absolute',
    right: -8,
    top: -8,
    backgroundColor: '#22C55E',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  paymentSection: {
    padding: 12,
    gap: 8,
  },
  paymentMethodContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  paymentMethodButton: {
    flex: 1,
    height: 40,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  selectedPaymentMethod: {
    backgroundColor: '#FFFFFF',
  },
  paymentMethodText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  phoneInputContainer: {
    marginTop: 4,
  },
  phoneInput: {
    height: 40,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    backgroundColor: '#F8FAFC',
  },
  paymentButton: {
    margin: 12,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  paymentButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButton: {
    alignItems: 'center',
    paddingBottom: 12,
  },
  cancelText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '500',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    marginLeft: 8,
  },
  disabledText: {
    opacity: 0.5,
  },
  durationBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  freeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  freeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default TradingScreen; 