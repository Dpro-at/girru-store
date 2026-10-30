/**
 * telegram_send: an agent sends plain text through the bot, for an active owner or admin only.
 * In a conversation that came in from a channel, Girru lets it answer only that conversation.
 */

const MAX_TEXT = 4096; // Telegram's limit for one message

export function telegramSendTool(api, channel) {
  return {
    name: 'telegram_send',
    description: 'Send a plain text message through the configured Telegram bot.',
    input_schema: {
      type: 'object',
      properties: { chatId: { type: 'string', description: 'Telegram chat ID' }, text: { type: 'string', description: 'Message text' } },
      required: ['chatId', 'text'],
    },
    async execute(params, context) {
      try {
        api.authorizeChannelUser(context?.userId); // throws unless an active owner or admin
        const { chatId, text } = params || {};
        if (typeof chatId !== 'string' || !chatId.trim() || typeof text !== 'string' || !text.trim() || text.length > MAX_TEXT) throw new Error('invalid input');
        const result = await channel.send(chatId, text);
        return { content: [{ type: 'text', text: `Message delivered. ID: ${result.id}` }] };
      } catch {
        return { error: 'Telegram delivery failed or access denied', content: [{ type: 'text', text: 'Message was not delivered. Check channel access and connection.' }] };
      }
    },
  };
}
