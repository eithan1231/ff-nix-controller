function _debug(string)
{
  dubugLog.push(string);
  console.log(`FriedFame: ${string}`);
}


// Status translations
var statusTranslations = {
  'connecting': 'Connecting to server',
  'connected': 'Connected',
  'reconnecting': 'Reconnecting',
  'wait': 'Waiting for service',
  'auth': 'Authenticating',
  'get_config': 'Getting Configuration',
  'assign_ip': 'Assigning IP address',
  'add_routes': 'Adding Routes',
  'exiting': 'Terminating...',
  'try-again-later': 'Try again later',
  'missing-param': 'Missing Input',
  'bad-username': 'Username is invalid, or cannot be found',
  'bad-password': 'Password mismatch',
  'autoapi-error': 'Remote server error',
  'no-subscription': 'No active subscription found',
  'bad-param': 'Malformed input',
  'missing-token': 'AutoAPI Error (token missing)',
  'bad-token': 'You have been logged out',
  'bad-node': 'VPN Server cannot be found',
  'node-disabled': 'VPN server has been disabled',
  'node-overload': 'VPN server has too many active connections. Try another.',
  'bad-subscription': 'You do not have a subscription',
  'bad-auth': 'VPN authentication token is invalid',
  'bad-plan': 'Your subscription plan is missing',
  'exceeds-maximum-concurrent': 'You are exceeding your allocated concurrent connections'
};

var dubugLog = [];

// The web-socket object used for backend-communications
var globalWebSocket = null;

// App element.
var app = null;

// List of all servers.
var servers = [];

// The server thats currently selected (DOES NOT MEAN CONNECTED)
var selectedServer = {};

// List of function hooks for templates (IE: When a template loads, it will call
// a hook)
var templateHooks = {};

// These two variables are used in conjunction to generate a template.
var latestOpenVPNBandwidth = null;
var latestOpenVPNState = null;


/**
* Sends request to update server list. No promise that this will be fulfilled.
*/
function requestServerReload()
{
  _debug('Requesting server reload (server list)')
  send({
    reason: 'server-list',
  });
}

function doAutomaticLogout()
{
  _debug('Automatic logout');
  send({
    'reason': 'logout'
  });
}

/**
* Gets a server by ID
*/
function getServerById(id)
{
  for (const server of servers) {
    if(server.id == id) {
      return server;
    }
  }

  return null;
}

/**
* Sends command to connect to selected server automatically
*/
function doAutomaticConnect()
{
  _debug('Automatic connect');

  if(!selectedServer) {
    _debug('Automatic connect - Bad server selected');
    return setStatus('Invalid server selected');
  }

  send({
    reason: 'connect',
    nodeId: selectedServer.id
  });
}

/**
* Sends disconnct command to server.
*/
function doAutomaticDisconnect()
{
  _debug('Automatic disconnect');

  send({
    reason: 'disconnect'
  });
}

/**
* Requests server to re-send all connection information
*/
function doRequestConnectionInfo()
{
  _debug('Requesting connection information (Bandwidth and Server)')
  send({
    reason: 'reload-connection-data'
  })
}

/**
* Updates the selected server
*/
function doAutomaticSelectServer(id)
{
  _debug(`Select server ${id}`);
  const server = getServerById(id);
  if(server) {
    selectedServer = server;
    return setTemplate('home-footer-info', 'template-home-footer-info', server);
  }
}

/**
* Updates the connection status part of the footer.
*/
function setConnectionStatus(server = 'N/A', privateIp = 'N/A', publicIp = 'N/A', bandwidth = "N/A")
{
  return setTemplate('home-footer-connection', 'template-home-footer-connection', {
    server: server,
    'private-ip': privateIp,
    'public-ip': publicIp,
    bandwidth: bandwidth,
  });
}

/**
* Automatically handles authentication (queries usernamd and password
* automatically)
*/
function doAutomaticAuthentication()
{
  _debug('Doing automated authentication');
  var username = document.getElementById('inputUsername').value;
  var password = document.getElementById('inputPassword').value;
  if(!username || !password) {
    setStatus('Missing Input');
    _debug('Bad input');
    return;
  }

  doAuthentication(username, password);
}

/**
* Authenticates a user. You will receive a response in the form of a message,
* with the reason 'login-response'
* @param username
* @param password
*/
function doAuthentication(username, password)
{
  _debug(`Sending doAuthentication for ${username}`);
  send({
    reason: 'login',
    username: username,
    password: password
  });
}

/**
* Backend-web-socket connection was terminated.
*/
function onClose()
{
  _debug('WebSocket Closd');
  setTemplate('app', 'template-reload', {
    explanation: 'We lost connection to the endpoint'
  });
}

