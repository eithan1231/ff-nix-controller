const tmpPromise = require('tmp-promise');
const childProcess = require('child_process');
const fsPromises = require('fs').promises;


class OpenVPN
{
  static init(config)
  {
    // Management port.
    OpenVPN.port = 1203;
    OpenVPN.child = null;
    OpenVPN.Management = config.Management || null;
    OpenVPN.AutoAPI = config.AutoAPI || null;
    OpenVPN.events = {};
  }

  static on(name, func)
  {
    if(typeof OpenVPN.events[name] === 'undefined') {
      OpenVPN.events[name] = [];
    }

    OpenVPN.events[name].push(func);
  }

  static emit(name, value = null)
  {
    if(typeof penVPN.events[name] !== 'undefined') {
      penVPN.events[name].forEach(method => method(value));
    }
  }

  static isRunning()
  {
    return OpenVPN.child !== null;
  }

  static start(nodeId)
  {
    return new Promise(async (resolve, reject) => {
      try {
        const openVPNConfig = await OpenVPN.AutoAPI.getOpenVPNConfig(nodeId);
        const configLocation = (await tmpPromise.file()).path;
        await fsPromises.writeFile(configLocation, openVPNConfig);

        OpenVPN.child = childProcess.spawn('openvpn', [
          '--config',
          configLocation,
          '--management',
          '127.0.0.1',
          OpenVPN.port,
          '--management-hold',
          '--management-query-passwords'
        ]);

        OpenVPN.child.on('close', () => {
          OpenVPN.kill();// Just to ensure management is ded
          OpenVPN.emit('close');
        })
      }
      catch (ex) {
        return reject(ex);
      }
    });
  }

  static kill()
  {
    // Kill management
    // kill process
  }
}

module.exports = OpenVPN;
