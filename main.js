const sha256 = require('crypto-js/sha256');
const ecLib = require('elliptic').ec;
const ec = new ecLib('secp256k1');
const fs = require('fs');
const WebSocket = require('ws');


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

class Transaction {
  constructor(from, to, amount) {
    this.from = from;
    this.to = to;
    this.amount = amount;
    this.timestamp = Date.now();
    this.signature = '';
  }

  calculateHash() {
    return sha256(this.from + this.to + this.amount + this.timestamp).toString();
  }

  sign(keyPair) {
    if (keyPair.getPublic('hex') !== this.from) {
      throw new Error('You cannot sign transactions for other wallets!');
    }
    let hashTx = this.calculateHash();
    this.signature = keyPair.sign(hashTx, 'base64').toDER('hex');
  }

  //验证交易是否有效
  isTransactionValid() {
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
  constructor(data, previousBlock) {
    this.data = data;
    this.nonce = 1;
    this.height = previousBlock ? previousBlock.height + 1 : 0;
    this.timestamp = Date.now();
    this.previousBlockHash = previousBlock ? previousBlock.hash : '';
    this.hash = this.calculateHash();
  }

  calculateHash() {
    return sha256(this.data + this.nonce + this.height + this.timestamp + this.previousBlockHash).toString();
  }

  mineBlock(difficulty) {
    while (this.hash.substring(0, difficulty) !== Array(difficulty + 1).join("0")) {
      this.nonce++;
      this.hash = this.calculateHash();
    }
    console.log('Block mined:', this.height, this.nonce, this.hash);
  }

  //验证交易是否有效
  isTransactionsValid() {
    let data = JSON.parse(this.data);
    for (let tran of data) {
      //判断tran是否是Transaction的实例
      if (!(tran instanceof Transaction)) {
        continue;
      }
      if (!tran.isTransactionValid()) {
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
    this.ws = null;
    this.wsInit();
  }

  wsInit() {
    this.ws = new WebSocket('ws://localhost:53000');
    this.ws.on('message', message => {
      let msg = JSON.parse(message);
      let type = msg.type;
      console.log('WS message:', type);
      if (type === 'new_block') {
        let block = Object.assign(new Block(), msg.data);
        if (block.isBlockValid(this.getLatestBlock())) {
          this.chain.push(block);
          //清除已经被打包的交易
          this.pendingTransactions = this.pendingTransactions.filter(tran => !block.data.includes(tran));
        }
      }
      else if (type === 'new_transaction') {
        let tran = Object.assign(new Transaction(), msg.data);
        if (tran.isTransactionValid()) {
          this.pendingTransactions.push(tran);
        }
      }
      else if (type === 'max_height_rsp') {
        console.log('max_height_rsp:', msg.data);
      }
      else if (type === 'node_sync_rsp') {
        console.log('node_sync_rsp');
        let blocks = msg.data;
        let localHeight = this.getLatestBlock().height;

        if (localHeight === 0) { //本地只有创世区块，覆盖之
          this.chain = [blocks[0]];
        }

        for (let b of blocks) {
          let block = Object.assign(new Block(), b);
          // if (block.isBlockValid(this.getLatestBlock())) {
          this.chain.push(block);
          //清除已经被打包的交易
          // this.pendingTransactions = this.pendingTransactions.filter(tran => !block.data.includes(tran));
          console.log('Sync block:', this.getLatestBlock().height);
          // }
        }
      }
    });
  }

  syncChain() {
    let message = { type: 'node_sync', data: this.getLatestBlock().height }
    this.ws.send(JSON.stringify(message));
  }

  createGenesisBlock() {
    return new Block("Genesis Block", null);
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  submitTransaction(tran) {
    this.pendingTransactions.push(tran);
    let msg = { type: 'new_transaction', data: tran };
    this.ws.send(JSON.stringify(msg));
  }

  submitBlock(block) {
    this.chain.push(block);
    let msg = { type: 'new_block', data: block };
    this.ws.send(JSON.stringify(msg));
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

  async mine(minerAddress) {

    //被阻塞
    while (true) {
      // 创建一个Promise以便异步执行
      await new Promise((resolve) => {
        setTimeout(() => {
          resolve();
        }); // 设置一个适当的延迟，以避免过度消耗CPU资源
      });


      // if (this.pendingTransactions.length === 0) {
      //   console.log('Mine info: no transactions to mine');
      //   continue;
      // }
      //矿工奖励
      this.pendingTransactions.push(new Transaction(null, minerAddress, this.miningReward));
      //交易验证
      for (let tran of this.pendingTransactions) {
        if (!tran.isTransactionValid()) {
          console.log('Invalid transaction');
          //remove this transaction
          this.pendingTransactions = this.pendingTransactions.filter(t => t !== tran);
        }
      }
      //打包交易
      //复制交易池
      let trans = this.pendingTransactions.slice();
      let newBlock = new Block(trans, this.getLatestBlock());
      //挖矿
      newBlock.mineBlock(this.difficulty);
      //添加到链上
      this.submitBlock(newBlock);
      //将在新区块中被打包的交易从交易池中移除
      this.pendingTransactions = this.pendingTransactions.filter(t => trans.indexOf(t) === -1);
    }
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
}



function main() {
  const chunCoin = new Blockchain();

  // let wallet = Wallet.generateWallet();
  // wallet.saveWallet2File('wallet/test.wallet');

  const miner = Wallet.loadFromFile('wallet/miner.wallet');
  const alice = Wallet.loadFromFile('wallet/alice.wallet');
  const bob = Wallet.loadFromFile('wallet/bob.wallet');

  setTimeout(() => {
    chunCoin.syncChain();
  }, 1000);

  // 阻塞5秒，等待ws连接
  setTimeout(() => {
    chunCoin.mine(miner.address);
  }, 5000);

  setInterval(() => {
    console.log('new transaction');
    amount = Math.floor(Math.random() * 100);
    receiver = Math.random() > 0.5 ? miner : bob;
    tran = alice.sendMoney(amount, receiver.address);
    chunCoin.submitTransaction(tran);
  }, 3000);
}

main();