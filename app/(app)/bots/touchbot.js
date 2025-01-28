class TouchBot {
    constructor(ws, config) {
        this.ws = ws;
        this.config = config;
        this.isRunning = false;
        this.currentStake = config.initialStake;
        this.totalProfit = 0;
        this.totalTrades = 0;
        this.wins = 0;
        this.consecutiveLosses = 0;
        this.startTime = null;
        this.tradeHistory = [];
        this.onUpdate = null;
        this.priceHistory = [];
        this.trendWindow = 15;
        this.hasOpenContract = false;
        this.currentContractType = null;
        this.lastPrice = null;
        this.lastTradeTime = null;
        this.minTradeInterval = 1000;
        this.movingAverages = {
            short: 5,
            medium: 10,
            long: 15
        };
    }

    setUpdateCallback(callback) {
        this.onUpdate = callback;
    }

    roundStake(value) {
        return Math.round(value * 100) / 100;
    }

    async start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.startTime = new Date();
        this.currentStake = this.config.initialStake;
        await this.subscribeToTicks();
        this.executeTrade();
    }

    stop() {
        this.isRunning = false;
        this.unsubscribeFromTicks();
        this.hasOpenContract = false;
    }

    async subscribeToTicks() {
        try {
            this.ws.send(JSON.stringify({
                ticks: "R_100",
                subscribe: 1
            }));

            this.ws.send(JSON.stringify({
                proposal_open_contract: 1,
                subscribe: 1
            }));

            console.log('Subscribed to R_100 ticks and contract updates');
        } catch (error) {
            console.error('Error subscribing:', error);
        }
    }

    unsubscribeFromTicks() {
        this.ws.send(JSON.stringify({
            forget_all: ["ticks", "proposal_open_contract"]
        }));
    }

    updateStats(tradeResult) {
        if (tradeResult.win) {
            this.wins++;
            this.consecutiveLosses = 0;
            this.currentStake = this.roundStake(this.config.initialStake);
        } else {
            this.consecutiveLosses++;
            this.currentStake = this.roundStake(this.currentStake * this.config.martingaleMultiplier);
        }

        this.totalTrades++;
        this.totalProfit = this.roundStake(this.totalProfit + tradeResult.profit);

        this.tradeHistory.unshift({
            time: new Date(),
            stake: tradeResult.stake,
            result: tradeResult.win ? 'win' : 'loss',
            profit: tradeResult.profit,
            type: tradeResult.type
        });

        if (this.tradeHistory.length > 50) {
            this.tradeHistory.pop();
        }

        if (this.onUpdate) {
            this.onUpdate({
                currentStake: this.currentStake,
                totalProfit: this.totalProfit,
                totalTrades: this.totalTrades,
                winRate: (this.wins / this.totalTrades * 100).toFixed(2),
                consecutiveLosses: this.consecutiveLosses,
                runningTime: this.getRunningTime(),
                tradeHistory: this.tradeHistory,
                progressToTarget: (this.totalProfit / this.config.takeProfit * 100).toFixed(2)
            });
        }

        if (this.totalProfit <= -this.config.stopLoss || this.totalProfit >= this.config.takeProfit) {
            this.stop();
        }
    }

    getRunningTime() {
        if (!this.startTime) return '00:00:00';
        const diff = Math.floor((new Date() - this.startTime) / 1000);
        const hours = Math.floor(diff / 3600).toString().padStart(2, '0');
        const minutes = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
        const seconds = (diff % 60).toString().padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }

    calculateMA(prices, period) {
        if (prices.length < period) return null;
        return prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;
    }

    calculateRSI(prices, period = 5) {
        if (prices.length < period + 1) return null;
        
        let gains = 0;
        let losses = 0;
        
        for (let i = 0; i < period; i++) {
            const difference = prices[i] - prices[i + 1];
            if (difference >= 0) {
                gains += difference;
            } else {
                losses -= difference;
            }
        }
        
        const avgGain = gains / period;
        const avgLoss = losses / period;
        
        if (avgLoss === 0) return 100;
        
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    calculateVolatility(prices) {
        const ma = this.calculateMA(prices, prices.length);
        if (!ma) return 0;
        const variance = prices.reduce((sum, price) => sum + Math.pow(price - ma, 2), 0) / prices.length;
        return Math.sqrt(variance);
    }

    calculateTrend(prices) {
        if (prices.length < 3) return 0;
        
        const recentPrices = prices.slice(0, 3);
        let trend = 0;
        
        for (let i = 0; i < recentPrices.length - 1; i++) {
            if (recentPrices[i] > recentPrices[i + 1]) trend++;
            else if (recentPrices[i] < recentPrices[i + 1]) trend--;
        }
        
        return trend;
    }

    calculateMomentum(prices, period = 5) {
        if (prices.length < period) return 0;
        return ((prices[0] - prices[period - 1]) / prices[period - 1]) * 100;
    }

    analyzeMarket() {
        if (this.priceHistory.length < this.trendWindow) {
            console.log('Not enough price history yet...');
            return null;
        }

        const prices = this.priceHistory.slice(0, this.trendWindow);
        
        const shortMA = this.calculateMA(prices, this.movingAverages.short);
        const mediumMA = this.calculateMA(prices, this.movingAverages.medium);
        const longMA = this.calculateMA(prices, this.movingAverages.long);
        const rsi = this.calculateRSI(prices);
        const volatility = this.calculateVolatility(prices.slice(0, 5));
        const trend = this.calculateTrend(prices);
        const momentum = this.calculateMomentum(prices);

        if (!shortMA || !mediumMA || !longMA || !rsi) {
            return null;
        }

        const currentPrice = prices[0];
        const priceChange = Math.abs(currentPrice - prices[1]);

        console.log(`Analysis - Price: ${currentPrice}, Change: ${priceChange}, RSI: ${rsi}, Volatility: ${volatility}`);
        console.log(`MAs - Short: ${shortMA}, Medium: ${mediumMA}, Long: ${longMA}`);
        console.log(`Indicators - Trend: ${trend}, Momentum: ${momentum}`);

        let upTrendStrength = 0;
        let downTrendStrength = 0;

        // Moving average alignment
        if (shortMA > mediumMA && mediumMA > longMA) upTrendStrength++;
        if (shortMA < mediumMA && mediumMA < longMA) downTrendStrength++;

        // RSI conditions
        if (rsi > 60) upTrendStrength++;
        if (rsi < 40) downTrendStrength++;

        // Trend direction
        if (trend > 0) upTrendStrength++;
        if (trend < 0) downTrendStrength++;

        // Momentum
        if (momentum > 0.1) upTrendStrength++;
        if (momentum < -0.1) downTrendStrength++;

        // Price change confirmation
        if (priceChange > 0.002) {
            if (currentPrice > prices[1]) upTrendStrength++;
            if (currentPrice < prices[1]) downTrendStrength++;
        }

        let signal = null;

        // Generate signal with fixed barriers
        if (upTrendStrength >= 4 && volatility >= 0.001) {
            signal = {
                type: "ONETOUCH",
                barrier: "+0.63"
            };
            console.log('Generated UP signal with strength:', upTrendStrength);
        } else if (downTrendStrength >= 4 && volatility >= 0.001) {
            signal = {
                type: "ONETOUCH",
                barrier: "-0.63"
            };
            console.log('Generated DOWN signal with strength:', downTrendStrength);
        }

        if (signal) {
            console.log('Trade signal generated:', JSON.stringify(signal));
        }

        return signal;
    }

    async executeTrade() {
        if (!this.isRunning) {
            setTimeout(() => this.executeTrade(), 100);
            return;
        }

        if (this.hasOpenContract) {
            setTimeout(() => this.executeTrade(), 100);
            return;
        }

        const now = Date.now();
        if (this.lastTradeTime && (now - this.lastTradeTime) < this.minTradeInterval) {
            setTimeout(() => this.executeTrade(), 100);
            return;
        }

        const signal = this.analyzeMarket();
        if (!signal) {
            setTimeout(() => this.executeTrade(), 100);
            return;
        }

        this.currentContractType = signal.type;
        this.lastTradeTime = now;

        try {
            const proposal = {
                proposal: 1,
                amount: this.currentStake.toString(),
                basis: "stake",
                contract_type: signal.type,
                currency: "USD",
                duration: 5,
                duration_unit: "t",
                symbol: "R_100",
                barrier: signal.barrier
            };

            console.log('Sending proposal:', JSON.stringify(proposal));
            this.ws.send(JSON.stringify(proposal));
        } catch (error) {
            console.error('Trade execution error:', error);
            this.hasOpenContract = false;
            this.lastTradeTime = null;
            setTimeout(() => this.executeTrade(), 100);
        }
    }

    handleMessage(message) {
        try {
            const data = JSON.parse(typeof message === 'string' ? message : message.toString());
            
            if (data.error) {
                if (data.error.code === 'ContractBuyValidationError') {
                    this.hasOpenContract = false;
                    this.lastTradeTime = null;
                }
                return;
            }

            if (data.msg_type === 'tick') {
                if (data.tick && data.tick.quote) {
                    const price = parseFloat(data.tick.quote);
                    this.lastPrice = price;
                    
                    this.priceHistory.unshift(price);
                    if (this.priceHistory.length > this.trendWindow) {
                        this.priceHistory.pop();
                    }
                }
            }
            else if (data.msg_type === 'proposal') {
                if (this.isRunning && data.proposal && !this.hasOpenContract) {
                    this.ws.send(JSON.stringify({
                        buy: data.proposal.id,
                        price: data.proposal.ask_price
                    }));
                }
            }
            else if (data.msg_type === 'buy') {
                if (data.buy) {
                    this.hasOpenContract = true;
                }
            }
            else if (data.msg_type === 'proposal_open_contract') {
                const contract = data.proposal_open_contract;
                if (contract && contract.is_sold) {
                    const profit = parseFloat(contract.profit);
                    
                    this.updateStats({
                        stake: this.currentStake,
                        profit: profit,
                        win: profit > 0,
                        type: this.currentContractType
                    });

                    this.hasOpenContract = false;
                    this.executeTrade();
                }
            }
        } catch (error) {
            console.error('Error handling message:', error);
            this.hasOpenContract = false;
            this.lastTradeTime = null;
            setTimeout(() => this.executeTrade(), 100);
        }
    }
}

// Make TouchBot available globally
window.TouchBot = TouchBot;
export default TouchBot; 