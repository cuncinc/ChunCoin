const sha256 = require('crypto-js/sha256');
const ecLib = require('elliptic').ec;
const ec = new ecLib('secp256k1');
const fs = require('fs');


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
    //this.data转换为字符串，否则在传输过程中会丢失Transaction类型，导致无法验证交易
    let data = JSON.stringify(this.data);
    return sha256(data + this.nonce + this.height + this.timestamp + this.previousBlockHash).toString();
  }

  mineBlock(difficulty) {
    while (this.hash.substring(0, difficulty) !== Array(difficulty + 1).join("0")) {
      this.nonce++;
      this.hash = this.calculateHash();
    }
    // console.log('Calculating hash:', this.data, this.nonce, this.height, this.timestamp, this.previousBlockHash);
    console.log('Block mined:', this.height, this.nonce, this.hash);
  }

  //验证交易是否有效
  isTransactionsValid() {
    let data = this.data;
    for (let tran of data) {
      //判断tran是否是Transaction的实例
      let t = Object.assign(new Transaction(), tran);
      // if (!(tran instanceof Transaction)) {
      //   console.log('Not instance of Tran');
      //   continue;
      // }
      if (!t.isTransactionValid()) {
        console.log('Invalid transaction:', t);
        return false;
      }
    }
    return true;
  }

  isBlockValid(previousBlock) {
    if (this.hash !== this.calculateHash()) {
      console.log('Block hash is invalid:', this.hash, this.calculateHash());
      return false;
    }
    if (this.previousBlockHash !== previousBlock.hash) {
      console.log('Previous block hash is invalid:', this.previousBlockHash);
      return false;
    }
    if (!this.isTransactionsValid()) {
      console.log('Some transactions are invalid');
      return false;
    }
    return true;
  }
}

module.exports = { Wallet, Transaction, Block };