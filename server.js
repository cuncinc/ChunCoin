const ws = require('ws');
const { Block, Transaction, Wallet } = require('./block');

//ws 服务器
const wss = new ws.Server({ port: 53000 });

//ws广播
wss.broadcast = function broadcast(ws, data) {
  wss.clients.forEach(client => {
    if (client !== ws && client.readyState === ws.OPEN) {
      client.send(data);
    }
  });
};

const blockchain = [];

//ws 服务器监听
wss.on('connection', ws => {
  ws.on('error', console.error);

  console.log('Node connected', ws._socket.remoteAddress, ws._socket.remotePort);

  ws.on('message', message => {
    //message内容中，type为broadcast时，广播消息
    let msg = JSON.parse(message);
    let type = msg.type;
    console.log(ws._socket.remotePort, type);

    if (type === 'new_block') {
      let block = Object.assign(new Block(), msg.data);
      console.log(block);
      if (block.isBlockValid(blockchain[blockchain.length - 1])) {
        console.log('block valid');
        blockchain.push(block);
      }
      else {
        console.log('block invalid');
      }
      wss.broadcast(ws, message);
    }
    else if (type === 'new_transaction') {
      wss.broadcast(ws, message);
    }
    else if (type === 'max_height') {
      let height = blockchain.length;
      let response = { type: 'max_height_rsp', data: height };
      ws.send(JSON.stringify(response));
    }
    else if (type === 'node_sync') {
      let block = Object.assign(new Block(), msg.data);
      let height = block.height;
      //返回区块链数据，从height到最新
      if (blockchain.length === 0 && height === 0) {  //本地没有区块，用对方的创世区块覆盖
        blockchain.push(block);
        console.log(blockchain[0])
      }
      else {
        let data = blockchain.slice(height);
        let response = { type: 'node_sync_rsp', data: data };
        ws.send(JSON.stringify(response));
      }
    }
    else if (type === 'node_sync_rsp') {
    }
  });

  ws.on('close', () => {
    console.log(`Node ${ws._socket.remotePort} disconnected`);
  });
});