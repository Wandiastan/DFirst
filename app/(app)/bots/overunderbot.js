class OverUnderBot {
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
        this.lastDigit = null;
        this.tradeHistory = [];
        this.onUpdate = null;
        this.digitHistory = [];
        this.currentBarrier = 4;
        this.currentContractType = 'DIGITOVER';
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
                ticks: "R_50",
                subscribe: 1
            }));

            this.ws.send(JSON.stringify({
                proposal_open_contract: 1,
                subscribe: 1
            }));

            console.log('Subscribed to R_50 ticks and contract updates');
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
            this.currentStake = this.roundStake(this.currentStake * this.config.martingaleMultiplier);
        }

        this.totalTrades++;
        this.totalProfit += tradeResult.profit;

        this.tradeHistory.unshift({
            time: new Date(),
            stake: tradeResult.stake,
            result: tradeResult.win ? 'win' : 'loss',
            profit: tradeResult.profit
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

    analyzePattern() {
        if (this.digitHistory.length < 10) return { type: 'DIGITOVER', barrier: 4 };

        // Count occurrences of digits
        const counts = Array(10).fill(0);
        this.digitHistory.forEach(digit => counts[digit]++);

        // Calculate probabilities for different ranges
        const under3 = counts.slice(0, 3).reduce((a, b) => a + b, 0) / this.digitHistory.length;
        const under4 = counts.slice(0, 4).reduce((a, b) => a + b, 0) / this.digitHistory.length;
        const under5 = counts.slice(0, 5).reduce((a, b) => a + b, 0) / this.digitHistory.length;
        const under6 = counts.slice(0, 6).reduce((a, b) => a + b, 0) / this.digitHistory.length;

        const over3 = 1 - under3;
        const over4 = 1 - under4;
        const over5 = 1 - under5;
        const over6 = 1 - under6;

        // Find the strongest signal
        const signals = [
            { type: 'DIGITUNDER', barrier: 3, prob: under3 },
            { type: 'DIGITUNDER', barrier: 4, prob: under4 },
            { type: 'DIGITUNDER', barrier: 5, prob: under5 },
            { type: 'DIGITUNDER', barrier: 6, prob: under6 },
            { type: 'DIGITOVER', barrier: 3, prob: over3 },
            { type: 'DIGITOVER', barrier: 4, prob: over4 },
            { type: 'DIGITOVER', barrier: 5, prob: over5 },
            { type: 'DIGITOVER', barrier: 6, prob: over6 }
        ];

        // Sort by probability and get the strongest signal
        signals.sort((a, b) => b.prob - a.prob);
        const bestSignal = signals[0];

        // Only switch if the probability is significantly better
        if (bestSignal.prob > 0.6) {
            return bestSignal;
        }

        // If no strong signal, maintain current direction but adjust barrier
        return {
            type: this.currentContractType,
            barrier: this.currentBarrier
        };
    }

    async executeTrade() {
        if (!this.isRunning) return;

        const signal = this.analyzePattern();
        this.currentContractType = signal.type;
        this.currentBarrier = signal.barrier;

        try {
            this.ws.send(JSON.stringify({
                proposal: 1,
                amount: this.currentStake.toString(),
                basis: "stake",
                contract_type: this.currentContractType,
                currency: "USD",
                duration: 1,
                duration_unit: "t",
                symbol: "R_50",
                barrier: this.currentBarrier.toString()
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
                    this.lastDigit = digit;
                    
                    this.digitHistory.unshift(digit);
                    if (this.digitHistory.length > 10) {
                        this.digitHistory.pop();
                    }
                    
                    console.log('Current digit:', digit, 'Signal:', this.currentContractType, 'Barrier:', this.currentBarrier);
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

// Export the bot class
module.exports = OverUnderBot;
export default OverUnderBot; 