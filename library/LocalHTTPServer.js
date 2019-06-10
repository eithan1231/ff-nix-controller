const http = require('http');
const ip = require('ip');

class LocalHttpServer
{
  constructor()
  {
    this.server = http.createServer();
    this.server.on('request', this._onRequest.bind(this));
    this.server.on('upgrade', this._onUpgrade.bind(this));
  }

  setRouter(router)
  {
    this.router = router;
  }

  close(...arg)
  {
    return this.server.close(...arg);
  }

  listen(...arg)
  {
    return this.server.listen(...arg);
  }

  on(...arg)
  {
    // Highjacking the servers event emitter. Yolo.
    return this.server.on(...arg);
  }

  async _onRequest(req, res)
  {
    if(!ip.isPrivate(req.connection.remoteAddress)) {
      res.writeHead(403);
      return res.end('Connections from remote addresses is prohibited');
    }

    await this.router.runHttp(req, res);
  }

  async _onUpgrade(req, sock, head)
  {
    if(!ip.isPrivate(req.connection.remoteAddress)) {
      return sock.destroy();
    }

    await this.router.runWebSocket(req, sock, head);
  }
}

module.exports = LocalHttpServer;
