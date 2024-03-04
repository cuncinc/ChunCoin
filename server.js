const ws = require('ws');

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

const blocks = [];

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
            let block = msg.data;
            console.log('block', block);
            blocks.push(block);
            wss.broadcast(ws, message);
        }
        else if (type === 'new_transaction') {
            wss.broadcast(ws, message);
        }
        else if (type === 'max_height') {
            let height = blocks.length;
            let response = { type: 'max_height_rsp', data: height };
            ws.send(JSON.stringify(response));
            // wss.broadcast(ws, message);
        }
        else if (type === 'node_sync') {
            let height = msg.data;
            //返回区块链数据，从height到最新

            let data = blocks.slice(height);
            let response = { type: 'node_sync_rsp', data: data };
            ws.send(JSON.stringify(response));

            // wss.broadcast(ws, message);
        }
        else if (type === 'node_sync_rsp') {
            // wss.broadcast(ws, message);
        }
    });

    ws.on('close', () => {
        console.log(`Node ${ws._socket.remotePort} disconnected`);
    });
});

