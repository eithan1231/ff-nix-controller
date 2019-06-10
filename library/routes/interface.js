const WebSocket = require('ws');

class routeInterface
{
  static initialize()
  {
    this.webSocketServer = new WebSocket.Server({ noServer: true });
    this.webSocketServer.on('connection', routeInterface._onConnection.bind(this));

    // broadcast
    this.webSocketServer.json = (data) => {
      this.webSocketServer.clients.forEach((wc) => {
        wc.json(data);
      });
    };
  }

  static _onConnection(options, ws, req)
  {
    const { RemoteContext, AutoAPI } = options;

    ws.json({
      reason: 'init',
      loggedIn: AutoAPI.isLoggedIn(),
      // TODO: When we finish OpenVPNManagemetn and stuff, send a status report.
    });

    ws.on('json', async (json) => {
      switch (json.reason) {
        case 'login': {
          // On login successful, broadcast such. Otherwise just send failed
          // response to the client who sent the request.
          if(!AutoAPI.isLoggedIn()) {
            const res = await AutoAPI.authenticate(json.username, json.password);
            if(res.message === 'okay') {
              this.webSocketServer.json({
                reason: 'login-response',
                loggedIn: true,
                message: res.message
              });
            }
            else {
              ws.json({
                reason: 'login-response',
                loggedIn: false,
                message: res.message
              });
            }
          }
          break;
        }

        case 'server-list': {
          const nodeList = await AutoAPI.getNodes();
          if(nodeList) {
            ws.json({
              reason: 'server-list-response',
              servers: nodeList
            });
          }
          break;
        }

        default: {
          break;
        }
      }
    });
  }

  static getName()
  {
    return 'interface';
  }

  static getPath()
  {
    return '/interface';
  }

  static getMethods()
  {
    return ['GET'];
  }

  static getType()
  {
    return 'ws';
  }

  static async run(options, router, req, sock, head)
  {
    this.webSocketServer.handleUpgrade(req, sock, head, (ws) => {
      ws.json = (data) => ws.send('json/' + JSON.stringify(data));
      ws.on('message', (msg) => {
        const pos = msg.indexOf('/');
        if(pos <= 1) {
          return;
        }

        const type = msg.substring(0, pos);
        const content = msg.substring(pos + 1);

        if(type == 'message') {
          return;// recursive loop
        }

        switch (type) {
          case 'json': {
            var contentParsed = JSON.parse(content);
            if(typeof contentParsed === 'object') {
              ws.emit(type, contentParsed);
            }

            break;
          }

          default: {
            // Unexpected type
            break;
          }
        }
      });
      this.webSocketServer.emit('connection', options, ws, req);
    });
  }
}


routeInterface.initialize();
module.exports = routeInterface;
