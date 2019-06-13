// Loading configuration
const fs = require('fs');
const yaml = require('js-yaml');
const config = yaml.safeLoad(fs.readFileSync('config.yaml', 'utf8'));

// Loading all services and stuff.
const open = require('open');
const LocalHttpServer = require('./library/LocalHTTPServer');
const RemoteContext = require('./library/RemoteContext');
const AutoAPI = require('./library/AutoAPI');
const Router = require('./library/Router');
const OpenVPN = require('./library/OpenVPN');
const OpenVPNManagement = require('./library/OpenVPNManagement');

// Loading routes.
const routeIndex = require('./library/routes/index');
const routeAsset = require('./library/routes/asset');
const routeInterface = require('./library/routes/interface');

async function main()
{
  await RemoteContext.init(config);
  await AutoAPI.init({
    RemoteContext: RemoteContext,
    XSrcHeader: config.XSrcHeader
  });
  await OpenVPN.init({
    Management: OpenVPNManagement,
    AutoAPI: AutoAPI
  });
  await routeInterface.init({
    OpenVPN: OpenVPN,
    AutoAPI: AutoAPI
  });

  const router = new Router(config);
  router.registerRoute(routeIndex);
  router.registerRoute(routeAsset);
  router.registerRoute(routeInterface);

  const localHttpServer = new LocalHttpServer();
  localHttpServer.setRouter(router);
  localHttpServer.listen(config.port);

  // You should Open browser page here, but it's somewhat faulty. If you're
  // running in root, it will open it under root, not necessarily the user
  // account in use.
}

async function unhandledError(err)
{
  if(err.errno === 'EADDRINUSE') {
    // Assuming there's already a 'service' running, so let's open the panel.
    await open(`http://${config.host}:${config.port}/`);
  }
  else {
    console.error(err);
  }
  process.exit(1);
}

process.on('uncaughtException', unhandledError);
main();
