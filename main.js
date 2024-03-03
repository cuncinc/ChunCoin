const sha256 = require('crypto-js/sha256');
const ecLib = require('elliptic').ec;
const ec = new ecLib('secp256k1');
const fs = require('fs');

class Transaction {
  constructor(from, to, amount) {
    this.from = from;
    this.to = to;
    this.amount = amount;
    this.signature = '';
  }

  calculateHash() {
    return sha256(this.from + this.to + this.amount).toString();
  }

  sign(keyPair) {
    if (keyPair.getPublic('hex') !== this.from) {
      throw new Error('You cannot sign transactions for other wallets!');
    }
    let hashTx = this.calculateHash();
    this.signature = keyPair.sign(hashTx, 'base64').toDER('hex');
  }

  //验证交易是否有效
  isValid() {
    if (this.from === null) return true;
    if (!this.signature || this.signature.length === 0) {
      throw new Error('No signature in this transaction');
    }
    const publicKey = ec.keyFromPublic(this.from, 'hex');
    return publicKey.verify(this.calculateHash(), this.signature);
  }

  toString() {
    return JSON.stringify(this);
  }
}


class Block {
  constructor(data, previousBlockHash) {
    this.data = data;
    this.nonce = 1;
    this.timestamp = Date.now();
    this.previousBlockHash = previousBlockHash;
    this.hash = this.calculateHash();
  }

  calculateHash() {
    return sha256(this.data + this.nonce + this.timestamp + this.previousBlockHash).toString();
  }

  mineBlock(difficulty) {
    while (this.hash.substring(0, difficulty) !== Array(difficulty + 1).join("0")) {
      this.nonce++;
      this.hash = this.calculateHash();
    }
    console.log('Block mined:', this.nonce, this.hash);
  }

  //验证交易是否有效
  isTransactionsValid() {
    let data = JSON.parse(this.data);
    for (let tran of data) {
      //判断tran是否是Transaction的实例
      if (!(tran instanceof Transaction)) {
        continue;
      }
      if (!tran.isValid()) {
        return false;
      }
    }
    return true;
  }

  isBlockValid(previousBlock) {
    if (this.hash !== this.calculateHash()) {
      return false;
    }
    if (this.previousBlockHash !== previousBlock.hash) {
      return false;
    }
    if (!this.isTransactionsValid()) {
      return false;
    }
    return true;
  }
}


class Blockchain {
  constructor() {
    this.chain = [this.createGenesisBlock()];
    this.pendingTransactions = [];
    this.miningReward = 50;
    this.difficulty = 4;
  }

  createGenesisBlock() {
    return new Block("Genesis Block", "");
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  submitBlock(block) {
    this.chain.push(block);
  }

  isChainValid() {
    for (let i = this.chain.length - 1; i > 0; --i) {
      let currentBlock = this.chain[i];
      let previousBlock = this.chain[i - 1];
      if (!currentBlock.isBlockValid(previousBlock)) {
        return false;
      }
    }
    return true;
  }

  mine(minerAddress) {
    if (this.pendingTransactions.length === 0) {
      console.log('Mine info: oo transactions to mine');
      return;
    }
    //矿工奖励
    this.submitTransaction(new Transaction(null, minerAddress, this.miningReward));
    //交易验证
    for (let tran of this.pendingTransactions) {
      if (!tran.isValid()) {
        console.log('Invalid transaction');
        return;
      }
    }
    //打包交易
    let data = JSON.stringify(this.pendingTransactions);
    let newBlock = new Block(data, this.getLatestBlock().hash);
    //挖矿
    newBlock.mineBlock(this.difficulty);
    //添加到链上
    this.submitBlock(newBlock);
    //清空交易池，应该放在挖矿之后
    this.pendingTransactions = [];
  }

  balanceOfAddress(address) {
    let balance = 0;
    //排除创世区块，遍历区块链
    for (let i = 1; i < this.chain.length; ++i) {
      let block = this.chain[i];
      let data = JSON.parse(block.data);
      for (let tran of data) {
        if (tran.from === address) {
          balance -= tran.amount;
        }
        if (tran.to === address) {
          balance += tran.amount;
        }
      }
    }
    return balance;
  }

  submitTransaction(tran) {
    this.pendingTransactions.push(tran);
  }
}


class Wallet {
  sendMoney(amount, to) {
    const tran = new Transaction(this.address, to, amount);
    tran.sign(this.keyPair);
    return tran;
  }

  saveWallet2File(filename) {
    let wallet = JSON.stringify(this.keyPair);
    fs.writeFileSync(filename, wallet);
  }

  static generateWallet() {
    const keyPair = ec.genKeyPair();
    const wallet = new Wallet();
    wallet.keyPair = keyPair;
    wallet.address = keyPair.getPublic('hex');
    console.log('New address:', wallet.address);
    return wallet;
  }

  static loadFromFile(filename) {
    let wallet = new Wallet();
    let content = fs.readFileSync(filename);
    wallet.keyPair = ec.keyFromPrivate(JSON.parse(content).priv, 'hex');
    wallet.address = wallet.keyPair.getPublic('hex');
    return wallet;
  }
}


function main() {
  const chunCoin = new Blockchain();

  // let wallet = Wallet.generateWallet();
  // wallet.saveWallet2File('wallet/test.wallet');

  const miner = Wallet.loadFromFile('wallet/miner.wallet');
  const alice = Wallet.loadFromFile('wallet/alice.wallet');
  const bob = Wallet.loadFromFile('wallet/bob.wallet');

  tran1 = alice.sendMoney(100, bob.address);
  tran2 = bob.sendMoney(200, alice.address);

  chunCoin.submitTransaction(tran1);
  chunCoin.submitTransaction(tran2);
  chunCoin.mine(miner.address);

  chunCoin.mine(miner.address);

  // console.log("Is chain valid? " + chunCoin.isChainValid());
  // console.log("Is block_1 valid? " + chunCoin.chain[1].isTransactionsValid());
  // console.log("balance of alice: " + chunCoin.balanceOfAddress(alice.address));
  // console.log(chunCoin.chain);
}

main();