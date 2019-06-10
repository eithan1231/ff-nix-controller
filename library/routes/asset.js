const url = require('url');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');

class routeAsset
{
  static getName()
  {
    return 'asset';
  }

  static getPath()
  {
    return '/asset';
  }

  static getMethods()
  {
    return ['GET'];
  }

  static getType()
  {
    return 'http';
  }

  static getMime(assetPath)
  {
    const extension = path.extname(assetPath);

    switch (extension) {
      case '.txt': {
        return 'text/plain';
      }

      case '.html': {
        return 'text/html';
      }

      case '.js': {
        return 'application/javascript';
      }

      case '.css': {
        return 'text/css';
      }

      case '.png': {
        return 'image/png';
      }

      default: return 'application/x-octet-stream';
    }
  }

  static async run(options, router, req, res)
  {
    return new Promise((resolve, reject) => {
      const parsedUrl = url.parse(req.url);
      if(!parsedUrl.query) {
        res.writeHead(404);
        return resolve(res.end('Bad Input'));
      }

      const assetName = querystring.unescape(parsedUrl.query).split('..').join('');
      const assetPath = path.join('library/assets/', path.normalize(assetName));

      fs.access(assetPath, fs.constants.R_OK, (err) => {
        if(err) {
          res.writeHead(404);
          return resolve(res.end('Asset cannot be found'));
        }
        else {
          res.setHeader('Content-Type', routeAsset.getMime(assetPath));
          res.writeHead(200);

          const readStream = fs.createReadStream(assetPath);
          readStream.on('ready', () => {
            readStream.pipe(res);
          });

          readStream.on('close', () => {
            return resolve(true);
          });
        }
      })
    });
  }
}

module.exports = routeAsset;
