const tmpPromise = require('tmp-promise');
const childProcess = require('child_process');
const fsPromises = require('fs').promises;


class OpenVPN
{
  static init(config)
  {
    // Management port.
    OpenVPN.port = 1203;

    // OpenVPN subprocess
    OpenVPN.child = null;

    // Keep track of which node we're connected to.
    OpenVPN.connectedNodeId = 0;

    // Management interface class.
    OpenVPN.Management = config.Management || null;

    // AutoAPI (access to remote server)
    OpenVPN.AutoAPI = config.AutoAPI || null;

    // All events for the handler (we're not using Events extension as it does
    // not support static classes)
    OpenVPN.events = {};

    // Most recent info from OpenVPN
    OpenVPN.recentMostState = null;
    OpenVPN.recentMostBandwidth = null;

    OpenVPN.Management.on('state', (unixTime, stateName, stateDescriptor, localIp, remoteIp) => {
      OpenVPN.recentMostState = {
        unixTime: unixTime,
        stateName:  stateName,
        stateDescriptor: stateDescriptor,
        localIp: localIp,
        remoteIp: remoteIp,
        nodeId: OpenVPN.connectedNodeId
      };

      OpenVPN.emitState();
    });

    OpenVPN.Management.on('bandwidth', (rx, tx) => {
      OpenVPN.recentMostBandwidth = {
        rx: rx,
        tx: tx,
        nodeId: OpenVPN.connectedNodeId
      }

      OpenVPN.emitBandwidth();
    });
  }

  static isRunning()
  {
    return OpenVPN.child !== null;
  }

  static async start(nodeId)
  {
    const openVPNConfig = await OpenVPN.AutoAPI.getOpenVPNConfig(nodeId);
    const configLocation = (await tmpPromise.file()).path;
    await fsPromises.writeFile(configLocation, openVPNConfig);

    OpenVPN.child = childProcess.spawn('openvpn', [
      '--config',
      configLocation,
      '--management',
      '127.0.0.1',
      OpenVPN.port.toString(),
      '--management-hold',
      '--management-query-passwords'
    ]);

    OpenVPN.child.on('exit', () => {
      OpenVPN.kill();// Just to ensure management is ded
    });

    // Allowing time to OpenVPN server to start
    setTimeout(async () => {
      // Setting the connected node id (Do not do it at the beginning of this
      // function) Was gettign a weird bug when it was at the start
      OpenVPN.connectedNodeId = nodeId;

      // Running management
      await OpenVPN.Management.start(OpenVPN.port, {
        auth: OpenVPN.AutoAPI.getNodeAuth()
      });
    }, 1000)
  }

  static async kill()
  {
    OpenVPN.connectedNodeId = 0;
    await OpenVPN.Management.close();
    OpenVPN.recentMostState = null;
    OpenVPN.recentMostBandwidth = null;
    if(OpenVPN.child !== null && !OpenVPN.child.killed) {
      OpenVPN.child.kill();
      OpenVPN.emit('close');
    }
    OpenVPN.child = null;


    // Basically just say we're ded
    OpenVPN.emitBandwidth();
    OpenVPN.emitState();
  }

  static emitBandwidth()
  {
    OpenVPN.emit('bandwidth', OpenVPN.recentMostBandwidth);
  }

  static emitState()
  {
    OpenVPN.emit('state', OpenVPN.recentMostState);
  }

  static on(name, func)
  {
    if(typeof OpenVPN.events[name] === 'undefined') {
      OpenVPN.events[name] = [];
    }

    OpenVPN.events[name].push(func);
  }

  static emit(name, ...args)
  {
    if(typeof OpenVPN.events[name] !== 'undefined') {
      OpenVPN.events[name].forEach(method => method(...args));
    }
  }
}

module.exports = OpenVPN;
