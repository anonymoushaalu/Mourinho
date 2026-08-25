import { useCallback, useEffect, useReducer, useRef } from 'react';

import { asIsoTimestamp } from '@mourinho/shared';

import { getChatTransport } from '@/lib/chat/transportFactory';
import type { ChatMessage, ChatTransport, MessageStatus, NavigationAction } from '@/types';

interface ChatSessionState {
  messages: ChatMessage[];
  /** True while the input has focus/content but nothing has been sent yet. */
  inputActive: boolean;
}

type ChatSessionAction =
  | { type: 'SEND_MESSAGE'; userMessageId: string; assistantMessageId: string; text: string }
  | { type: 'APPEND_CHUNK'; messageId: string; delta: string }
  | { type: 'SET_ACTIONS'; messageId: string; actions: NavigationAction[] }
  | { type: 'COMPLETE_MESSAGE'; messageId: string }
  | { type: 'ERROR_MESSAGE'; messageId: string; errorMessage: string }
  | { type: 'SET_INPUT_ACTIVE'; active: boolean };

const initialState: ChatSessionState = { messages: [], inputActive: false };

function chatReducer(state: ChatSessionState, action: ChatSessionAction): ChatSessionState {
  switch (action.type) {
    case 'SEND_MESSAGE': {
      const now = asIsoTimestamp(new Date().toISOString());
      const userMessage: ChatMessage = {
        id: action.userMessageId,
        role: 'user',
        content: action.text,
        status: 'complete',
        createdAt: now,
      };
      const assistantMessage: ChatMessage = {
        id: action.assistantMessageId,
        role: 'assistant',
        content: '',
        status: 'pending',
        createdAt: now,
      };
      return {
        messages: [...state.messages, userMessage, assistantMessage],
        inputActive: false,
      };
    }
    case 'APPEND_CHUNK':
      return {
        ...state,
        messages: state.messages.map((message) =>
          message.id === action.messageId
            ? { ...message, status: 'streaming', content: message.content + action.delta }
            : message,
        ),
      };
    case 'SET_ACTIONS':
      return {
        ...state,
        messages: state.messages.map((message) =>
          message.id === action.messageId ? { ...message, actions: action.actions } : message,
        ),
      };
    case 'COMPLETE_MESSAGE':
      return {
        ...state,
        messages: state.messages.map((message) =>
          message.id === action.messageId ? { ...message, status: 'complete' } : message,
        ),
      };
    case 'ERROR_MESSAGE':
      return {
        ...state,
        messages: state.messages.map((message) =>
          message.id === action.messageId
            ? { ...message, status: 'error', errorMessage: action.errorMessage }
            : message,
        ),
      };
    case 'SET_INPUT_ACTIVE':
      return { ...state, inputActive: action.active };
  }
}

/**
 * Owns the whole chat session: message history, input-focus tracking, and
 * dispatch of outgoing messages against a `ChatTransport`. This is the
 * single source of truth for chat data -- avatar *presentation* state is a
 * separate, derived concern layered on top by `useAvatarState`, not
 * duplicated here. Typed against the transport *interface* only -- swapping
 * the mock for a real SSE/WS implementation is a one-line change in
 * `transportFactory.ts`, not here.
 */
export function useChatSession(transport: ChatTransport = getChatTransport()) {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortControllerRef.current?.abort(), []);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const userMessageId = crypto.randomUUID();
      const assistantMessageId = crypto.randomUUID();
      dispatch({ type: 'SEND_MESSAGE', userMessageId, assistantMessageId, text: trimmed });

      try {
        for await (const event of transport.send({ role: 'user', content: trimmed }, controller.signal)) {
          switch (event.type) {
            case 'chunk':
              dispatch({ type: 'APPEND_CHUNK', messageId: assistantMessageId, delta: event.delta });
              break;
            case 'navigation-actions':
              dispatch({ type: 'SET_ACTIONS', messageId: assistantMessageId, actions: event.actions });
              break;
            case 'done':
              dispatch({ type: 'COMPLETE_MESSAGE', messageId: assistantMessageId });
              break;
            case 'error':
              dispatch({
                type: 'ERROR_MESSAGE',
                messageId: assistantMessageId,
                errorMessage: event.error.message,
              });
              break;
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          const errorMessage = error instanceof Error ? error.message : 'Something went wrong.';
          dispatch({ type: 'ERROR_MESSAGE', messageId: assistantMessageId, errorMessage });
        }
      }
    },
    [transport],
  );

  const setInputActive = useCallback((active: boolean) => {
    dispatch({ type: 'SET_INPUT_ACTIVE', active });
  }, []);

  const last = state.messages.at(-1);
  const lastMessageStatus: MessageStatus | null = last?.role === 'assistant' ? last.status : null;

  return {
    messages: state.messages,
    inputActive: state.inputActive,
    lastMessageStatus,
    sendMessage,
    setInputActive,
  };
}
