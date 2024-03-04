const WebSocket = require('ws');

//ws 客户端

const ws = new WebSocket('ws://localhost:53000');
// const ws = new WebSocket('ws://134.175.236.211:53000');
ws.on('open', () => {
    ws.send(JSON.stringify({ type: 'hello', data: ws._socket.localPort }));
});

ws.on('message', message => {
    let msg = JSON.parse(message);
    let type = msg.type;
    console.log('type', type);
    if (type === 'new_block') {
        console.log(msg.data);
    }
    else if (type === 'new_transaction') {
        console.log(msg.data);
    }
    else if (type === 'node_sync') {
        console.log(msg.data);
    }
    else {
        console.log('Unknown message', message);
    }
});

ws.on('close', () => {
    console.log('Client disconnected');
});