/**
* WebSocket had an error
* @param err
*/
function onError(err)
{
  _debug('WebSocket Error.');
  _debug(err);
  globalWebSocket.close();
  setTemplate('app', 'template-reload', {
    explanation: 'Error occured with communication to the endpoint.'
  });
}

/**
* Event for new message
* @param data Object data (parsed json from endpoint)
*/
function onMessage(data)
{
  _debug('WebSocket Message');

  switch (data.reason) {
    case 'status': {
      return onSvrStatus(data);
    }

    case 'logout': {
      return onSvrLogout(data);
    }

    case 'internal-error': {
      return onSvrInternalError(data);
    }

    case 'login-response': {
      return onSvrLoginResponse(data);
    }

    case 'connect-response': {
      return onSvrConnectResponse(data);
    }

    case 'server-list-response': {
      return onSvrNodeListResponse(data);
    }

    case 'init': {
      return onSvrInit(data);
    }

    case 'openvpn-close': {
      return onSvrOpenVPNClose(data);
    }

    case 'openvpn-state': {
      return onSvrOpenVPNState(data);
    }

    case 'openvpn-bandwidth': {
      return onSvrOpenVPNBandwidth(data);
    }

    default: {
      _debug(`Unknown response reason ${data.reason}`);
    }
  }
}

/**
* 'status' server event.
*/
function onSvrStatus(data)
{
  // Status report (OpenVPN status).
  _debug('OpenVPN Status Report');
}

function onSvrLogout(data)
{
  _debug('Server logout');
  setTemplate('app', 'template-login');
}

/**
* Error occured on server
*/
function onSvrInternalError(data)
{
  _debug('OpenVPN Error');
  console.log(data.error);
  setTemplate('app', 'template-error', { error: JSON.stringify(data.error) });
}

/**
* 'login-response' server event
*/
function onSvrLoginResponse(data)
{
  _debug('Loging Response');
  if(data.loggedIn) {
    setTemplate('app', 'template-home');
  }
  else {
    setStatus(statusTranslations[data.message] || 'Unknown Login Response');
  }
}

/**
* Response to conenct event.
*/
function onSvrConnectResponse(data)
{
  setStatus(statusTranslations[data.message] || `Unknown connect response (${data.message})`);
}

/**
* When we get array of server nodes.
*/
function onSvrNodeListResponse(data)
{
  _debug('Reloading server list');
  servers = data.servers;

  // Outputting servers to console for debug purposes
  for(var key in servers) {
    var server = servers[key];
    _debug(`(${server.id}) Server ${server.hostname}, Country: ${server.country}`);
  }

  let view = {
    servers: servers
  };

  setTemplate('home-servers', 'template-home-servers', view);
}

/**
* OpenVPN close event
*/
function onSvrOpenVPNClose(data)
{
  _debug('OpenVPN Close');
  setStatus('Disconnected');
  setConnectionStatus();
}

/**
* OpenVPN state event
*/
function onSvrOpenVPNState(data)
{
  _debug('OpenVPN State Change');
  latestOpenVPNState = data.state;
  updateFooterConnection();
}

/**
* OpenVPN state event
*/
function onSvrOpenVPNBandwidth(data)
{
  latestOpenVPNBandwidth = data.bandwidth;
  updateFooterConnection();
}

/**
* Updates the connection status footer section
*/
function updateFooterConnection()
{
  // Updating status
  if(latestOpenVPNState !== null && latestOpenVPNBandwidth !== null) {
    setStatus(statusTranslations[latestOpenVPNState.stateName] || 'Unknown Status');
  }

  var serverName = 'N/A';
  var localIp = 'N/A';
  var remoteIp = 'N/A'
  if(latestOpenVPNState !== null) {
    var server = getServerById((latestOpenVPNState.nodeId || latestOpenVPNBandwidth.nodeId) || null);
    if(server) {
      localIp = latestOpenVPNState.localIp;
      remoteIp = latestOpenVPNState.remoteIp;
      serverName = `${server.city}/${server.country}/${server.id}`;
    }
  }

  var bandwidthUsage = 'N/A';
  if(latestOpenVPNBandwidth !== null) {
    var receiveVisual = getSizeAsVisual(latestOpenVPNBandwidth.rx);
    var sendVisual = getSizeAsVisual(latestOpenVPNBandwidth.tx);
    bandwidthUsage = `${receiveVisual}/${sendVisual}`;
  }

  setConnectionStatus(
    serverName,
    localIp,
    remoteIp,
    bandwidthUsage
  );
}

