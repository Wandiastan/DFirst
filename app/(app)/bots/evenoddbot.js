class EvenOddBot {
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
        this.lastDigits = [];
        this.tradeHistory = [];
        this.onUpdate = null;
        this.lastTradeType = null;
        this.patternWindow = 10;
        this.switchThreshold = 0.6;
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
        this.analyzePatternsAndTrade();
    }

    stop() {
        this.isRunning = false;
        this.unsubscribeFromTicks();
    }

    async subscribeToTicks() {
        try {
            this.ws.send(JSON.stringify({
                ticks: "R_75",
                subscribe: 1
            }));

            this.ws.send(JSON.stringify({
                proposal_open_contract: 1,
                subscribe: 1
            }));

            console.log('Subscribed to R_75 ticks and contract updates');
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

    updateStats(tradeResult) {
        if (tradeResult.win) {
            this.wins++;
            this.consecutiveLosses = 0;
            this.currentStake = this.roundStake(this.config.initialStake);
        } else {
            this.consecutiveLosses++;
            if (this.consecutiveLosses <= 2) {
                this.currentStake = this.roundStake(this.currentStake * this.config.martingaleMultiplier);
            } else {
                this.currentStake = this.roundStake(this.currentStake * (this.config.martingaleMultiplier + 0.1));
            }
        }

        this.totalTrades++;
        this.totalProfit += tradeResult.profit;

        this.tradeHistory.unshift({
            time: new Date(),
            stake: tradeResult.stake,
            result: tradeResult.win ? 'win' : 'loss',
            profit: tradeResult.profit,
            type: this.lastTradeType ? 'EVEN' : 'ODD'
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

    analyzePatternsAndTrade() {
        if (!this.isRunning) return;

        const evenCount = this.lastDigits.filter(d => d % 2 === 0).length;
        const oddCount = this.lastDigits.length - evenCount;
        const evenProbability = evenCount / this.lastDigits.length;

        // Analyze recent pattern strength (last 5 digits)
        const recentPattern = this.lastDigits.slice(0, 5);
        const recentEvenCount = recentPattern.filter(d => d % 2 === 0).length;
        const recentOddCount = recentPattern.length - recentEvenCount;

        // Calculate trend strength
        const trendStrength = Math.abs(evenProbability - 0.5) * 2;
        
        let shouldTradeEven = false;

        if (trendStrength > 0.3) {
            shouldTradeEven = evenProbability <= 0.5;
        } else {
            const recentTrend = recentEvenCount / recentPattern.length;
            shouldTradeEven = recentTrend < 0.5;
        }

        if (this.lastTradeType !== null) {
            if (this.consecutiveLosses === 0) {
                shouldTradeEven = this.lastTradeType;
            } else if (this.consecutiveLosses >= 2) {
                shouldTradeEven = !this.lastTradeType;
            }
        }

        this.lastTradeType = shouldTradeEven;
        
        try {
            this.ws.send(JSON.stringify({
                proposal: 1,
                amount: this.currentStake.toString(),
                basis: "stake",
                contract_type: shouldTradeEven ? "DIGITEVEN" : "DIGITODD",
                currency: "USD",
                duration: 1,
                duration_unit: "t",
                symbol: "R_75"
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

            if (data.msg_type === 'proposal') {
                if (this.isRunning && data.proposal) {
                    console.log('Buying contract with proposal:', data.proposal.id);
                    this.ws.send(JSON.stringify({
                        buy: data.proposal.id,
                        price: data.proposal.ask_price
                    }));
                }
            }
            else if (data.msg_type === 'buy') {
                if (data.buy) {
                    console.log('Contract purchased:', data.buy.contract_id);
                    this.currentContractId = data.buy.contract_id;
                }
            }
            else if (data.msg_type === 'tick') {
                if (data.tick && data.tick.quote) {
                    const digit = parseInt(data.tick.quote.toString().slice(-1));
                    this.lastDigits.unshift(digit);
                    if (this.lastDigits.length > this.patternWindow) {
                        this.lastDigits.pop();
                    }
                    console.log('Current digit:', digit, 'Pattern:', this.lastDigits.slice(0, 5));
                }
            }
            else if (data.msg_type === 'proposal_open_contract') {
                const contract = data.proposal_open_contract;
                if (contract && contract.is_sold) {
                    console.log('Contract result:', contract.status);
                    const profit = parseFloat(contract.profit);
                    const win = profit > 0;

                    this.updateStats({
                        stake: this.currentStake,
                        profit: profit,
                        win: win
                    });

                    setTimeout(() => {
                        if (this.isRunning) {
                            this.analyzePatternsAndTrade();
                        }
                    }, 1000);
                }
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    }
}

// Export the bot class
module.exports = EvenOddBot;
export default EvenOddBot; 