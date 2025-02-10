import { StyleSheet, View, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/ThemedText';
import { useState, useEffect } from 'react';
import { getFirestore, collection, query, orderBy, onSnapshot, doc, updateDoc, Timestamp, getDoc, writeBatch } from 'firebase/firestore';

interface BotTransaction {
  id: string;
  userId: string;
  botName: string;
  amount: number;
  duration: 'weekly' | 'monthly';
  paymentMethod: 'mpesa' | 'card';
  referredBy: string | null;
  timestamp: Timestamp;
  status: 'completed' | 'failed';
  paymentReference: string;
}

interface WithdrawalRequest {
  id: string;
  partnerId: string;
  amount: number;
  mpesaNumber: string;
  mpesaName: string;
  timestamp: Timestamp;
  status: 'pending' | 'approved' | 'rejected';
  relatedTransactions: string[];
  totalEarnings: number;
  pendingPayout: number;
}

function AdminScreen() {
  const [transactions, setTransactions] = useState<BotTransaction[]>([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([]);
  const [selectedTab, setSelectedTab] = useState<'transactions' | 'withdrawals'>('transactions');

  useEffect(() => {
    const db = getFirestore();
    
    // Listen to bot transactions
    const transactionsQuery = query(
      collection(db, 'botTransactions'),
      orderBy('timestamp', 'desc')
    );

    const unsubscribeTransactions = onSnapshot(transactionsQuery, (snapshot) => {
      const transactionData: BotTransaction[] = [];
      snapshot.forEach((doc) => {
        transactionData.push({ id: doc.id, ...doc.data() } as BotTransaction);
      });
      setTransactions(transactionData);
    });

    // Listen to withdrawal requests
    const withdrawalsQuery = query(
      collection(db, 'withdrawalRequests'),
      orderBy('timestamp', 'desc')
    );

    const unsubscribeWithdrawals = onSnapshot(withdrawalsQuery, (snapshot) => {
      const withdrawalData: WithdrawalRequest[] = [];
      snapshot.forEach((doc) => {
        withdrawalData.push({ id: doc.id, ...doc.data() } as WithdrawalRequest);
      });
      setWithdrawalRequests(withdrawalData);
    });

    return () => {
      unsubscribeTransactions();
      unsubscribeWithdrawals();
    };
  }, []);

  const handleApproveWithdrawal = async (requestId: string) => {
    const db = getFirestore();
    const withdrawalRef = doc(db, 'withdrawalRequests', requestId);
    
    try {
      // Get the withdrawal request data
      const withdrawalDoc = await getDoc(withdrawalRef);
      if (!withdrawalDoc.exists()) return;
      
      const withdrawalData = withdrawalDoc.data() as WithdrawalRequest;
      
      // Start a batch operation
      const batch = writeBatch(db);
      
      // 1. Update withdrawal request status
      batch.update(withdrawalRef, {
        status: 'approved',
        processedAt: Timestamp.now()
      });
      
      // 2. Update user's pending payout and total earnings
      const userRef = doc(db, 'users', withdrawalData.partnerId);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        batch.update(userRef, {
          pendingPayout: 0, // Reset pending payout
          totalEarned: userDoc.data().totalEarned || withdrawalData.totalEarnings // Ensure total earnings are preserved
        });
      }
      
      // 3. Update all related transactions to 'withdrawn' status
      for (const transactionId of withdrawalData.relatedTransactions) {
        const [botName, userId] = transactionId.split('_');
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const updatedPurchases = userData.purchases.map((purchase: BotPurchase) => {
            if (purchase.botName === botName && purchase.status === 'pending') {
              return { ...purchase, status: 'withdrawn' };
            }
            return purchase;
          });
          
          batch.update(userRef, { purchases: updatedPurchases });
        }
      }
      
      // Commit all changes
      await batch.commit();
      
      Alert.alert('Success', 'Withdrawal approved and records updated');
    } catch (error) {
      console.error('Error approving withdrawal:', error);
      Alert.alert('Error', 'Failed to approve withdrawal. Please try again.');
    }
  };

  const handleRejectWithdrawal = async (requestId: string) => {
    const db = getFirestore();
    await updateDoc(doc(db, 'withdrawalRequests', requestId), {
      status: 'rejected',
      processedAt: Timestamp.now()
    });
  };

  const renderTransactionItem = (transaction: BotTransaction) => (
    <View key={transaction.id} style={styles.card}>
      <View style={styles.cardHeader}>
        <ThemedText style={styles.botName}>{transaction.botName}</ThemedText>
        <ThemedText style={styles.amount}>KES {transaction.amount}</ThemedText>
      </View>
      <View style={styles.cardDetails}>
        <ThemedText style={styles.detail}>User ID: {transaction.userId}</ThemedText>
        <ThemedText style={styles.detail}>Duration: {transaction.duration}</ThemedText>
        <ThemedText style={styles.detail}>Payment: {transaction.paymentMethod}</ThemedText>
        {transaction.referredBy && (
          <ThemedText style={styles.detail}>Referred by: {transaction.referredBy}</ThemedText>
        )}
        <ThemedText style={styles.timestamp}>
          {transaction.timestamp.toDate().toLocaleString()}
        </ThemedText>
      </View>
    </View>
  );

  const renderWithdrawalItem = (request: WithdrawalRequest) => (
    <View key={request.id} style={styles.card}>
      <View style={styles.cardHeader}>
        <ThemedText style={styles.partnerName}>Partner: {request.mpesaName}</ThemedText>
        <ThemedText style={styles.amount}>KES {request.amount}</ThemedText>
      </View>
      <View style={styles.cardDetails}>
        <ThemedText style={styles.detail}>M-Pesa: {request.mpesaNumber}</ThemedText>
        <ThemedText style={styles.detail}>Total Earnings: KES {request.totalEarnings}</ThemedText>
        <ThemedText style={styles.detail}>Pending: KES {request.pendingPayout}</ThemedText>
        <ThemedText style={styles.timestamp}>
          {request.timestamp.toDate().toLocaleString()}
        </ThemedText>
      </View>
      {request.status === 'pending' && (
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.approveButton]}
            onPress={() => handleApproveWithdrawal(request.id)}
          >
            <ThemedText style={styles.buttonText}>Approve</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => handleRejectWithdrawal(request.id)}
          >
            <ThemedText style={styles.buttonText}>Reject</ThemedText>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <ThemedText style={styles.title}>Admin Panel</ThemedText>
          </View>
          <ThemedText style={styles.subtitle}>
            Manage users and monitor platform activity
          </ThemedText>
        </View>

        <View style={styles.tabs}>
          <TouchableOpacity 
            style={[styles.tab, selectedTab === 'transactions' && styles.selectedTab]}
            onPress={() => setSelectedTab('transactions')}
          >
            <ThemedText style={styles.tabText}>Transactions</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, selectedTab === 'withdrawals' && styles.selectedTab]}
            onPress={() => setSelectedTab('withdrawals')}
          >
            <ThemedText style={styles.tabText}>Withdrawals</ThemedText>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {selectedTab === 'transactions' ? (
            transactions.map(renderTransactionItem)
          ) : (
            withdrawalRequests.map(renderWithdrawalItem)
          )}
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
  subtitle: {
    fontSize: 16,
    color: '#666666',
  },
  tabs: {
    flexDirection: 'row',
    marginTop: 100,
    marginBottom: 20,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  selectedTab: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  content: {
    flex: 1,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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
    color: '#1a1a1a',
  },
  partnerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  amount: {
    fontSize: 18,
    fontWeight: '600',
    color: '#059669',
  },
  cardDetails: {
    gap: 4,
  },
  detail: {
    fontSize: 14,
    color: '#64748b',
  },
  timestamp: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  approveButton: {
    backgroundColor: '#059669',
  },
  rejectButton: {
    backgroundColor: '#dc2626',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default AdminScreen; 