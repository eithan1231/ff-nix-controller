const WebSocket = require('ws');

class routeInterface
{
  static async init(options = {})
  {
    this.OpenVPN = options.OpenVPN || null;
    this.AutoAPI = options.AutoAPI || null;

    this.webSocketServer = new WebSocket.Server({ noServer: true });
    this.webSocketServer.on('connection', routeInterface._onConnection.bind(this));

    // broadcast
    this.webSocketServer.json = (data) => {
      this.webSocketServer.clients.forEach((wc) => {
        wc.json(data);
      });
    };

    if(this.AutoAPI) {
      this.AutoAPI.on('logout', async () => {
        // Ensure VPN connection is terminated
        await this.OpenVPN.kill();

        // Saying we're logged out.
        this.webSocketServer.json({
          reason: 'logout'
        });
      });
    }

    if(this.OpenVPN) {
      this.OpenVPN.on('error', (err) => {
        this.webSocketServer.json({
          reason: 'internal-error',
          error: err
        });
      })

      this.OpenVPN.on('state', (state) => {
        this.webSocketServer.json({
          reason: 'openvpn-state',
          state: state
        });
      });

      this.OpenVPN.on('bandwidth', (bandwidth) => {
        this.webSocketServer.json({
          reason: 'openvpn-bandwidth',
          bandwidth: bandwidth
        });
      });

      this.OpenVPN.on('close', (bandwidth) => {
        this.webSocketServer.json({
          reason: 'openvpn-close',
        });
      });
    }
  }

  static _onConnection(options, ws, req)
  {
    ws.json({
      reason: 'init',
      loggedIn: this.AutoAPI.isLoggedIn()
    });

    ws.on('json', async (json) => {
      switch (json.reason) {
        case 'login': {
          await routeInterface._onDoLogin(ws, json);
          break;
        }

        case 'connect': {
          await routeInterface._onDoConnect(ws, json);
          break;
        }

        case 'disconnect': {
          await routeInterface._onDoDisconnect(ws, json);
          break;
        }

        case 'server-list': {
          await routeInterface._onDoServerList(ws, json);
          break;
        }

        case 'reload-connection-data': {
          await routeInterface._onDoReloadConnectionData(ws, json);
          break;
        }

        case 'logout': {
          await routeInterface._onDoLogout(ws, json);
          break;
        }

        default: {
          break;
        }
      }
    });
  }

  static async _onDoLogin(ws, json)
  {
    // On login successful, broadcast such. Otherwise just send failed
    // response to the client who sent the request.
    if(!this.AutoAPI.isLoggedIn()) {
      const res = await this.AutoAPI.authenticate(json.username, json.password);
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
  }

  static async _onDoConnect(ws, json)
  {
    try {
      if(typeof json.nodeId !== 'undefined') {
        if(this.OpenVPN.isRunning()) {
          await this.OpenVPN.kill();
        }

        const connectStatus = await this.OpenVPN.start(json.nodeId);

        this.webSocketServer.json({
          reason: 'connect-response',
          message: connectStatus.message
        });
      }
    }
    catch(err) {
      this.webSocketServer.json({
        reason: 'internal-error',
        error: err
      });
    }
  }

  static async _onDoDisconnect(ws, json)
  {
    if(this.OpenVPN.isRunning()) {
      await this.OpenVPN.kill();
    }
  }

  static async _onDoServerList(ws, json)
  {
    try {
      const nodeList = await this.AutoAPI.getNodes();
      if(nodeList) {
        ws.json({
          reason: 'server-list-response',
          servers: nodeList
        });
      }
    }
    catch(err) {
      this.webSocketServer.json({
        reason: 'internal-error',
        error: err
      });
    }
  }

  static async _onDoReloadConnectionData(ws, json)
  {
    this.OpenVPN.emitBandwidth();
    this.OpenVPN.emitState();
  }

  static async _onDoLogout(ws, json)
  {
    this.AutoAPI.logout();
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


module.exports = routeInterface;
