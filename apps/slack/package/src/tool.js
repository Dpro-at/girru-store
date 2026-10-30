/**
 * slack_send: an agent logs a message for a Slack channel, for an active owner or admin only.
 * Sending to Slack itself is not built yet; the answer says so.
 */

import { NOT_CONNECTED, logOutgoing, validChannel, validText } from './messages.js';

const text = (t, isError = false) => ({ content: [{ type: 'text', text: t }], ...(isError ? { is_error: true } : {}) });

export function createSlackSendTool(api) {
  return {
    name: 'slack_send',
    description: 'Log a message for a Slack channel or thread. Sending to Slack is not built yet: the message is kept in Girru only.',
    input_schema: {
      type: 'object',
      properties: {
        channel: {
          type: 'string',
          description: 'Slack channel ID (starts with C) or channel name (e.g., #general)',
        },
        text: {
          type: 'string',
          description: 'Message text',
        },
        thread_ts: {
          type: 'string',
          description: 'Optional thread timestamp to reply in a thread',
        },
      },
      required: ['channel', 'text'],
    },

    async execute(params, context) {
      try {
        api.authorizeChannelUser(context?.userId); // throws unless an active owner or admin
      } catch {
        return text('Error: only an active owner or admin of this Girru can use Slack.', true);
      }
      const { channel, text: body, thread_ts } = params || {};
      if (!validChannel(channel) || !validText(body) || (thread_ts !== undefined && typeof thread_ts !== 'string')) {
        return text('Error: give a Slack channel and a message of at most 40000 characters.', true);
      }
      try {
        const messageId = logOutgoing(api.db, { channel, text: body, thread_ts });
        return text(`${NOT_CONNECTED}. Message ID: ${messageId}`);
      } catch {
        return text('Error: the message could not be logged.', true);
      }
    },
  };
}
