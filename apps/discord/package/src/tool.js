/**
 * discord_send: an agent sends plain text through the bot, for an active owner or admin only.
 * In a conversation that came in from a channel, Girru lets it answer only that conversation.
 */

const MAX_TEXT = 2000; // Discord's limit for one message

export function discordSendTool(api, channel) {
  return {
    name: 'discord_send',
    description: 'Send a plain text message through the configured Discord bot.',
    input_schema: {
      type: 'object',
      properties: { channelId: { type: 'string', description: 'Discord channel ID' }, content: { type: 'string', description: 'Message text' } },
      required: ['channelId', 'content'],
    },
    async execute(params, context) {
      try {
        api.authorizeChannelUser(context?.userId); // throws unless an active owner or admin
        const { channelId, content } = params || {};
        if (typeof channelId !== 'string' || !channelId.trim() || typeof content !== 'string' || !content.trim() || content.length > MAX_TEXT) throw new Error('invalid input');
        const result = await channel.send(channelId, content);
        return { content: [{ type: 'text', text: `Message delivered. ID: ${result.id}` }] };
      } catch {
        return { error: 'Discord delivery failed or access denied', content: [{ type: 'text', text: 'Message was not delivered. Check channel access and connection.' }] };
      }
    },
  };
}
