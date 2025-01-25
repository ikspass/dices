const { sha3_256 } = require('js-sha3');
const crypto = require('crypto');
const readline = require('readline');

function removeElement(arr, index) {
    if (index < 0 || index >= arr.length) {
        return arr;
    }
    return arr.filter((_, i) => i !== index);
}

class Dice {
    constructor(values) {
        this.values = values;
    }

    roll(index) {
        return this.values[index];
    }
    getSides(){
        return this.values.length;
    }
    getValues(){
        return this.values;
    }
}

class RandomGenerator {
    static generateSecureRandomKey(lengthInBytes) {
        return crypto.randomBytes(lengthInBytes).toString('hex');
    }

    static getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min)) + min;
    }
}

class HMACGenerator {
    static generateHMAC(value, key) {
        return sha3_256(value.toString() + key.toString());
    }
}

class DiceProbability {
    constructor(dices) {
        this.dices = dices;
    }

    calculateWinningProbabilities() {
        const probabilities = {};

        for (let i = 0; i < this.dices.length; i++) {
            for (let j = 0; j < this.dices.length; j++) {
                if (i !== j) {
                    const winProbability = this.calculatePairProbability(this.dices[i], this.dices[j]);
                    probabilities[`[${this.dices[i].getValues()}] vs [${this.dices[j].getValues()}]`] = winProbability;
                }
            }
        }

        return probabilities;
    }

    calculatePairProbability(diceA, diceB) {
        const totalOutcomes = diceA.getSides() * diceB.getSides();
        let winsA = 0;

        for (let a of diceA.getValues()) {
            for (let b of diceB.getValues()) {
                if (a > b) {
                    winsA++;
                }
            }
        }

        return (winsA / totalOutcomes).toFixed(2);
    }
}

class ProbabilityTable {
    static displayTable(probabilities) {
        console.log("\nProbabilities of winning for each pair of dice:");
        console.log("+--------------------------------+-------------+");
        console.log("| A pair of dices                | Probability |");
        console.log("+--------------------------------+-------------+");

        for (const [pair, probability] of Object.entries(probabilities)) {
            console.log(`| ${pair.padEnd(12)} | ${probability}        |`);
        }
        console.log("+--------------------------------+-------------+");
    }
}

class UserInput {
    static rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    static askQuestion() {
        return new Promise(resolve => {
            this.rl.question('Your selection: ', answer => {
                resolve(answer);
            });
        });
    }

    static close() {
        this.rl.close();
    }
}

class Menu {
    async numberChoice(max, game){
        for(let i = 0; i < max; i++){
            console.log(i + ' - ' + i);
        }
        console.log('X - exit\n? - help');
        const userChoice = await UserInput.askQuestion();
        switch (userChoice) {
            case '?':
                await game.showHelp();
                return this.numberChoice(max, game);
            case 'x':
            case 'X':
                process.exit();
                break;
            default:
                const index = parseFloat(userChoice);
                if (Number.isInteger(index) && index >= 0 && index < max) {
                    return index;
                }
                else {
                    console.log('Invalid input. Please try again.');
                    return this.numberChoice(max, game);
                }
        }
    }
    async diceChoice(arr, game) {
        arr.forEach((elem, i) => {
            console.log(i + ' - ' + elem.getValues());
        });
        console.log('X - exit\n? - help');
        const userChoice = await UserInput.askQuestion();
        switch (userChoice) {
            case '?':
                await game.showHelp();
                return this.diceChoice(arr, game);
            case 'x':
            case 'X':
                process.exit();
                break;
            default:
                const index = parseFloat(userChoice);
                if (Number.isInteger(index) && index >= 0 && index < arr.length) {
                    return index
                }                
                else {
                    console.log('Недопустимый ввод. Попробуйте снова.');
                    return this.diceChoice(arr, game);
                }
        }
    }
}

