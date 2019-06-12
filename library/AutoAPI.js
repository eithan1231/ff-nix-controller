const requestPromise = require('request-promise-native');
const querystring = require('querystring');

class AutoAPI
{
  static async init(config = {})
  {
    AutoAPI.token = '';
    AutoAPI.nodeAuth = '';
    AutoAPI.userId = 0;
    AutoAPI.heartbeatInterval = null;
    AutoAPI.RemoteContext = config.RemoteContext || null;
    AutoAPI.XSrcHeader = config.XSrcHeader || '';
  }

  /**
  *
  * @param action RemoteContext key
  * @param body The body we are posting
  * @param bodyType MIME type for body. Default will assume url-encoded on
  * strings, and json for anything else.
  */
  static async buildRequestOptions(action, body = null, bodyType = null)
  {
    let res = {
      uri: await AutoAPI.RemoteContext.get(action),
      method: 'POST',
      resolveWithFullResponse: true,
      headers: {
        'x-src': AutoAPI.XSrcHeader,
        'x-try-ignore-session': 'true'
      }
    };

    if(AutoAPI.token && AutoAPI.token.length > 0) {
      res.headers['x-api-token'] = AutoAPI.token;
    }

    if(body) {
      if(typeof body == 'string') {
        if(!bodyType) {
          bodyType = 'application/x-www-form-urlencoded';
        }
        res.body = body;
      }
      else {
        if(!bodyType) {
          bodyType = 'application/json';
        }
        res.body = JSON.stringify(body);
      }

      res.headers['content-type'] = bodyType;
    }

    return res;
  }

  /**
  * Authenticates the AutoAPI class
  * @param username Username we're authenticating
  * @param password Password used with authentication
  */
  static async authenticate(username, password)
  {
    if(typeof username != 'string' || typeof password != 'string') {
      throw new Error('Unexpected type');
    }

    const request = await AutoAPI.buildRequestOptions(
      'autoapi-auth',
      `username=${querystring.escape(username)}&password=${querystring.escape(password)}`
    );

    const response = await requestPromise(request);

    if(response.statusCode === 200) {
      if(response.headers['content-type'] === 'application/json') {
        const parsedResponse = JSON.parse(response.body);

        if(parsedResponse['message'] === 'okay') {
          AutoAPI.token = parsedResponse['token'];
          AutoAPI.nodeAuth = parsedResponse['node-auth'];
          AutoAPI.userId = parsedResponse['user-id'];
          AutoAPI.startHeartbeat();
        }

        return parsedResponse;
      }
      else {
        throw new Error('Server sent unexpected content-type');
      }
    }
    else {
      throw new Error('Remote server returned unexpected response');
    }
  }

  /**
  * Returns array of VPN nodes.
  */
  static async getNodes()
  {
    if(!AutoAPI.isLoggedIn()) {
      throw new Error('Not Authenticated');
    }

    const request = await AutoAPI.buildRequestOptions('autoapi-list');
    const response = await requestPromise(request);

    if(response.statusCode === 200) {
      if(response.headers['content-type'] === 'application/json') {
        const parsedResponse = JSON.parse(response.body);

        if(parsedResponse.message === 'okay') {

          return parsedResponse.servers;
        }
        else {
          throw new Error(`Server Responded: ${parsedResponse.message}`);
        }
      }
      else {
        throw new Error('Server sent unexpected content-type');
      }
    }
    else {
      throw new Error('Remote server returned unexpected response');
    }
  }

  /**
  * Tells the server to generate an OpenVPN configuration for any given node
  * @param nodeId ID of the node we want the OpenVPN configuration for
  */
  static async getOpenVPNConfig(nodeId)
  {
    if(!AutoAPI.isLoggedIn()) {
      throw new Error('Not Authenticated');
    }

    const request = await AutoAPI.buildRequestOptions('autoapi-openvpnconfig', `node=${querystring.escape(nodeId)}`);
    const response = await requestPromise(request);

    if(response.statusCode === 200) {
      if(response.headers['content-type'] === 'application/ovpn-config') {
        return response.body;
      }
      else {
        throw new Error('Server sent unexpected content-type');
      }
    }
    else {
      throw new Error('Remote server returned unexpected response');
    }
  }

  /**
  * Checks whether this AutoAPI session can connect to a specific node
  * @param nodeId The node which we wanna see whether or not we can connect to.
  */
  static async canConnect(nodeId)
  {
    if(!AutoAPI.isLoggedIn()) {
      throw new Error('Not Authenticated');
    }

    const request = await AutoAPI.buildRequestOptions('autoapi-connect', `node=${querystring.escape(nodeId)}`);
    const response = await requestPromise(request);

    if(response.statusCode === 200) {
      if(response.headers['content-type'] === 'application/json') {
        return JSON.parse(response.body);
      }
      else {
        throw new Error('Server sent unexpected content-type');
      }
    }
    else {
      throw new Error('Remote server returned unexpected response');
    }
  }

  /**
  * Checks if we're logged in.
  */
  static isLoggedIn()
  {
    return AutoAPI.token.length > 0;
  }

  /**
  * gets node authentication parameters
  */
  static getNodeAuth()
  {
    if(!AutoAPI.isLoggedIn()) {
      return null;
    }

    return {
      type: 'userpass',
      username: AutoAPI.userId,
      password: AutoAPI.nodeAuth
    };
  }

  /**
  * Sends a heartbeat to the server.
  */
  static async doHeartbeat()
  {
    if(!AutoAPI.isLoggedIn()) {
      return false;
    }
    const request = await AutoAPI.buildRequestOptions('autoapi-heartbeat');
    const response = await requestPromise(request);
    return response.statusCode === 200;
  }

  /**
  * Starts heartbeat interval
  */
  static startHeartbeat()
  {
    if(AutoAPI.heartbeatInterval !== null) {
      clearInterval(AutoAPI.heartbeatInterval);
    }

    AutoAPI.heartbeatInterval = setInterval(async () => {
      if(!AutoAPI.isLoggedIn()) {
        return clearInterval(AutoAPI.heartbeatInterval);
      }

      await AutoAPI.doHeartbeat();
    }, 1200000);
  }
}

module.exports = AutoAPI;
