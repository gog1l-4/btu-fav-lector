import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { Avatar } from '../components/common/Avatar';
import { AppLayout } from '../components/layout/AppLayout';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';
import type { ChatMessage, ConversationSummary } from '../types';
import { formatGeorgianRelativeDate } from '../utils/date';

export function MessagesPage() {
  const { user, refreshMe } = useAuth();
  const { socket } = useSocket();
  const { showToast } = useToast();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('conversationId') || '';

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeConv, setActiveConv] = useState<{
    id: string;
    otherUser: ConversationSummary['otherUser'];
    offer?: { listing: { course: { name: string; code: string } } } | null;
  } | null>(null);
  const [text, setText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      const data = await apiRequest<{ conversations: ConversationSummary[] }>(
        '/messages/conversations'
      );
      setConversations(data.conversations);
      if (!selectedId && data.conversations[0]) {
        setParams({ conversationId: data.conversations[0].id }, { replace: true });
      }
    } catch {
      // ignore
    } finally {
      setLoadingList(false);
    }
  }, [selectedId, setParams]);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setActiveConv(null);
      setMessages([]);
      return;
    }

    apiRequest<{
      conversation: {
        id: string;
        otherUser: ConversationSummary['otherUser'];
        offer?: { listing: { course: { name: string; code: string } } } | null;
      };
      messages: ChatMessage[];
    }>(`/messages/conversations/${selectedId}`)
      .then(async (data) => {
        setActiveConv(data.conversation);
        setMessages(data.messages);
        setConversations((prev) =>
          prev.map((c) => (c.id === selectedId ? { ...c, unreadCount: 0 } : c))
        );
        await refreshMe();
      })
      .catch(() => {});

    socket?.emit('join:conversation', selectedId);
    return () => {
      socket?.emit('leave:conversation', selectedId);
    };
  }, [selectedId, socket]);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg: ChatMessage) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === msg.conversationId
            ? {
                ...c,
                lastMessage: msg,
                lastMessageAt: msg.createdAt,
                unreadCount:
                  msg.conversationId === selectedId || msg.senderId === user?.id
                    ? 0
                    : c.unreadCount + 1,
              }
            : c
        )
      );

      if (msg.conversationId === selectedId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    };

    const handleTyping = (payload: {
      conversationId: string;
      userId: string;
      isTyping: boolean;
    }) => {
      if (payload.conversationId === selectedId && payload.userId !== user?.id) {
        setIsTyping(payload.isTyping);
      }
    };

    socket.on('message:new', handleNewMessage);
    socket.on('typing', handleTyping);
    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('typing', handleTyping);
    };
  }, [socket, selectedId, user?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !text.trim()) return;
    setSending(true);
    try {
      const content = text.trim();
      setText('');
      socket?.emit('typing', { conversationId: selectedId, isTyping: false });
      const data = await apiRequest<{ message: ChatMessage }>(
        `/messages/conversations/${selectedId}`,
        {
          method: 'POST',
          body: JSON.stringify({ content }),
        }
      );
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.message.id)) return prev;
        return [...prev, data.message];
      });
      loadConversations();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'გაგზავნა ვერ მოხერხდა', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <AppLayout>
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden grid grid-cols-1 md:grid-cols-12 h-[calc(100vh-8.5rem)] min-h-[520px]">
        {/* Conversations Sidebar */}
        <div className="md:col-span-4 border-b md:border-b-0 md:border-r border-slate-200/80 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h1 className="font-extrabold text-base text-slate-900">პირადი მიმოწერა</h1>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loadingList ? (
              <div className="p-6 text-center text-xs text-slate-500">იტვირთება...</div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 space-y-2">
                <MessageCircle className="w-8 h-8 text-slate-300 mx-auto" />
                <p>საუბრები ჯერ არ გაქვთ. გაცვლის შეთავაზების შემდეგ აქ გამოჩნდება ჩატი.</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setParams({ conversationId: conv.id })}
                  className={`w-full text-left p-4 flex items-start gap-3 hover:bg-slate-50 transition ${
                    conv.id === selectedId ? 'bg-indigo-50/60' : ''
                  }`}
                >
                  <Avatar
                    firstName={conv.otherUser.firstName}
                    lastName={conv.otherUser.lastName}
                    avatarUrl={conv.otherUser.avatarUrl}
                    verificationStatus={conv.otherUser.studentVerificationStatus}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm text-slate-900 truncate">
                        {conv.otherUser.firstName} {conv.otherUser.lastName}
                      </span>
                      {conv.unreadCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                    {conv.offer?.listing?.course && (
                      <p className="text-[11px] font-semibold text-indigo-600 truncate">
                        {conv.offer.listing.course.name}
                      </p>
                    )}
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {conv.lastMessage?.content || 'დაიწყეთ საუბარი...'}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Active Chat Thread */}
        <div className="md:col-span-8 flex flex-col overflow-hidden bg-slate-50/40">
          {!activeConv ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <MessageCircle className="w-12 h-12 mb-3 text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">
                აირჩიეთ საუბარი მარცხენა სიიდან
              </p>
            </div>
          ) : (
            <>
              <div className="bg-white px-5 py-3.5 border-b border-slate-200/80 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar
                    firstName={activeConv.otherUser.firstName}
                    lastName={activeConv.otherUser.lastName}
                    avatarUrl={activeConv.otherUser.avatarUrl}
                    verificationStatus={activeConv.otherUser.studentVerificationStatus}
                    size="sm"
                  />
                  <div>
                    <p className="font-bold text-sm text-slate-900">
                      {activeConv.otherUser.firstName} {activeConv.otherUser.lastName}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {isTyping
                        ? 'წერს შეტყობინებას...'
                        : activeConv.offer?.listing?.course?.name ||
                          activeConv.otherUser.university.shortName}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
                {messages.map((msg) => {
                  const mine = msg.senderId === user?.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm shadow-xs ${
                          mine
                            ? 'bg-indigo-600 text-white rounded-br-sm'
                            : 'bg-white border border-slate-200/80 text-slate-800 rounded-bl-sm'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        <p
                          className={`text-[10px] mt-1 ${
                            mine ? 'text-indigo-200' : 'text-slate-400'
                          }`}
                        >
                          {formatGeorgianRelativeDate(msg.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              <form
                onSubmit={handleSend}
                className="bg-white p-3 sm:p-4 border-t border-slate-200/80 flex items-center gap-2.5"
              >
                <input
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    socket?.emit('typing', {
                      conversationId: activeConv.id,
                      isTyping: e.target.value.length > 0,
                    });
                  }}
                  placeholder="დაწერეთ შეტყობინება..."
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={sending || !text.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold transition"
                >
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline">გაგზავნა</span>
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