class Game {
    constructor() {
        this.dices = [];
        const inputDices = process.argv.slice(2);
        if (inputDices.length <= 2) {
            console.log('The minimum number of dices is 3, for example: 1,2,3,4,5,6 1,2,3,4,5,6 1,2,3,4,5,6');
            process.exit();
        }
        inputDices.forEach((item) => {
            const diceValues = item.split(',').map(Number);
            if (diceValues.some(value => !Number.isInteger(value))) {
                console.log(`All dice values ​​must be integers, for example: 1,2,3,4,5,6.`);
                process.exit();
            }
            if (diceValues.length < 2) {
                console.log(`Each dice must have at least 2 values, for example: 1,2.`);
                process.exit();
            }
            this.dices.push(new Dice(diceValues));
        });
        const firstLength = this.dices[0].values.length;
        if (!this.dices.every(dice => dice.values.length === firstLength)) {
            console.log('All dices must have the same number of elements, for example: 1,2,3 1,2,3 1,2,3');
            process.exit();
        }
        this.sides = this.dices[0].getSides();
        this.dicesCount = this.dices.length;
        this.compDice = null
        this.userDice = null
        this.menu = new Menu();
    }

    async showHelp() {
        const probabilities = new DiceProbability(this.dices).calculateWinningProbabilities();
        ProbabilityTable.displayTable(probabilities);
    }

    async generateCompNumber(max){
        const number = RandomGenerator.getRandomInt(0, max);
        const key = RandomGenerator.generateSecureRandomKey(32)
        return {
            key: key,
            number: number,
            hash: HMACGenerator.generateHMAC(number, key)
        }
    }

    async start() {
        const compNumber = await this.generateCompNumber(2);
        console.log(`Let's determine who makes the first move.\nI selected a random value in the range 0..1\n(HMAC = ${compNumber.hash})\nTry to guess my selection`);
        const userNumber = await this.menu.numberChoice(2, this);
        console.log(`My selection: ${compNumber.number}\n(KEY = ${compNumber.key})`)
        userNumber == compNumber.number ? this.userFirstDiceSelection() : this.compFirstDiceSelection()
    }

    async makeThrow(dice){
        const compNumber = await this.generateCompNumber(this.sides);
        console.log(`I selected a random value in the range 0..${this.sides - 1}.\n(HMAC = ${compNumber.hash}).\nAdd your number modulo ${this.sides}.`);
        const userNumber = await this.menu.numberChoice(this.sides, this);
        const result = (compNumber.number + userNumber) % dice.getSides();
        const diceThrow = dice.roll(result);
        console.log(`My number is ${compNumber.number}\n(KEY = ${compNumber.key})\nThe result is ${compNumber.number} + ${userNumber} = ${result} (mod 6).`);
        return diceThrow;      
    }

    async compFirstDiceSelection(){
        const compDiceIndex = RandomGenerator.getRandomInt(0, this.dicesCount);
        this.compDice = this.dices[compDiceIndex];
        const restDices = removeElement(this.dices, compDiceIndex);
        console.log(`I make the first move and choose the [${this.compDice.getValues()}] dice.\nChoose your dice.`);
        const userChoice = await this.menu.diceChoice(restDices, this);
        this.userDice = restDices[+userChoice];
        console.log(`You choose the [${this.userDice.getValues()}] dice.`);
        this.finish();
    }

    async userFirstDiceSelection(){
        console.log(`You make the first move.\nChoose your dice.`)
        const userDiceIndex = await this.menu.diceChoice(this.dices, this);
        this.userDice = this.dices[userDiceIndex];
        const restDices = removeElement(this.dices, +userDiceIndex);
        const compDiceIndex = RandomGenerator.getRandomInt(0, restDices.length);
        this.compDice = this.dices[compDiceIndex];
        console.log(`You choose the [${this.userDice.getValues()}] dice.\nMy dice: [${this.compDice.getValues()}]`);
        this.finish();
    }
    async finish(){
        console.log(`It's time for my throw`)
        const compThrow = await this.makeThrow(this.compDice);
        console.log(`My throw is ${compThrow}.\nIt's time for your throw`);
        const userThrow = await this.makeThrow(this.userDice);
        console.log(`Your throw is ${userThrow}.`);
        if(userThrow > compThrow){
            console.log(`You win (${userThrow} > ${compThrow})`);
        }
        else if(userThrow < compThrow){
            console.log(`I win (${userThrow} < ${compThrow})`);
        }
        else {
            console.log(`It's a draw (${userThrow} = ${compThrow})`)
        }
        process.exit();
    }
}

const game = new Game();
game.start();