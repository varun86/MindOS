import type {
  FeishuSdkMessageEvent,
  FeishuWebhookEventEnvelope,
  IncomingIMMessage,
} from '@/lib/im/types';

function parseTextContent(content?: string): string {
  if (!content) return '';
  try {
    const parsed = JSON.parse(content) as { text?: string };
    return typeof parsed.text === 'string' ? parsed.text.trim() : '';
  } catch {
    return '';
  }
}

function hasBotMention(event: FeishuWebhookEventEnvelope): boolean {
  const mentions = event.event?.message?.mentions;
  return Array.isArray(mentions) && mentions.length > 0;
}

export function shouldProcessFeishuEvent(event: FeishuWebhookEventEnvelope): { ok: boolean; reason: string } {
  const chatType = event.event?.message?.chat_type;
  if (chatType === 'p2p') return { ok: true, reason: 'direct_message' };
  if (chatType === 'group') {
    return hasBotMention(event)
      ? { ok: true, reason: 'group_with_mention' }
      : { ok: false, reason: 'group_without_mention' };
  }
  return { ok: false, reason: 'unsupported_chat_type' };
}

export function normalizeFeishuIncomingMessage(event: FeishuWebhookEventEnvelope): IncomingIMMessage {
  const message = event.event?.message;
  const sender = event.event?.sender;
  return {
    platform: 'feishu',
    senderId: sender?.sender_id?.open_id ?? sender?.sender_id?.union_id ?? sender?.sender_id?.user_id ?? 'unknown',
    senderName: undefined,
    chatId: message?.chat_id ?? 'unknown',
    chatType: message?.chat_type === 'group' ? 'group' : 'dm',
    text: parseTextContent(message?.content),
    messageId: message?.message_id ?? 'unknown',
    threadId: undefined,
    mentionsBot: hasBotMention(event),
    rawEvent: event,
  };
}

export async function handleFeishuMessageReceiveEvent(event: FeishuSdkMessageEvent): Promise<Record<string, unknown>> {
  if (!event.message?.chat_id || !event.message?.message_id || !event.sender?.sender_id) {
    return { ok: true, ignored: true, reason: 'invalid_event_payload' };
  }

  const envelope: FeishuWebhookEventEnvelope = {
    header: {
      event_type: event.event_type ?? 'im.message.receive_v1',
    },
    event: {
      message: event.message,
      sender: event.sender,
    },
  };

  const decision = shouldProcessFeishuEvent(envelope);
  if (!decision.ok) {
    return { ok: true, ignored: true, reason: decision.reason };
  }

  const incoming = normalizeFeishuIncomingMessage(envelope);
  if (!incoming.text.trim()) {
    return { ok: true, ignored: true, reason: 'empty_text' };
  }

  void import('./feishu-conversation')
    .then(({ processFeishuIncomingMessage }) => processFeishuIncomingMessage(incoming))
    .catch((error) => {
      console.error('[feishu/webhook] Async processing failed:', error);
    });

  return {
    ok: true,
    queued: true,
    reason: decision.reason,
    incoming,
  };
}
