const requestPromise = require('request-promise-native');

class RemoteContext
{
  /**
  * initializes remote context (fetches from server)
  * @param config Configuration
  *   XSrcHeader: the X-SRC header
  *   AutoAPIContext: Endpoint at which we request
  */
  static async init(config)
  {
    try
    {
      const options = {
        uri: config.AutoAPIContext,
        method: 'POST',
        resolveWithFullResponse: true,
        headers: {
          'x-src': config.XSrcHeader,
          'x-try-ignore-session': 'true'
        }
      };

      const response = await requestPromise(options);
      if(response.statusCode === 200) {
        if(response.headers['content-type'] === 'application/json') {
          const parsedResponse = JSON.parse(response.body);
          RemoteContext.context = parsedResponse;
        }
        else {
          throw new Error('Unexpected StatusCode');
        }
      }
      else {
        throw new Error('Unexpected StatusCode');
      }
    }
    catch(ex)
    {
      throw ex;
    }
  }

  static async get(key)
  {
    if(!RemoteContext.context) {
      throw new Error('Pending Initialization');
    }

    if(typeof RemoteContext.context[key] !== 'undefined') {
      return RemoteContext.context[key];
    }
    else {
      throw new Error('key not found');
    }
  }
}

module.exports = RemoteContext;
