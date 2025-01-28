class HigherLowerBot {
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
        this.currentContractType = null;
        this.hasOpenContract = false;
        this.lastPrice = null;
        this.trendWindow = 10; // Window size for trend analysis
        this.priceMovements = []; // Track recent price movements
        this.movingAverages = []; // Store moving averages for analysis
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
    }

    async subscribeToTicks() {
        try {
            this.ws.send(JSON.stringify({
                ticks: "R_10",
                subscribe: 1
            }));

            this.ws.send(JSON.stringify({
                proposal_open_contract: 1,
                subscribe: 1
            }));

            console.log('Subscribed to ticks and contract updates');
        } catch (error) {
            console.error('Error subscribing:', error);
        }
    }

    unsubscribeFromTicks() {
        const request = {
            forget_all: ["ticks"]
        };
        this.ws.send(JSON.stringify(request));
    }

    getRunningTime() {
        if (!this.startTime) return '00:00:00';
        const diff = Math.floor((new Date() - this.startTime) / 1000);
        const hours = Math.floor(diff / 3600).toString().padStart(2, '0');
        const minutes = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
        const seconds = (diff % 60).toString().padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
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
        this.totalProfit += tradeResult.profit;

        this.tradeHistory.unshift({
            time: new Date(),
            stake: tradeResult.stake,
            result: tradeResult.win ? 'win' : 'loss',
            profit: tradeResult.profit,
            type: this.currentContractType
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

    calculateMA(prices, period) {
        if (prices.length < period) return null;
        const sum = prices.slice(0, period).reduce((a, b) => a + b, 0);
        return sum / period;
    }

    analyzeMarket() {
        if (this.priceHistory.length < this.trendWindow) {
            return null;
        }

        // Calculate short and long term moving averages
        const shortMA = this.calculateMA(this.priceHistory, 5);
        const longMA = this.calculateMA(this.priceHistory, 10);

        if (!shortMA || !longMA) {
            return null;
        }

        // Store moving averages for trend analysis
        this.movingAverages.unshift({ short: shortMA, long: longMA });
        if (this.movingAverages.length > 3) {
            this.movingAverages.pop();
        }

        // Calculate price momentum
        const momentum = this.priceHistory[0] - this.priceHistory[5];
        
        // Calculate price volatility
        const volatility = Math.std(this.priceHistory.slice(0, 10));

        // Determine trend direction
        let signal = null;
        
        if (shortMA > longMA && momentum > 0) {
            signal = 'CALL';
            this.currentBarrier = '+0.1'; // Required barrier for higher
        } else if (shortMA < longMA && momentum < 0) {
            signal = 'PUT';
            this.currentBarrier = '-0.1'; // Required barrier for lower
        }

        // Add additional confirmation based on volatility
        if (signal && volatility < 0.5) {
            return signal;
        }

        return null;
    }

    async executeTrade() {
        if (!this.isRunning || this.hasOpenContract) return;

        const signal = this.analyzeMarket();
        if (!signal) {
            setTimeout(() => this.executeTrade(), 1000);
            return;
        }

        this.currentContractType = signal;

        try {
            this.ws.send(JSON.stringify({
                proposal: 1,
                amount: this.currentStake.toString(),
                basis: "stake",
                contract_type: signal,
                currency: "USD",
                duration: 5,
                duration_unit: "t",
                symbol: "R_10",
                barrier: this.currentBarrier // Using +0.1 for higher and -0.1 for lower
            }));
        } catch (error) {
            console.error('Trade execution error:', error);
            this.stop();
        }
    }

    handleMessage(message) {
        try {
            const data = JSON.parse(typeof message === 'string' ? message : message.toString());
            console.log('Received message:', data.msg_type);

            if (data.msg_type === 'tick') {
                if (data.tick && data.tick.quote) {
                    const price = data.tick.quote;
                    this.priceHistory.unshift(price);
                    if (this.priceHistory.length > this.trendWindow) {
                        this.priceHistory.pop();
                    }
                    this.lastPrice = price;
                }
            }
            else if (data.msg_type === 'proposal') {
                if (this.isRunning && data.proposal && !this.hasOpenContract) {
                    console.log('Buying contract with proposal:', data.proposal.id);
                    this.ws.send(JSON.stringify({
                        buy: data.proposal.id,
                        price: data.proposal.ask_price
                    }));
                    this.hasOpenContract = true;
                }
            }
            else if (data.msg_type === 'buy') {
                if (data.buy) {
                    console.log('Contract purchased:', data.buy.contract_id);
                }
            }
            else if (data.msg_type === 'proposal_open_contract') {
                const contract = data.proposal_open_contract;
                if (contract && contract.is_sold) {
                    console.log('Contract result:', contract.status);
                    const profit = parseFloat(contract.profit);
                    
                    this.updateStats({
                        stake: this.currentStake,
                        profit: profit,
                        win: profit > 0,
                        type: this.currentContractType
                    });

                    this.hasOpenContract = false;
                    
                    setTimeout(() => {
                        if (this.isRunning) {
                            this.executeTrade();
                        }
                    }, 1000);
                }
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    }
}

// Helper function to calculate standard deviation
Math.std = function(array) {
    const n = array.length;
    const mean = array.reduce((a, b) => a + b) / n;
    return Math.sqrt(array.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n);
};

// Export the bot class
module.exports = HigherLowerBot;
export default HigherLowerBot; 