/**
* 'init' (initial) server command
*/
function onSvrInit(data)
{
  _debug('Initial server message');
  if(data.loggedIn) {
    setTemplate('app', 'template-home');
  }
  else {
    setTemplate('app', 'template-login');
  }
}

/**
* Event of when the WebSocket is opened
*/
function onOpen()
{
  _debug('WebSocket Opened');
  setTemplate('app', 'template-loading', {
    explanation: 'Initiated connection with backend. Waitig for state report.'
  });
}

/**
* Entry point of application
*/
function main()
{
  app = document.getElementById('app');
  servers = [];
  templateHooks = {};

  _debug('Main has been called');
  _debug('WebSocket endpoint ' + window.ff_settings.wsEndpoint);

  setTemplate('app', 'template-loading', {
    explanation: 'Initiating connection with application.'
  });

  hookTemplateRender('template-home', requestServerReload);
  hookTemplateRender('template-home-servers', () => {
    setTemplate('home-footer', 'template-home-footer');
  });
  hookTemplateRender('template-home-footer', () => {
    // Pretend we clicked server so we display information about a server.
    doAutomaticSelectServer(servers[0].id);

    // Setting default server status (N/A)
    setConnectionStatus();

    doRequestConnectionInfo();
  })

  globalWebSocket = new WebSocket(window.ff_settings.wsEndpoint);

  globalWebSocket.json = (data) => globalWebSocket.send('json/' + JSON.stringify(data));
  globalWebSocket.onclose = onClose;
  globalWebSocket.onerror = onError;
  globalWebSocket.onopen = onOpen;

  globalWebSocket.onmessage = (event) => {
    if(event.type == 'message') {
      var dataRaw = event.data;
      var dataSlashPosition = dataRaw.indexOf('/');
      if(dataSlashPosition <= 1) {
        return _debug('Received message with bad slash position');
      }

      var type = dataRaw.substring(0, dataSlashPosition);
      var content = dataRaw.substring(dataSlashPosition + 1);

      switch (type) {
        case 'json': {
          var contentParsed = JSON.parse(content);
          if(typeof contentParsed === 'object') {
            onMessage(contentParsed);
          }
          else {
            _debug('Message expected to be parsed from JSON Object, we received ' + (typeof contentParsed))
          }

          break;
        }

        default: {
          _debug(`Unexpected type ${type}`);
          break;
        }
      }
    }
  };
};

/**
* Every page should contain a status element. This will set the textContent of
* said element.
* @param status
*/
function setStatus(status)
{
  _debug(`Set Status: ${status}`);
  var element = document.getElementById('status');
  if(element) {
    if(element.hidden) {
      element.hidden = false;
    }
    element.textContent = status;
  }
  else {
    alert(status);
  }
}

/**
* Wrapper for globalWebSocket.json
*/
function send(...data)
{
  return globalWebSocket.json(...data);
}

function getSizeAsVisual(bytes, si = false) {
  if(Math.abs(bytes) < 1024) {
    return bytes + ' B';
  }
  var units = ['kB','MB','GB','TB','PB','EB','ZB','YB'];
  var u = -1;
  do {
    bytes /= 1024;
    ++u;
  } while(Math.abs(bytes) >= 1024 && u < units.length - 1);
  return bytes.toFixed(1)+' '+units[u];
}

/**
* Gets a template
* @param name of template
* @param view for template
*/
function getTemplate(name, view)
{
  var templateElement = document.getElementById(name);
  if(templateElement.type !== 'text/html') {
    _debug(`Bad mime type for ${name}`);
    return false;
  }

  var template = templateElement.innerHTML;
  return Mustache.render(template, view);
}

/**
* Sets a template
* @param subjectElementId element which we are setting the template to
* @param templateName name of template
* @param view Template view
*/
function setTemplate(subjectElementId, templateName, view = {})
{
  var subjectElement = document.getElementById(subjectElementId);
  if(!subjectElement) {
    return false;
  }

  var rendered = getTemplate(templateName, view);
  if(!rendered) {
    return false;
  }

  subjectElement.innerHTML = rendered;

  runTemplateHook(templateName);
  return true;
}

/**
* Hooks the rendering of a template
* @param templateName Template we want to hook
* @param hook The hook (this is a function)
*/
function hookTemplateRender(templateName, hook)
{
  if(typeof templateHooks[templateName] === 'undefined') {
    templateHooks[templateName] = [];
  }

  templateHooks[templateName].push(hook);
}

/**
* Runs a template hook
*/
function runTemplateHook(templateName)
{
  if(typeof templateHooks[templateName] === 'undefined') {
    return false;
  }

  for(var i = 0; i < templateHooks[templateName].length; i++) {
    setTimeout(templateHooks[templateName][i], 0);
  }
}
