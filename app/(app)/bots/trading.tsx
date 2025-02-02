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

function BotCard({ bot }: { bot: BotCard }) {
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