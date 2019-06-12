// Loading configuration
const fs = require('fs');
const yaml = require('js-yaml');
const config = yaml.safeLoad(fs.readFileSync('config.yaml', 'utf8'));

// Loading all services and stuff.
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
    OpenVPN: OpenVPN
  });

  const router = new Router(config);
  router.registerRoute(routeIndex);
  router.registerRoute(routeAsset);
  router.registerRoute(routeInterface);
  router.registerOption('RemoteContext', RemoteContext);
  router.registerOption('AutoAPI', AutoAPI);

  const localHttpServer = new LocalHttpServer();
  localHttpServer.setRouter(router);
  localHttpServer.listen(config.port);
}

main();
