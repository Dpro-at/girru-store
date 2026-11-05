import {channelSendTools,SEND_TOOL_NAMES} from './tools.js';

const nativeOptions = {
  isConfigured: config => typeof config.bot_token === 'string' && config.bot_token.trim() !== '',
  configKeys: ['bot_token', 'allowed_users', 'allowed_channels', 'guild_id', 'client_id', 'auto_reply'],
};


export async function registerAgentConnect(api,testing={}) {
  if(!api.channelHost){api.log('warn','Update Girru before using the Store version of Agent Connect.');return;}
  const sdk=await api.channelHost.loadLibrary();
  const {CHANNEL_CATALOG,PythonTransport}=sdk;
  const channels=CHANNEL_CATALOG;
  const {isNativeChannel,registerChannelRoutes,stopChannel,isValidEnvironment,isValidSettings,isValidStateDirectory,transportOptions}=api.channelHost;
const pythonOptions = id => ({
  requireChannels: true,
  isConfigured: config => config.configured === true,
  // S0-Q.6: the interpreter path is never configurable over HTTP; it comes
  // from the server environment (AGENT_CONNECT_PYTHON) only.
  configKeys: ['configured', 'settings', 'environment', 'state_directory', 'allowed_users', 'allowed_channels', 'auto_reply'],
  validateConfig: config => config.configured === true && isValidSettings(id, config.settings || {})
    && isValidEnvironment(id, config.environment || {})
    && isValidStateDirectory(config.state_directory),
  redactConfig: config => ({ config: {
    configured: config.configured === true, allowed_users: config.allowed_users || [],
    allowed_channels: config.allowed_channels || [], auto_reply: config.auto_reply === true,
  }, hasToken: config.configured === true, hasProviderSettings: !!config.settings, hasEnvironment: !!config.environment }),
  createTransport: (channelId, config) => new PythonTransport(channelId, transportOptions(channelId, config)),
});

  api.registerRoutes(async scope => {
    scope.addHook('preHandler', async (request, reply) => {
      try { api.authorizeChannelRequest(request); }
      catch { return reply.code(403).send({ error: 'Channel administration requires an active owner or admin account' }); }
    });
    // S0-Q.6: refuse (not silently drop) an attempt to choose the interpreter over HTTP.
    scope.addHook('preHandler', async (request, reply) => {
      const body = request.body;
      const input = body && typeof body === 'object' ? (body.config && typeof body.config === 'object' ? body.config : body) : null;
      if (input && Object.prototype.hasOwnProperty.call(input, 'python_executable')) {
        return reply.code(400).send({ error: 'The Python interpreter is set by the server operator (AGENT_CONNECT_PYTHON), not by channel settings' });
      }
    });
    scope.get('/catalog', async request => {
      api.authorizeChannelRequest(request);
      return { channels: CHANNEL_CATALOG };
    });
    for (const channel of channels) {
      const channelApi = {
        ...api,
        getConfig: () => api.getConfig()?.channels?.[channel.id] || {},
        setConfig: config => {
          const root = api.getConfig() || {};
          // Drop a legacy interpreter path saved before S0-Q.6; it is never used.
          const { python_executable: _legacy, ...clean } = config || {};
          api.setConfig({ ...root, channels: { ...root.channels, [channel.id]: clean } });
        },
      };
      const options = isNativeChannel(channel.id) ? nativeOptions : pythonOptions(channel.id);
      await scope.register(async child => registerChannelRoutes(child, channelApi, channel.id, {
        extensionId: 'agent-connect', ...options,
        ...(testing.createConnector ? { createConnector: testing.createConnector } : {}),
      }), { prefix: '/' + channel.id });
    }
  });
  for (const tool of channelSendTools(api)) api.registerTool(tool);
}

export default {id:'agent-connect',name:'Agent Connect',version:'0.3.0',register:registerAgentConnect,async onDisable(api){await api?.channelHost?.stopAllChannels();for(const name of SEND_TOOL_NAMES)api?.unregisterTool?.(name);}};
