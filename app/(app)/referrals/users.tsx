import { StyleSheet, View, TouchableOpacity, ScrollView, Share, Clipboard, TextInput, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/ThemedText';
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { getCurrentUser } from '../../firebase.config';

interface ReferredUser {
  id: string;
  name: string;
  signupDate: Date;
  purchases: Array<{
    botName: string;
    price: number;
    purchaseDate: Date;
    usedDiscount: boolean;
    discountAmount?: number;
  }>;
}

const DEFAULT_P2P_DEPOSIT = "https://p2p.deriv.com/advertiser/426826?advert_id=3182910&t=_30qaRjl291dMjdsyM5hasGNd7ZgqdRLk";
const DEFAULT_P2P_WITHDRAW = "https://p2p.deriv.com/advertiser/426826?advert_id=3202284&t=_30qaRjl291dMjdsyM5hasGNd7ZgqdRLk";
const DERIV_AFFILIATE = "_30qaRjl291dMjdsyM5hasGNd7ZgqdRLk";

function PartnerProgramScreen() {
  const [users, setUsers] = useState<ReferredUser[]>([]);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState<string>('');
  const [referralLink, setReferralLink] = useState<string>('');
  const [showCopiedMessage, setShowCopiedMessage] = useState<'code' | 'link' | null>(null);
  const [p2pDepositLink, setP2pDepositLink] = useState('');
  const [p2pWithdrawLink, setP2pWithdrawLink] = useState('');
  const [paDepositLink, setPaDepositLink] = useState('');
  const [paWithdrawLink, setPaWithdrawLink] = useState('');
  const [isEditingP2P, setIsEditingP2P] = useState(false);
  const [isEditingPA, setIsEditingPA] = useState(false);

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    // Set referral code (using user's uid)
    setReferralCode(currentUser.uid);
    setReferralLink(`https://dfirst.page.link/invite?code=${currentUser.uid}`);

    const db = getFirestore();
    const usersRef = collection(db, 'users');
    const referralsQuery = query(
      usersRef,
      where('referredBy', '==', currentUser.uid)
    );

    const unsubscribe = onSnapshot(referralsQuery, (snapshot) => {
      const referredUsers: ReferredUser[] = [];
      snapshot.forEach((doc) => {
        const userData = doc.data();
        referredUsers.push({
          id: doc.id,
          name: userData.displayName || 'Anonymous User',
          signupDate: userData.createdAt?.toDate() || new Date(),
          purchases: userData.purchases || []
        });
      });
      setUsers(referredUsers.sort((a, b) => b.signupDate.getTime() - a.signupDate.getTime()));
    });

    // Load P2P and Payment Agent links
    const loadLinks = async () => {
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setP2pDepositLink(data.p2pDepositLink || '');
        setP2pWithdrawLink(data.p2pWithdrawLink || '');
        setPaDepositLink(data.paDepositLink || '');
        setPaWithdrawLink(data.paWithdrawLink || '');
      }
    };

    loadLinks();

    return () => unsubscribe();
  }, []);

  const handleCopyCode = async () => {
    await Clipboard.setString(referralCode);
    setShowCopiedMessage('code');
    setTimeout(() => setShowCopiedMessage(null), 2000);
  };

  const handleCopyLink = async () => {
    await Clipboard.setString(referralLink);
    setShowCopiedMessage('link');
    setTimeout(() => setShowCopiedMessage(null), 2000);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `🚀 Check out this new Deriv-powered trading platform!\n\nFeatures:\n✨ Free AI-powered trading bots\n💳 Instant P2P & Payment Agent deposits and withdrawals\n📊 Advanced trading tools\n👥 Active trading community\n🤝 Partner program\n\nAll powered by Deriv's secure infrastructure.\n\nGet started here: ${referralLink}`,
        title: 'DFirst Trading Platform'
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const calculatePayout = (purchase: ReferredUser['purchases'][0]) => {
    const baseShare = purchase.price * 0.5; // 50% share
    if (purchase.usedDiscount && purchase.discountAmount) {
      return baseShare - (purchase.discountAmount * 0.5); // Deduct 50% of discount from share
    }
    return baseShare;
  };

  const toggleUserExpansion = (userId: string) => {
    setExpandedUser(expandedUser === userId ? null : userId);
  };

  const validateP2PLink = (link: string) => {
    if (!link) return true; // Empty link is valid (will use default)
    return link.startsWith('https://p2p.deriv.com/');
  };

  const validatePALink = (link: string) => {
    if (!link) return true; // Empty link is valid (will use default)
    return link.includes('deriv.com/') && link.includes('payment_agent');
  };

  const addAffiliateToLink = (link: string) => {
    if (!link) return link;
    const url = new URL(link);
    url.searchParams.set('t', DERIV_AFFILIATE);
    return url.toString();
  };

  const handleSaveP2PLinks = async () => {
    if (!validateP2PLink(p2pDepositLink) || !validateP2PLink(p2pWithdrawLink)) {
      Alert.alert('Invalid Link', 'Please enter valid Deriv P2P links only');
      return;
    }

    const currentUser = getCurrentUser();
    if (!currentUser) return;

    try {
      const db = getFirestore();
      await setDoc(doc(db, 'users', currentUser.uid), {
        p2pDepositLink: p2pDepositLink ? addAffiliateToLink(p2pDepositLink) : '',
        p2pWithdrawLink: p2pWithdrawLink ? addAffiliateToLink(p2pWithdrawLink) : '',
      }, { merge: true });

      setIsEditingP2P(false);
    } catch (error) {
      console.error('Error saving P2P links:', error);
      Alert.alert('Error', 'Failed to save P2P links');
    }
  };

  const handleSavePALinks = async () => {
    if (!validatePALink(paDepositLink) || !validatePALink(paWithdrawLink)) {
      Alert.alert('Invalid Link', 'Please enter valid Deriv Payment Agent links only');
      return;
    }

    const currentUser = getCurrentUser();
    if (!currentUser) return;

    try {
      const db = getFirestore();
      await setDoc(doc(db, 'users', currentUser.uid), {
        paDepositLink: paDepositLink ? addAffiliateToLink(paDepositLink) : '',
        paWithdrawLink: paWithdrawLink ? addAffiliateToLink(paWithdrawLink) : '',
      }, { merge: true });

      setIsEditingPA(false);
    } catch (error) {
      console.error('Error saving Payment Agent links:', error);
      Alert.alert('Error', 'Failed to save Payment Agent links');
    }
  };

  const handleOpenDerivP2P = () => {
    Linking.openURL('https://p2p.deriv.com/?t=' + DERIV_AFFILIATE);
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <ThemedText style={styles.title}>Partner Program</ThemedText>
          <ThemedText style={styles.subtitle}>
            Join our partner community and unlock 24/7 passive income opportunities. Earn and withdraw anytime while helping others succeed.
          </ThemedText>
        </View>

        <View style={styles.referralSection}>
          <View style={styles.referralCard}>
            <View style={styles.referralHeader}>
              <ThemedText style={styles.referralTitle}>Partner Link</ThemedText>
              <TouchableOpacity 
                style={styles.shareButton}
                onPress={handleShare}
              >
                <ThemedText style={styles.shareButtonText}>Share ↗️</ThemedText>
              </TouchableOpacity>
            </View>
            
            <View style={styles.referralDetails}>
              <TouchableOpacity 
                style={styles.codeButton} 
                onPress={handleCopyCode}
              >
                <View style={styles.codeWrapper}>
                  <ThemedText style={styles.codeLabel}>Code:</ThemedText>
                  <ThemedText style={styles.codeText}>
                    {referralCode.substring(0, 8)}...
                  </ThemedText>
                </View>
                {showCopiedMessage === 'code' && (
                  <ThemedText style={styles.copiedText}>Copied!</ThemedText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.p2pSection}>
          <View style={styles.p2pCard}>
            <View style={styles.p2pHeader}>
              <ThemedText style={styles.p2pTitle}>P2P Links (Optional)</ThemedText>
              <TouchableOpacity 
                style={styles.p2pButton}
                onPress={() => isEditingP2P ? handleSaveP2PLinks() : setIsEditingP2P(true)}
              >
                <ThemedText style={styles.p2pButtonText}>
                  {isEditingP2P ? 'Save' : 'Edit'}
                </ThemedText>
              </TouchableOpacity>
            </View>

            {isEditingP2P ? (
              <View style={styles.p2pInputs}>
                <View style={styles.inputGroup}>
                  <ThemedText style={styles.inputLabel}>P2P Deposit Link</ThemedText>
                  <TextInput
                    style={styles.p2pInput}
                    value={p2pDepositLink}
                    onChangeText={setP2pDepositLink}
                    placeholder="https://p2p.deriv.com/..."
                    autoCapitalize="none"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <ThemedText style={styles.inputLabel}>P2P Withdraw Link</ThemedText>
                  <TextInput
                    style={styles.p2pInput}
                    value={p2pWithdrawLink}
                    onChangeText={setP2pWithdrawLink}
                    placeholder="https://p2p.deriv.com/..."
                    autoCapitalize="none"
                  />
                </View>
                <TouchableOpacity 
                  onPress={handleOpenDerivP2P}
                >
                  <ThemedText style={styles.getLinksText}>
                    Get your P2P links from Deriv ↗️
                  </ThemedText>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.p2pStatus}>
                <ThemedText style={styles.p2pStatusText}>
                  {p2pDepositLink || p2pWithdrawLink ? 
                    'Your P2P links are set up' : 
                    'Set up your P2P links to earn from deposits & withdrawals'}
                </ThemedText>
              </View>
            )}
          </View>
        </View>

        <View style={styles.p2pSection}>
          <View style={styles.p2pCard}>
            <View style={styles.p2pHeader}>
              <ThemedText style={styles.p2pTitle}>Payment Agent Links (Optional)</ThemedText>
              <TouchableOpacity 
                style={styles.p2pButton}
                onPress={() => isEditingPA ? handleSavePALinks() : setIsEditingPA(true)}
              >
                <ThemedText style={styles.p2pButtonText}>
                  {isEditingPA ? 'Save' : 'Edit'}
                </ThemedText>
              </TouchableOpacity>
            </View>

            {isEditingPA ? (
              <View style={styles.p2pInputs}>
                <View style={styles.inputGroup}>
                  <ThemedText style={styles.inputLabel}>Payment Agent Deposit Link</ThemedText>
                  <TextInput
                    style={styles.p2pInput}
                    value={paDepositLink}
                    onChangeText={setPaDepositLink}
                    placeholder="https://deriv.com/payment_agent/..."
                    autoCapitalize="none"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <ThemedText style={styles.inputLabel}>Payment Agent Withdraw Link</ThemedText>
                  <TextInput
                    style={styles.p2pInput}
                    value={paWithdrawLink}
                    onChangeText={setPaWithdrawLink}
                    placeholder="https://deriv.com/payment_agent/..."
                    autoCapitalize="none"
                  />
                </View>
                <TouchableOpacity 
                  onPress={() => Linking.openURL('https://track.deriv.com/_30qaRjl291dMjdsyM5hasGNd7ZgqdRLk/1/')}
                >
                  <ThemedText style={styles.getLinksText}>
                    Get your Payment Agent links from Deriv ↗️
                  </ThemedText>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.p2pStatus}>
                <ThemedText style={styles.p2pStatusText}>
                  {paDepositLink || paWithdrawLink ? 
                    'Your Payment Agent links are set up' : 
                    'Set up your Payment Agent links to earn from deposits & withdrawals'}
                </ThemedText>
              </View>
            )}
          </View>
        </View>

        <View style={styles.usersSection}>
          <View style={styles.usersSummary}>
            <ThemedText style={styles.usersTitle}>Your Community</ThemedText>
            <View style={styles.userCount}>
              <ThemedText style={styles.userCountNumber}>{users.length}</ThemedText>
              <ThemedText style={styles.userCountLabel}>Total Users</ThemedText>
            </View>
          </View>

          <View style={styles.usersList}>
            {users.map((user) => (
              <View key={user.id} style={styles.userCard}>
                <TouchableOpacity 
                  style={styles.userHeader}
                  onPress={() => toggleUserExpansion(user.id)}
                >
                  <View>
                    <ThemedText style={styles.userName}>{user.name}</ThemedText>
                    <ThemedText style={styles.userDate}>
                      Joined {user.signupDate.toLocaleDateString()}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.userPurchaseCount}>
                    {user.purchases.length} bot{user.purchases.length !== 1 ? 's' : ''}
                  </ThemedText>
                </TouchableOpacity>

                {expandedUser === user.id && user.purchases.length > 0 && (
                  <View style={styles.purchasesList}>
                    {user.purchases.map((purchase, index) => (
                      <View key={index} style={styles.purchaseItem}>
                        <View style={styles.purchaseHeader}>
                          <ThemedText style={styles.botName}>{purchase.botName}</ThemedText>
                          <ThemedText style={styles.purchaseDate}>
                            {purchase.purchaseDate.toLocaleDateString()}
                          </ThemedText>
                        </View>
                        
                        <View style={styles.purchaseDetails}>
                          <View style={styles.priceRow}>
                            <ThemedText style={styles.priceLabel}>Price</ThemedText>
                            <ThemedText style={styles.priceValue}>
                              ${purchase.price.toFixed(2)}
                            </ThemedText>
                          </View>
                          
                          {purchase.usedDiscount && (
                            <View style={styles.discountRow}>
                              <ThemedText style={styles.discountLabel}>Discount Used</ThemedText>
                              <ThemedText style={styles.discountValue}>
                                -${purchase.discountAmount?.toFixed(2) || '0.00'}
                              </ThemedText>
                            </View>
                          )}
                          
                          <View style={styles.payoutRow}>
                            <ThemedText style={styles.payoutLabel}>Your Share</ThemedText>
                            <ThemedText style={styles.payoutValue}>
                              ${calculatePayout(purchase).toFixed(2)}
                            </ThemedText>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}

            {users.length === 0 && (
              <View style={styles.emptyState}>
                <ThemedText style={styles.emptyStateText}>
                  No referred users yet. Share your link to start earning!
                </ThemedText>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
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
  },
  header: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E293B',
    paddingTop: 12,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  usersSection: {
    paddingHorizontal: 20,
  },
  usersSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  usersTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
  },
  userCount: {
    alignItems: 'center',
  },
  userCountNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#10B981',
  },
  userCountLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  usersList: {
    gap: 12,
  },
  userCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  userDate: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  userPurchaseCount: {
    fontSize: 14,
    color: '#6366F1',
    fontWeight: '500',
  },
  purchasesList: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    padding: 16,
    gap: 16,
  },
  purchaseItem: {
    gap: 8,
  },
  purchaseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  botName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  purchaseDate: {
    fontSize: 12,
    color: '#64748B',
  },
  purchaseDetails: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  priceValue: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '500',
  },
  discountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  discountLabel: {
    fontSize: 12,
    color: '#EF4444',
  },
  discountValue: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '500',
  },
  payoutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 8,
    marginTop: 4,
  },
  payoutLabel: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
  },
  payoutValue: {
    fontSize: 16,
    color: '#10B981',
    fontWeight: '600',
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  referralSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  referralCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  referralHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  referralTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  shareButton: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  shareButtonText: {
    fontSize: 14,
    color: '#4F46E5',
    fontWeight: '600',
  },
  referralDetails: {
    gap: 12,
  },
  codeButton: {
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  codeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  codeLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  codeText: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '500',
    fontFamily: 'monospace',
  },
  copiedText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
  },
  p2pSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  p2pCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  p2pHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  p2pTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  p2pButton: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  p2pButtonText: {
    fontSize: 14,
    color: '#4F46E5',
    fontWeight: '600',
  },
  p2pInputs: {
    gap: 12,
  },
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  p2pInput: {
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    fontSize: 14,
    color: '#1E293B',
  },
  getLinksText: {
    fontSize: 13,
    color: '#4F46E5',
    textAlign: 'center',
  },
  p2pStatus: {
    padding: 8,
  },
  p2pStatusText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
});

export default PartnerProgramScreen; 