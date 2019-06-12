const net = require('net');

class OpenVPNManagement
{
  static async start(port, options = {})
  {
    OpenVPNManagement.port = port;
    OpenVPNManagement.auth = options.auth || OpenVPNManagement.auth || { type: 'none' };
    OpenVPNManagement.events = OpenVPNManagement.events || {};

    if(
      typeof OpenVPNManagement.socket !== 'undefined' &&
      OpenVPNManagement.socket.destroyed === false
    ) {
      throw new Error('OpenVPNManagement must be destroyed before starting new session');
    }

    OpenVPNManagement.socket = net.createConnection({
      port: OpenVPNManagement.port
    })

    OpenVPNManagement.socket.on('error', OpenVPNManagement._onError);
    OpenVPNManagement.socket.on('close', OpenVPNManagement._onClose);
    OpenVPNManagement.socket.on('data', OpenVPNManagement._onData);
    OpenVPNManagement.socket.on('connect', OpenVPNManagement._onConnect);
  }

  static async _onError(err)
  {
    OpenVPNManagement.emit('error', err);
  }

  static async _onClose(hadError)
  {
    OpenVPNManagement.emit('close');
  }

  static async _onData(data)
  {
    data = data.toString();// convert from buffer.

    const lines = data.split('\n').map(line => line.trim(line));
    for(let line of lines) {
      if(line.length < 3 || line[0] != '>') {
        continue;
      }

      const indicationEnd = line.indexOf(':');
      if(!indicationEnd) {
        return;
      }

      const command = line.substring(1, indicationEnd).trim().toLowerCase();
      const parameter = line.substring(indicationEnd + 1);

      switch(command) {
        case 'bytecount': {
          await OpenVPNManagement._handleByteCount(parameter);
          break;
        }

        case 'hold': {
          await OpenVPNManagement.send('hold release');
          break;
        }

        case 'password': {
          await OpenVPNManagement._handlePassword(parameter);
          break;
        }

        case 'state': {
          await OpenVPNManagement._handleState(parameter);
          break;
        }

        case 'log':
        case 'info': {
          break;
        }

        default: {
          break;
        }
      }
    }
  }

  static async _handlePassword(parameter)
  {
    switch (parameter) {
      case "Need 'Private Key' password": {
        if(OpenVPNManagement.auth.type == 'token') {
          const password = JSON.stringify(OpenVPNManagement.auth.token);
          await OpenVPNManagement.send(`password "Private Key" ${password}`);
        }
        else {
          OpenVPNManagement.socket.destroy(new Error('Unexpected authentication type'));
        }

        break;
      }

      case "Need 'Auth' username/password": {
        if(OpenVPNManagement.auth.type == 'userpass') {
          const username = JSON.stringify(OpenVPNManagement.auth.username);
          const password = JSON.stringify(OpenVPNManagement.auth.password);
          await OpenVPNManagement.send(`username "Auth" ${username}`);
          await OpenVPNManagement.send(`password "Auth" ${password}`);
        }
        else {
          OpenVPNManagement.socket.destroy(new Error('Unexpected authentication type'));
        }

        break;
      }

      default: {
        break;
      }
    }
  }

  static async _handleByteCount(parameter)
  {
    let bytesReceived = 0;
    let bytesSent = 0;

    const parameters = parameter.split(',', 2);
    if(parameters < 2) {
      return;
    }

    bytesReceived = parseInt(parameters[0]);
    bytesSent = parseInt(parameters[1]);

    OpenVPNManagement.emit('bandwidth', bytesReceived, bytesSent);
  }

  static async _handleState(parameter)
  {
    const parameters = parameter.split(',');
    if(parameters.length < 5) {
      return;
    }

    const unixTime = parseInt(parameters[0]);
    const stateName = parameters[1].toLowerCase();
    const stateDescriptor = parameters[2];
    const localIp = parameters[3];
    const remoteIp = parameters[4];

    switch (stateName) {
      case 'connecting': {
        OpenVPNManagement.emit('state', unixTime, stateName, stateDescriptor, localIp, remoteIp);
        break;
      }

      case 'connected': {
        OpenVPNManagement.emit('state', unixTime, stateName, stateDescriptor, localIp, remoteIp);
        break;
      }

      case 'reconnecting': {
        OpenVPNManagement.emit('state', unixTime, stateName, stateDescriptor, localIp, remoteIp);
        break;
      }

      case 'wait': {
        OpenVPNManagement.emit('state', unixTime, stateName, stateDescriptor, localIp, remoteIp);
        break;
      }

      case 'auth': {
        OpenVPNManagement.emit('state', unixTime, stateName, stateDescriptor, localIp, remoteIp);
        break;
      }

      case 'get_config': {
        OpenVPNManagement.emit('state', unixTime, stateName, stateDescriptor, localIp, remoteIp);
        break;
      }

      case 'assign_ip': {
        OpenVPNManagement.emit('state', unixTime, stateName, stateDescriptor, localIp, remoteIp);
        break;
      }

      case 'add_routes': {
        OpenVPNManagement.emit('state', unixTime, stateName, stateDescriptor, localIp, remoteIp);
        break;
      }

      case 'exiting': {
        OpenVPNManagement.emit('state', unixTime, stateName, stateDescriptor, localIp, remoteIp);
        break;
      }

      default: break;
    }
  }

  static async _onConnect()
  {
    await OpenVPNManagement.send('state on');
    await OpenVPNManagement.send('bytecount 1');
  }

  static async close()
  {
    if(!OpenVPNManagement.socket.destroyed) {
      await OpenVPNManagement.send('quit');
      OpenVPNManagement.socket.destroy();
    }
  }

  static send(value)
  {
    return new Promise(resolve => OpenVPNManagement.socket.write(`${value}\r\n`, resolve));
  }

  static emit(name, ...args)
  {
    if(typeof OpenVPNManagement.events[name] === 'undefined') {
      return;
    }

    OpenVPNManagement.events[name].forEach(callback => callback(...args));
  }

  static on(name, cb)
  {
    if(typeof OpenVPNManagement.events[name] === 'undefined') {
      OpenVPNManagement.events[name] = [];
    }

    OpenVPNManagement.events[name].push(cb);
  }
}

OpenVPNManagement.events = {};
module.exports = OpenVPNManagement;
