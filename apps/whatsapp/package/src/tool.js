/**
 * whatsapp_send: an agent logs a WhatsApp message, for an active owner or admin only.
 * Sending through Twilio is not built yet; the answer says so.
 */

import { NOT_CONNECTED, logOutgoing, validMediaUrl, validNumber, validText } from './messages.js';

const text = (t, isError = false) => ({ content: [{ type: 'text', text: t }], ...(isError ? { is_error: true } : {}) });

export function createWhatsAppSendTool(api) {
  return {
    name: 'whatsapp_send',
    description: 'Log a WhatsApp message for a phone number. Sending through Twilio is not built yet: the message is kept in Girru only.',
    input_schema: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'Recipient phone number in E.164 format (e.g., +14155552671)',
        },
        body: {
          type: 'string',
          description: 'Message text',
        },
        mediaUrl: {
          type: 'string',
          description: 'Optional https address of a media file',
        },
      },
      required: ['to', 'body'],
    },

    async execute(params, context) {
      try {
        api.authorizeChannelUser(context?.userId); // throws unless an active owner or admin
      } catch {
        return text('Error: only an active owner or admin of this Girru can use WhatsApp.', true);
      }
      const { to, body, mediaUrl } = params || {};
      if (!validNumber(to) || !validText(body) || !validMediaUrl(mediaUrl)) {
        return text('Error: give a number like +14155552671, a message of at most 1600 characters, and an https media address if any.', true);
      }
      try {
        const messageId = logOutgoing(api.db, { to, body, mediaUrl });
        return text(`${NOT_CONNECTED}. Message ID: ${messageId}`);
      } catch {
        return text('Error: the message could not be logged.', true);
      }
    },
  };
}
