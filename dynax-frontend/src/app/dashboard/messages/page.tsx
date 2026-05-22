'use client';

import { useState, useRef, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useConversations, useMessages, useSendMessage } from '@/hooks/useApi';
import { Send, Search, Loader2, MessageSquare, CheckCheck, Check, Paperclip } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Conversation, Message } from '@/types';

export default function MessagesPage() {
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [search, setSearch] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const myId = typeof window !== 'undefined' ? localStorage.getItem('dynax_user_id') : null;

  const { data: conversations, isLoading: loadingConvs } = useConversations();
  const { data: messagesData, isLoading: loadingMsgs } = useMessages(selectedConv || '', { page: 1, page_size: 50 });
  const { mutateAsync: sendMessage, isPending: sending } = useSendMessage(selectedConv || '');
  const messages = messagesData?.data || [];

  const handleSend = async () => {
    if (!inputText.trim() || !selectedConv || sending) return;
    const text = inputText.trim();
    setInputText('');
    try { await sendMessage(text); } catch { setInputText(text); }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function fmtTime(ts?: string) {
    if (!ts) return '';
    const d = new Date(ts);
    if (isToday(d)) return format(d, 'h:mm a');
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'MMM d');
  }

  function groupByDate(msgs: Message[]) {
    const groups: { date: string; messages: Message[] }[] = [];
    msgs.forEach((msg) => {
      const d = format(new Date(msg.created_at), 'yyyy-MM-dd');
      const last = groups[groups.length - 1];
      if (last?.date === d) last.messages.push(msg);
      else groups.push({ date: d, messages: [msg] });
    });
    return groups;
  }

  function dateSep(dateStr: string) {
    const d = new Date(dateStr);
    if (isToday(d)) return 'Today';
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'MMMM d, yyyy');
  }

  const filteredConvs = (conversations || []).filter(() => true);

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-56px)] md:h-screen flex overflow-hidden bg-white">
        {/* Sidebar */}
        <div className={cn('w-full md:w-80 flex-shrink-0 border-r border-slate-100 flex flex-col', selectedConv && 'hidden md:flex')}>
          <div className="px-4 py-4 border-b border-slate-100">
            <h1 className="font-display font-bold text-slate-900 text-lg mb-3">Messages</h1>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…"
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-100 text-sm focus:outline-none" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingConvs ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
            ) : filteredConvs.length > 0 ? (
              filteredConvs.map((conv) => (
                <ConvItem key={conv.id} conv={conv} isSelected={selectedConv === conv.id}
                  onClick={() => setSelectedConv(conv.id)} fmtTime={fmtTime} />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <MessageSquare className="w-10 h-10 text-slate-300 mb-3" />
                <p className="text-slate-500 text-sm font-medium">No conversations yet</p>
                <p className="text-slate-400 text-xs mt-1">Messages with patients and professionals appear here.</p>
              </div>
            )}
          </div>
        </div>

        {/* Chat */}
        <div className={cn('flex-1 flex flex-col', !selectedConv && 'hidden md:flex')}>
          {selectedConv ? (
            <>
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3 bg-white">
                <button onClick={() => setSelectedConv(null)} className="md:hidden text-slate-500 mr-1 text-lg">←</button>
                <div className="w-9 h-9 rounded-full dynax-gradient flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-semibold text-sm">C</span>
                </div>
                <div>
                  <p className="font-semibold text-sm text-slate-900">Conversation</p>
                  <p className="text-xs text-green-500 font-medium">Active</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 bg-slate-50">
                {loadingMsgs ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
                ) : messages.length > 0 ? (
                  groupByDate(messages).map(({ date, messages: dayMsgs }) => (
                    <div key={date}>
                      <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 h-px bg-slate-200" />
                        <span className="text-xs text-slate-400 font-medium">{dateSep(date)}</span>
                        <div className="flex-1 h-px bg-slate-200" />
                      </div>
                      {dayMsgs.map((msg) => {
                        const isOwn = msg.sender_id === myId;
                        return (
                          <div key={msg.id} className={cn('flex mb-2', isOwn ? 'justify-end' : 'justify-start')}>
                            <div className={cn('max-w-[72%] rounded-2xl px-4 py-2.5 text-sm shadow-sm',
                              isOwn ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white text-slate-800 rounded-bl-sm border border-slate-100')}>
                              <p className="leading-relaxed">{msg.content}</p>
                              <div className={cn('flex items-center gap-1 mt-1', isOwn ? 'justify-end' : 'justify-start')}>
                                <span className={cn('text-[10px]', isOwn ? 'text-blue-200' : 'text-slate-400')}>
                                  {format(new Date(msg.created_at), 'h:mm a')}
                                </span>
                                {isOwn && (msg.is_read
                                  ? <CheckCheck className="w-3 h-3 text-blue-200" />
                                  : <Check className="w-3 h-3 text-blue-200" />)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center py-16">
                    <MessageSquare className="w-10 h-10 text-slate-300 mb-3" />
                    <p className="text-slate-500 text-sm">No messages yet. Say hello!</p>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="px-4 py-3 border-t border-slate-100 bg-white">
                <div className="flex items-end gap-2">
                  <div className="flex-1 flex items-end gap-2 bg-slate-100 rounded-2xl px-4 py-2">
                    <textarea value={inputText} onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                      placeholder="Type a message… (Enter to send)" rows={1}
                      className="flex-1 bg-transparent text-sm resize-none focus:outline-none text-slate-800 placeholder-slate-400 max-h-32"
                      onInput={(e) => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = `${Math.min(t.scrollHeight, 128)}px`; }} />
                    <button className="text-slate-400 hover:text-slate-600 p-1">
                      <Paperclip className="w-4 h-4" />
                    </button>
                  </div>
                  <button onClick={handleSend} disabled={sending || !inputText.trim()}
                    className={cn('w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-md',
                      inputText.trim() ? 'dynax-gradient text-white hover:opacity-90' : 'bg-slate-200 text-slate-400 cursor-not-allowed')}>
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 text-center p-8">
              <div className="w-20 h-20 rounded-full dynax-gradient flex items-center justify-center mb-4 shadow-xl">
                <MessageSquare className="w-9 h-9 text-white" />
              </div>
              <h2 className="font-display font-bold text-xl text-slate-800 mb-2">DynaX Messages</h2>
              <p className="text-slate-500 text-sm max-w-xs">Select a conversation to start chatting.</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

function ConvItem({ conv, isSelected, onClick, fmtTime }: {
  conv: Conversation; isSelected: boolean; onClick: () => void; fmtTime: (ts?: string) => string;
}) {
  return (
    <button onClick={onClick}
      className={cn('w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-50',
        isSelected && 'bg-blue-50 border-l-2 border-l-blue-500')}>
      <div className="relative flex-shrink-0">
        <div className="w-11 h-11 rounded-full dynax-gradient flex items-center justify-center">
          <span className="text-white font-semibold text-sm">C</span>
        </div>
        {conv.unread_count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {conv.unread_count > 9 ? '9+' : conv.unread_count}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={cn('text-sm truncate', conv.unread_count > 0 ? 'font-semibold text-slate-900' : 'font-medium text-slate-800')}>
            Conversation
          </p>
          <span className="text-[10px] text-slate-400 flex-shrink-0">{fmtTime(conv.last_message_at)}</span>
        </div>
        <p className={cn('text-xs truncate mt-0.5', conv.unread_count > 0 ? 'text-slate-700 font-medium' : 'text-slate-500')}>
          {conv.last_message || 'No messages yet'}
        </p>
      </div>
    </button>
  );
}
