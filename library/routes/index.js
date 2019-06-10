const path = require('path');
const fsPromises = require('fs').promises;

class routeIndex
{
  static getName()
  {
    return 'index';
  }

  static getPath()
  {
    return '/';
  }

  static getMethods()
  {
    return ['GET'];
  }

  static getType()
  {
    return 'http';
  }

  static async run(options, router, req, res)
  {
    const page = await fsPromises.readFile('library/views/index.html', 'utf8');

    res.setHeader('Content-Type', 'text/html');
    res.writeHead(200);
    res.end(page);
  }
}

module.exports = routeIndex;
