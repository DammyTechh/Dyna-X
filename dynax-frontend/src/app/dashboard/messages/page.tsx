'use client';

import { useState, useRef, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  useConversations, useMessages, useSendMessage, useStartConversation,
  useMyProfessionals, useMyPatients, useMe, useAdminProfessionals, useAdminPatients, useAssignProfessional,
} from '@/hooks/useApi';
import { VideoCall } from '@/components/video/VideoCall';
import {
  Send, Search, Loader2, MessageSquare, CheckCheck, Check, Paperclip,
  Plus, X, Video, Phone, ArrowLeft,
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { cn } from '@/lib/utils';
import { tokenStore } from '@/lib/api';
import { getRoleLabel } from '@/lib/routing';
import { toast } from 'sonner';
import type { Conversation, Message } from '@/types';

interface Contact { userId: string; name: string; sub: string; }

function MessagesInner() {
  const searchParams = useSearchParams();
  const [selectedConv, setSelectedConv] = useState<string | null>(searchParams.get('c'));
  const [inputText, setInputText] = useState('');
  const [search, setSearch] = useState('');
  const [composing, setComposing] = useState(false);
  const [connectEmail, setConnectEmail] = useState('');
  const [connectProf, setConnectProf] = useState('');
  const [callMode, setCallMode] = useState<'video' | 'audio' | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: me } = useMe();
  const myId = me?.user_id || tokenStore.getUserId() || '';
  const myRole = me?.role || tokenStore.getRole() || '';
  const isPatient = myRole === 'patient';
  const isAdmin = myRole === 'admin';

  // Role-aware contact list (people I'm allowed to message).
  const { data: professionals } = useMyProfessionals();
  const { data: patientsPage } = useMyPatients({ page: 1, page_size: 100 });
  // Admin can message ANY professional or patient (not just connected ones).
  const { data: adminProfs } = useAdminProfessionals('approved', isAdmin);
  const { data: adminPatients } = useAdminPatients({ page: 1, page_size: 200 }, isAdmin);

  const contacts: Contact[] = useMemo(() => {
    if (isAdmin) {
      const profs = ((adminProfs as { data?: { user_id: string; full_name: string; professional_type: string }[] } | undefined)?.data || [])
        .map((p) => ({ userId: p.user_id, name: p.full_name, sub: getRoleLabel(p.professional_type) }));
      const pats = ((adminPatients as { data?: { user_id: string; full_name: string }[] } | undefined)?.data || [])
        .map((p) => ({ userId: p.user_id, name: p.full_name, sub: 'Patient' }));
      return [...profs, ...pats];
    }
    if (isPatient) {
      return (professionals || []).map((p) => ({
        userId: p.user_id, name: p.full_name, sub: getRoleLabel(p.professional_type),
      }));
    }
    return (patientsPage?.data || []).map((p) => ({
      userId: p.user_id, name: p.full_name, sub: p.condition || 'Patient',
    }));
  }, [isAdmin, isPatient, professionals, patientsPage, adminProfs, adminPatients]);

  const contactById = useMemo(() => {
    const m = new Map<string, Contact>();
    contacts.forEach((c) => m.set(c.userId, c));
    return m;
  }, [contacts]);

  const { data: conversations, isLoading: loadingConvs } = useConversations();
  const { data: messagesData, isLoading: loadingMsgs } = useMessages(selectedConv || '', { page: 1, page_size: 50 });
  const { mutateAsync: sendMessage, isPending: sending } = useSendMessage(selectedConv || '');
  const { mutateAsync: startConversation, isPending: starting } = useStartConversation();
  const { mutateAsync: assignProfessional, isPending: connecting } = useAssignProfessional();

  const adminProfList = ((adminProfs as { data?: { user_id: string; full_name: string; professional_type: string }[] } | undefined)?.data) || [];
  const doConnect = async () => {
    if (!connectEmail.trim() || !connectProf) { toast.error('Enter the patient email and pick a professional'); return; }
    const prof = adminProfList.find((p) => p.user_id === connectProf);
    try {
      await assignProfessional({
        patient_email: connectEmail.trim(),
        professional_id: connectProf,
        role: prof?.professional_type || 'physiotherapist',
      });
      toast.success('Patient connected to professional');
      setConnectEmail(''); setConnectProf('');
    } catch (e) {
      toast.error((e as Error).message || 'Could not connect — check the email is registered');
    }
  };
  const messages = messagesData?.data || [];

  // Resolve the "other participant" of a conversation and their display name.
  const otherOf = (conv: Conversation): Contact => {
    const otherId = [conv.patient_id, conv.professional_id, conv.admin_id]
      .find((id) => id && id !== myId) || '';
    return contactById.get(otherId) || { userId: otherId, name: 'Conversation', sub: '' };
  };

  const activeConv = conversations?.find((c) => c.id === selectedConv);
  const activeOther = activeConv ? otherOf(activeConv) : null;

  const handleSend = async () => {
    if (!inputText.trim() || !selectedConv || sending) return;
    const text = inputText.trim();
    setInputText('');
    try { await sendMessage(text); } catch { setInputText(text); }
  };

  const handleStartWith = async (contact: Contact) => {
    try {
      const conv = await startConversation(contact.userId);
      setSelectedConv(conv.id);
      setComposing(false);
    } catch { /* surfaced by react-query */ }
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

  const q = search.trim().toLowerCase();
  const filteredConvs = (conversations || []).filter((c) =>
    !q || otherOf(c).name.toLowerCase().includes(q)
  );
  const filteredContacts = contacts.filter((c) =>
    !q || c.name.toLowerCase().includes(q)
  );

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-56px)] md:h-screen flex overflow-hidden bg-white">
        {/* Sidebar */}
        <div className={cn('w-full md:w-80 flex-shrink-0 border-r border-slate-100 flex flex-col', selectedConv && 'hidden md:flex')}>
          <div className="px-4 py-4 border-b border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h1 className="font-display font-bold text-slate-900 text-lg">Messages</h1>
              <button
                onClick={() => setComposing((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg dynax-gradient text-white text-xs font-semibold hover:opacity-90"
              >
                {composing ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                {composing ? 'Close' : 'New'}
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder={composing ? 'Search contacts…' : 'Search…'}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-100 text-sm focus:outline-none" />
            </div>
          </div>

          {/* Compose: pick a connected contact to start a chat */}
          {composing ? (
            <div className="flex-1 overflow-y-auto">
              {isAdmin && (
                <div className="m-3 p-3 rounded-xl border border-indigo-100 bg-indigo-50/60 space-y-2">
                  <p className="text-xs font-semibold text-indigo-900">Connect a patient to a professional</p>
                  <input
                    value={connectEmail}
                    onChange={(e) => setConnectEmail(e.target.value)}
                    placeholder="Patient email"
                    className="w-full px-3 py-2 rounded-lg border border-indigo-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                  <select
                    value={connectProf}
                    onChange={(e) => setConnectProf(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-indigo-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  >
                    <option value="">Select professional…</option>
                    {adminProfList.map((p) => (
                      <option key={p.user_id} value={p.user_id}>{p.full_name} · {getRoleLabel(p.professional_type)}</option>
                    ))}
                  </select>
                  <button
                    onClick={doConnect}
                    disabled={connecting}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Connect via DX-PIN
                  </button>
                  <p className="text-[11px] text-indigo-700/70 leading-snug">
                    Ask the patient for the email they registered with, pick the professional, and connect — they&apos;ll both be notified.
                  </p>
                </div>
              )}
              <p className="px-4 pt-3 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {isAdmin ? 'Professionals & patients' : isPatient ? 'Your care team' : 'Your patients'}
              </p>
              {filteredContacts.length > 0 ? (
                filteredContacts.map((c) => (
                  <button key={c.userId} onClick={() => handleStartWith(c)} disabled={starting}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-50 disabled:opacity-60">
                    <div className="w-10 h-10 rounded-full dynax-gradient flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-semibold text-sm">{c.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{c.name}</p>
                      <p className="text-xs text-slate-500 truncate">{c.sub}</p>
                    </div>
                    {starting && <Loader2 className="w-4 h-4 animate-spin text-slate-400 ml-auto" />}
                  </button>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <MessageSquare className="w-10 h-10 text-slate-300 mb-3" />
                  <p className="text-slate-500 text-sm font-medium">
                    {isAdmin ? 'No professionals or patients yet' : isPatient ? 'No connected professionals' : 'No connected patients'}
                  </p>
                  <p className="text-slate-400 text-xs mt-1">
                    {isPatient
                      ? 'Connect with a professional using their DX-PIN first.'
                      : 'Patients appear here once they connect with your code.'}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {loadingConvs ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
              ) : filteredConvs.length > 0 ? (
                filteredConvs.map((conv) => (
                  <ConvItem key={conv.id} conv={conv} other={otherOf(conv)} isSelected={selectedConv === conv.id}
                    onClick={() => setSelectedConv(conv.id)} fmtTime={fmtTime} />
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <MessageSquare className="w-10 h-10 text-slate-300 mb-3" />
                  <p className="text-slate-500 text-sm font-medium">No conversations yet</p>
                  <p className="text-slate-400 text-xs mt-1">Tap “New” to start a chat with someone on your care team.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Chat */}
        <div className={cn('flex-1 flex flex-col', !selectedConv && 'hidden md:flex')}>
          {selectedConv ? (
            <>
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3 bg-white">
                <button onClick={() => setSelectedConv(null)} className="md:hidden text-slate-500 mr-1">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="w-9 h-9 rounded-full dynax-gradient flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-semibold text-sm">
                    {(activeOther?.name || 'C').charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-slate-900 truncate">{activeOther?.name || 'Conversation'}</p>
                  <p className="text-xs text-slate-400 truncate">{activeOther?.sub || 'Active'}</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => setCallMode('audio')}
                    title="Start audio call"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-semibold transition-colors"
                  >
                    <Phone className="w-4 h-4" /> Audio
                  </button>
                  <button
                    onClick={() => setCallMode('video')}
                    title="Start video call"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-xs font-semibold transition-colors"
                  >
                    <Video className="w-4 h-4" /> Video
                  </button>
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
                              <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
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
              <p className="text-slate-500 text-sm max-w-xs">Select a conversation, or tap “New” to message someone on your care team.</p>
            </div>
          )}
        </div>
      </div>

      {callMode && selectedConv && (
        <VideoCall
          roomId={selectedConv}
          audioOnly={callMode === 'audio'}
          displayName={(me as { full_name?: string } | undefined)?.full_name || activeOther?.name || 'DynaX user'}
          subject={activeOther?.name ? `Call with ${activeOther.name}` : (callMode === 'audio' ? 'Audio call' : 'Video call')}
          onClose={() => setCallMode(null)}
        />
      )}
    </DashboardLayout>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div className="flex justify-center items-center h-96"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
      </DashboardLayout>
    }>
      <MessagesInner />
    </Suspense>
  );
}

function ConvItem({ conv, other, isSelected, onClick, fmtTime }: {
  conv: Conversation; other: Contact; isSelected: boolean; onClick: () => void; fmtTime: (ts?: string) => string;
}) {
  return (
    <button onClick={onClick}
      className={cn('w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-50',
        isSelected && 'bg-blue-50 border-l-2 border-l-blue-500')}>
      <div className="relative flex-shrink-0">
        <div className="w-11 h-11 rounded-full dynax-gradient flex items-center justify-center">
          <span className="text-white font-semibold text-sm">{(other.name || 'C').charAt(0).toUpperCase()}</span>
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
            {other.name || 'Conversation'}
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
