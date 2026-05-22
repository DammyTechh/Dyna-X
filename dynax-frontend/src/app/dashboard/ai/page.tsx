'use client';

import { useState, useRef, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAIQuery, useAIHistory } from '@/hooks/useApi';
import { tokenStore } from '@/lib/api';
import {
  Send, Bot, User, Loader2, Sparkles, Trash2, ChevronDown, Stethoscope, Brain, FileText,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { AIConversation } from '@/types';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const SUGGESTED = [
  { icon: '🩺', text: 'Help me write a SOAP note for a post-amputation patient', role: ['physiotherapist', 'prosthetist', 'orthotist'] },
  { icon: '💊', text: 'What are best exercises for lower limb rehabilitation?', role: ['physiotherapist', 'patient'] },
  { icon: '🦾', text: 'Suggest a care plan for transradial prosthesis fitting', role: ['prosthetist', 'orthotist'] },
  { icon: '🧠', text: 'How can I manage anxiety about using a prosthesis?', role: ['patient', 'mental_health_clinician'] },
  { icon: '📋', text: 'Generate a weekly home exercise program for stroke recovery', role: ['physiotherapist', 'occupational_therapist'] },
  { icon: '🗣️', text: 'Speech therapy activities for aphasia patients', role: ['speech_therapist'] },
];

export default function AIAssistantPage() {
  const role = tokenStore.getRole() || 'patient';
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [showHistory, setShowHistory] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { mutateAsync: query, isPending } = useAIQuery();
  const { data: history } = useAIHistory({ page: 1, page_size: 20 });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (text?: string) => {
    const content = (text || input).trim();
    if (!content || isPending) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    try {
      const res = await query({ input: content, conversation_id: conversationId });
      if (!conversationId && res.conversation_id) setConversationId(res.conversation_id);

      const aiMsg: ChatMessage = {
        id: res.id,
        role: 'assistant',
        content: res.response,
        timestamp: new Date(res.created_at),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errMsg]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setConversationId(undefined);
    setInput('');
  };

  const relevantSuggestions = SUGGESTED.filter(
    (s) => s.role.includes(role) || s.role.includes('all')
  );

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-56px)] md:h-screen overflow-hidden">
        {/* Sidebar - history */}
        <div className={cn(
          'hidden lg:flex flex-col w-72 bg-white border-r border-slate-100 flex-shrink-0',
        )}>
          <div className="p-4 border-b border-slate-100">
            <h2 className="font-display font-semibold text-slate-900 text-sm mb-3">AI Assistant</h2>
            <button
              onClick={clearChat}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              New Conversation
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            <p className="text-xs font-medium text-slate-400 px-2 mb-2 uppercase tracking-wider">Recent</p>
            {history?.data?.map((conv: AIConversation) => (
              <button
                key={conv.id}
                className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors group"
                onClick={() => {
                  setConversationId(conv.conversation_id);
                  setMessages([
                    { id: `${conv.id}-u`, role: 'user', content: conv.input, timestamp: new Date(conv.created_at) },
                    { id: `${conv.id}-a`, role: 'assistant', content: conv.response, timestamp: new Date(conv.created_at) },
                  ]);
                }}
              >
                <p className="text-xs font-medium text-slate-700 truncate">{conv.input}</p>
                <p className="text-xs text-slate-400 mt-0.5">{format(new Date(conv.created_at), 'MMM d, h:mm a')}</p>
              </button>
            ))}
            {!history?.data?.length && (
              <p className="text-xs text-slate-400 px-2 text-center py-8">No conversations yet</p>
            )}
          </div>
        </div>

        {/* Main chat */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
          {/* Header */}
          <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl dynax-gradient flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-display font-semibold text-slate-900 text-sm">DynaX AI Assistant</h1>
                <p className="text-xs text-slate-400">Powered by clinical AI · Context-aware for your role</p>
              </div>
            </div>
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 font-medium"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6">
            {messages.length === 0 ? (
              <div className="max-w-2xl mx-auto">
                {/* Welcome */}
                <div className="text-center mb-10">
                  <div className="w-16 h-16 rounded-2xl dynax-gradient flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
                    <Bot className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="font-display text-2xl font-bold text-slate-900 mb-2">
                    How can I help you today?
                  </h2>
                  <p className="text-slate-500 text-sm max-w-md mx-auto">
                    I&apos;m your clinical AI assistant, trained to support rehabilitation professionals and patients with evidence-based guidance.
                  </p>
                </div>

                {/* Capability cards */}
                <div className="grid sm:grid-cols-3 gap-3 mb-8">
                  {[
                    { icon: Stethoscope, title: 'Clinical Support', desc: 'SOAP notes, assessments, and care planning assistance' },
                    { icon: Brain, title: 'Patient Education', desc: 'Evidence-based explanations for patients and families' },
                    { icon: FileText, title: 'Documentation', desc: 'Referral letters, progress reports, and discharge summaries' },
                  ].map((cap) => {
                    const Icon = cap.icon;
                    return (
                      <div key={cap.title} className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
                        <Icon className="w-5 h-5 text-blue-500 mb-2" />
                        <p className="text-sm font-semibold text-slate-800 mb-1">{cap.title}</p>
                        <p className="text-xs text-slate-500">{cap.desc}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Suggestions */}
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Try asking…</p>
                <div className="space-y-2">
                  {relevantSuggestions.slice(0, 4).map((s) => (
                    <button
                      key={s.text}
                      onClick={() => send(s.text)}
                      className="w-full flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 text-left text-sm text-slate-700 transition-all group"
                    >
                      <span className="text-lg flex-shrink-0">{s.icon}</span>
                      <span className="group-hover:text-blue-700">{s.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto space-y-6">
                {messages.map((msg) => (
                  <div key={msg.id} className={cn('flex gap-3', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
                    {/* Avatar */}
                    <div className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1',
                      msg.role === 'user' ? 'bg-blue-600' : 'dynax-gradient'
                    )}>
                      {msg.role === 'user'
                        ? <User className="w-4 h-4 text-white" />
                        : <Bot className="w-4 h-4 text-white" />
                      }
                    </div>

                    {/* Bubble */}
                    <div className={cn(
                      'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-tr-sm'
                        : 'bg-white border border-slate-100 text-slate-800 rounded-tl-sm shadow-sm'
                    )}>
                      {msg.content.split('\n').map((line, i) => (
                        <p key={i} className={i > 0 ? 'mt-2' : ''}>{line}</p>
                      ))}
                      <p className={cn('text-xs mt-2', msg.role === 'user' ? 'text-blue-200' : 'text-slate-400')}>
                        {format(msg.timestamp, 'h:mm a')}
                      </p>
                    </div>
                  </div>
                ))}

                {/* Typing indicator */}
                {isPending && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full dynax-gradient flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 border border-slate-100 shadow-sm">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="bg-white border-t border-slate-100 px-4 md:px-8 py-4">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-end gap-3 bg-slate-50 rounded-2xl border border-slate-200 focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100 p-3 transition-all">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything about patient care, clinical notes, rehabilitation…"
                  rows={1}
                  className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none resize-none max-h-32 leading-relaxed"
                  style={{ minHeight: '24px' }}
                />
                <button
                  onClick={() => send()}
                  disabled={isPending || !input.trim()}
                  className="w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white flex items-center justify-center flex-shrink-0 transition-colors"
                >
                  {isPending
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Send className="w-4 h-4" />
                  }
                </button>
              </div>
              <p className="text-xs text-slate-400 text-center mt-2">
                AI responses are for informational purposes. Always apply clinical judgment.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
