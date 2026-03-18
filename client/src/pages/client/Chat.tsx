import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { messagesQuery, useSendMessage, useMarkChatRead } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getChatDisplayFirstName } from "@/lib/chatDisplayName";
import { getClientCounterpartDisplayName } from "@/lib/counterpartDisplayName";

type ChatProfilePreview = {
  name: string;
  avatar: string | null;
  bio: string | null;
  height: string | null;
  weight: string | null;
};

function formatTime(t: string) {
  if (t.includes("T") || t.includes("Z")) {
    try { return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return t; }
  }
  return t;
}

export default function ClientChat() {
  const counterpartName = getClientCounterpartDisplayName();
  const [message, setMessage] = useState("");
  const [profilePreview, setProfilePreview] = useState<ChatProfilePreview | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { sessionUser, viewedUser } = useAuth();
  const chatClientId = sessionUser?.role === "Client" ? sessionUser.id : viewedUser?.id;

  const { data: chatMessages = [], isLoading } = useQuery({
    ...messagesQuery(chatClientId || ""),
    enabled: !!chatClientId,
    refetchInterval: 5000,
  });
  const sendMessage = useSendMessage();
  const markRead = useMarkChatRead();

  useEffect(() => {
    if (sessionUser && chatClientId) {
      markRead.mutate({ userId: sessionUser.id, clientId: chatClientId });
    }
  }, [sessionUser?.id, chatClientId]);

  const submitMessage = () => {
    if (!message.trim() || !chatClientId) return;
    sendMessage.mutate({
      clientId: chatClientId,
      text: message,
    });
    setMessage("");
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    submitMessage();
  };

  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter") return;
    if (e.shiftKey) return;
    if (e.nativeEvent.isComposing) return;
    e.preventDefault();
    submitMessage();
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  if (!sessionUser || !chatClientId) return null;

  const openProfilePreview = (msg: any) => {
    const senderDisplayName = getChatDisplayFirstName(msg);
    setProfilePreview({
      name: senderDisplayName,
      avatar: msg?.senderProfile?.avatar ?? msg?.senderAvatar ?? null,
      bio: msg?.senderProfile?.bio ?? null,
      height: msg?.senderProfile?.height ?? null,
      weight: msg?.senderProfile?.weight ?? null,
    });
  };

  const previewInitials = (profilePreview?.name || "U")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-8rem)] flex flex-col animate-in fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold text-slate-900 tracking-tight" data-testid="text-chat-title">Chat</h1>
        <p className="text-slate-500 mt-1">Ask questions, share updates, or discuss your form.</p>
      </div>

      <Card className="flex-1 flex flex-col border-slate-200 shadow-sm overflow-hidden bg-white rounded-2xl">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--color-brand-600)]" />
            </div>
          ) : (
            chatMessages.map((msg: any) => {
              const isClientMessage = Boolean(msg.isClient);
              const senderDisplayName = getChatDisplayFirstName(msg);
              const senderInitial = senderDisplayName.charAt(0) || "U";
              const roleLabel = isClientMessage ? "You" : counterpartName;
              return (
                <div key={msg.id} className={`flex gap-4 ${isClientMessage ? 'flex-row-reverse' : ''}`}>
                <button
                  type="button"
                  onClick={() => openProfilePreview(msg)}
                  className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-600)] focus-visible:ring-offset-2"
                  data-testid={`button-open-chat-profile-${msg.id}`}
                >
                  <Avatar className="h-10 w-10 shrink-0 border border-slate-100 shadow-sm">
                    <AvatarImage src={msg.senderAvatar || undefined} alt={senderDisplayName || undefined} />
                    <AvatarFallback className={isClientMessage ? "bg-[var(--color-brand-100)] text-[var(--color-brand-600)]" : "bg-slate-100 text-slate-700"}>
                      {senderInitial}
                    </AvatarFallback>
                  </Avatar>
                </button>
                <div className={`flex flex-col ${isClientMessage ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        isClientMessage
                          ? "bg-[var(--color-brand-100)] text-[var(--color-brand-600)]"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {roleLabel}
                    </span>
                    <span className="text-xs text-slate-500">{formatTime(msg.time)}</span>
                  </div>
                  <div className={`text-sm leading-relaxed whitespace-pre-wrap break-words p-4 rounded-2xl max-w-md ${
                    isClientMessage
                      ? "rounded-br-md border border-slate-300 bg-slate-100 text-slate-900"
                      : "rounded-bl-md border border-slate-200 bg-white text-slate-800"
                  }`}>
                    {msg.text}
                  </div>
                </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <form className="relative" onSubmit={handleSend}>
            <Textarea
              placeholder={`Message ${counterpartName}...`}
              className="w-full min-h-[56px] max-h-44 resize-none pr-12 rounded-xl bg-white border-slate-200 focus-visible:ring-[var(--color-brand-600)] shadow-sm"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleComposerKeyDown}
              data-testid="input-chat-message"
            />
            <Button 
              type="submit" 
              size="icon" 
              className="absolute right-2 bottom-2 h-9 w-9 rounded-lg border-slate-900 bg-slate-900 text-white hover:bg-slate-800 disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-500 shadow-sm"
              data-testid="button-send-message"
            >
              <Send className="h-4 w-4 text-white" />
            </Button>
          </form>
        </div>
      </Card>

      <Dialog open={!!profilePreview} onOpenChange={(open) => !open && setProfilePreview(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Profile</DialogTitle>
          </DialogHeader>
          {profilePreview && (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3">
                <Avatar className="h-24 w-24 border border-slate-200">
                  <AvatarImage src={profilePreview.avatar || undefined} alt={profilePreview.name} />
                  <AvatarFallback className="bg-[var(--color-brand-100)] text-[var(--color-brand-600)] text-lg font-semibold">
                    {previewInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="text-center">
                  <p className="text-lg font-semibold text-slate-900">{profilePreview.name}</p>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Bio</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-700">
                  {profilePreview.bio?.trim() ? profilePreview.bio : "No bio added yet."}
                </p>
              </div>
              {(profilePreview.height || profilePreview.weight) && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-slate-200 bg-white p-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Height</p>
                    <p className="text-sm text-slate-800">{profilePreview.height || "—"}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Weight</p>
                    <p className="text-sm text-slate-800">{profilePreview.weight || "—"}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
