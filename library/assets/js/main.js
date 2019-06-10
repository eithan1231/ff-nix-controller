function _debug(string)
{
  console.log(`FriedFame: ${string}`);
}

// The web-socket object used for backend-communications
var globalWebSocket = null;

// App element.
var app = null;

// List of all servers.
var servers = [];

// List of function hooks for templates (IE: When a template loads, it will call
// a hook)
var templateHooks = {};


/**
* Sends request to update server list. No promise that this will be fulfilled.
*/
function requestServerReload()
{
  send({
    reason: 'server-list'
  });
}

function doAutomaticSelectServer(id)
{
  _debug(`Select server ${id}`);
  for (let server of servers) {
    if(server.id == id) {
      return setTemplate('home-footer-info', 'template-home-footer-info', server);
    }
  }
}

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

    case 'login-response': {
      return onSvrLoginResponse(data);
    }

    case 'server-list-response': {
      return onSvrNodeListResponse(data);
    }

    case 'init': {
      return onSvrInit(data);
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
    switch (data.message) {
      case 'try-again-later':
        setStatus('Try again later');
        break;
      case 'missing-param':
        setStatus('Missing Input');
        break;
      case 'bad-username':
        setStatus('Username not found');
        break;
      case 'bad-password':
        setStatus('Password mismatch');
        break;
      case 'autoapi-error':
        setStatus('Cannot access remote server');
        break;
      case 'no-subscription':
        setStatus('No subscription can be found');
        break;
      default:
        setStatus(`Unknown response ${data.message}`);
        break;
    }
  }
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