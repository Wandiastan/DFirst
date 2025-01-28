import { StyleSheet, View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/ThemedText';
import { router } from 'expo-router';

interface BotCard {
  name: string;
  description: string;
  symbol: string;
  features: string[];
  file: string;
  color: string;
}

const bots: BotCard[] = [
  {
    name: 'DIFFER Bot',
    description: 'Trades on digit difference patterns with advanced pattern recognition',
    symbol: 'R_25',
    features: ['Pattern Recognition', 'Martingale Strategy', 'Real-time Stats'],
    file: 'DIFFERbot',
    color: '#FF6B6B'
  },
  {
    name: 'Even Bot',
    description: 'Specializes in even number patterns with probability analysis',
    symbol: 'R_10',
    features: ['Even Numbers', 'Pattern Analysis', 'Simple Strategy'],
    file: 'evenbot',
    color: '#4ECDC4'
  },
  {
    name: 'Touch Bot',
    description: 'Advanced technical analysis with multiple indicators',
    symbol: 'R_100',
    features: ['Technical Analysis', 'Multiple Indicators', 'Complex Patterns'],
    file: 'touchbot',
    color: '#45B7D1'
  },
  {
    name: 'Over Bot',
    description: 'Trades on digits over specific barriers with adaptive selection',
    symbol: 'R_10',
    features: ['Adaptive Barriers', 'Pattern Analysis', 'Optimization'],
    file: 'overbot',
    color: '#96CEB4'
  },
  {
    name: 'No Touch Bot',
    description: 'Advanced technical analysis with volatility-based trading',
    symbol: 'R_100',
    features: ['Technical Analysis', 'Volatility Trading', 'Risk Management'],
    file: 'notouchbot',
    color: '#D4A5A5'
  },
  {
    name: 'Odd Bot',
    description: 'Specializes in odd number patterns with probability calculations',
    symbol: 'R_75',
    features: ['Odd Numbers', 'Probability Analysis', 'Simple Strategy'],
    file: 'oddbot',
    color: '#FFD93D'
  },
  {
    name: 'Higher Lower Bot',
    description: 'Price action based trading with multiple timeframe analysis',
    symbol: 'R_10',
    features: ['Price Action', 'Moving Averages', 'Trend Analysis'],
    file: 'higherlowerbot',
    color: '#6C5B7B'
  },
  {
    name: 'Even Odd Bot',
    description: 'Adaptive even/odd trading with pattern switching capability',
    symbol: 'R_75',
    features: ['Pattern Switching', 'Enhanced Martingale', 'Advanced Patterns'],
    file: 'evenoddbot',
    color: '#F67280'
  },
  {
    name: 'Over Under Bot',
    description: 'Dynamic barrier selection with probability-based analysis',
    symbol: 'R_50',
    features: ['Dynamic Barriers', 'Probability Analysis', 'Adaptive Strategy'],
    file: 'overunderbot',
    color: '#355C7D'
  },
  {
    name: 'Rise Fall Bot',
    description: 'Comprehensive technical analysis with multiple indicators',
    symbol: 'R_10',
    features: ['Multiple Indicators', 'Volume Analysis', 'Risk Management'],
    file: 'risefallbot',
    color: '#2A363B'
  },
  {
    name: 'Under Bot',
    description: 'Trades on digits under specific barriers with pattern optimization',
    symbol: 'R_100',
    features: ['Conservative Barriers', 'Pattern Analysis', 'Optimization'],
    file: 'underbot',
    color: '#99B898'
  },
];

function BotCard({ bot }: { bot: BotCard }) {
  return (
    <View style={[styles.card, { borderLeftColor: bot.color }]}>
      <View style={styles.cardHeader}>
        <ThemedText style={styles.botName}>{bot.name}</ThemedText>
        <View style={[styles.symbolTag, { backgroundColor: bot.color }]}>
          <ThemedText style={styles.symbolText}>{bot.symbol}</ThemedText>
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
        style={[styles.viewButton, { backgroundColor: bot.color }]}
        onPress={() => router.push(`/bots/${bot.file}`)}
      >
        <ThemedText style={styles.viewButtonText}>View {bot.name}</ThemedText>
      </TouchableOpacity>
    </View>
  );
}

function TradingScreen() {
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
  viewButton: {
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default TradingScreen; 