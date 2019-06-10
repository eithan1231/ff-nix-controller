const url = require('url');
const querystring = require('querystring');

class Router
{
  constructor(options)
  {
    this.routeOptions = {};
    this.hostname = options.hostname || 'localhost';
    this.port = options.port || 80;
    this.routes = [];
  }

  registerRoute(route)
  {
    this.routes.push(route);
  }

  /**
  * When calling a route, the first parameter is reserved for options. This
  * will set one of those options. This will allow for better management of
  * global variables
  * @param key of the option (option[key] = value)
  * @param value of option
  */
  registerOption(key, value)
  {
    this.routeOptions[key] = value;
  }

  getPath(routeName, options = {})
  {
    options.query = options.query || '?';
    if(options.query.length <= 0 || options.query[0] != '?') {
      options.query = `?${options.query}`;
    }

    options.hash = options.hash || '';
    if(options.hash.length <= 0 || options.hash[0] != '#') {
      options.hash = `#${options.hash}`;
    }

    for(let route of this.routes) {
      if(route.getName() == routeName) {
        return `${route.getType()}://${this.hostname}:${this.port}${route.getPath()}${options.query}${options.hash}`;
      }
    }
    return false;
  }

  async runHttp(req, res)
  {
    const reqUrl = url.parse(req.url);
    for(let route of this.routes) {
      if(route.getType() == 'http') {
        if(route.getPath() == reqUrl.pathname) {
          if(route.getMethods().includes(req.method)) {
            res.setHeader('x-route', route.getName());
            return await route.run(this.routeOptions, this, req, res);
          }
        }
      }
    }

    res.setHeader('Content-Type', 'text/plain');
    res.writeHead(404);
    res.end('Page not found');
  }

  async runWebSocket(req, sock, head)
  {
    const reqUrl = url.parse(req.url);
    for(let route of this.routes) {
      if(route.getType() == 'ws') {
        if(route.getPath() == reqUrl.pathname) {
          return await route.run(this.routeOptions, this, req, sock, head);
        }
      }
    }

    sock.destroy();
  }
}

module.exports = Router;
