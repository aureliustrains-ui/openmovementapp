import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { messagesQuery, useMarkChatRead, useSendMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, MessageCircle, Send } from "lucide-react";
import { getClientCounterpartDisplayName } from "@/lib/counterpartDisplayName";

function formatMessageTime(value: string): string {
  if (value.includes("T") || value.includes("Z")) {
    try {
      return new Date(value).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return value;
    }
  }
  return value;
}

export function HomeChatCard() {
  const { sessionUser, viewedUser } = useAuth();
  const counterpartName = getClientCounterpartDisplayName();
  const [message, setMessage] = useState("");
  const chatClientId = sessionUser?.role === "Client" ? sessionUser.id : viewedUser?.id;

  const { data: chatMessages = [], isLoading } = useQuery({
    ...messagesQuery(chatClientId || ""),
    enabled: !!chatClientId,
    refetchInterval: 5000,
  });
  const sendMessage = useSendMessage();
  const markRead = useMarkChatRead();

  useEffect(() => {
    if (!sessionUser || !chatClientId) return;
    markRead.mutate({ userId: sessionUser.id, clientId: chatClientId });
  }, [sessionUser?.id, chatClientId]);

  if (!sessionUser || !chatClientId) return null;

  const recentMessages = chatMessages.slice(-4);
  const canSend = message.trim().length > 0;

  const submitMessage = () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    sendMessage.mutate({
      clientId: chatClientId,
      text: trimmed,
    });
    setMessage("");
  };

  return (
    <Card className="border-slate-200 shadow-sm rounded-2xl bg-white overflow-hidden">
      <CardHeader className="border-b border-slate-100 bg-slate-50/40 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-slate-600" />
            <CardTitle className="text-base">Chat with {counterpartName}</CardTitle>
          </div>
          <Link href="/app/client/chat" className="text-xs font-medium text-slate-600 hover:text-slate-900">
            Open chat
          </Link>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        <div className="max-h-[220px] overflow-y-auto space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-slate-700" />
            </div>
          ) : recentMessages.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              No messages yet. Start the conversation.
            </div>
          ) : (
            recentMessages.map((entry: any) => {
              const isClientMessage = Boolean(entry.isClient);
              const senderLabel = isClientMessage ? "You" : counterpartName;
              return (
                <div key={entry.id} className={`flex ${isClientMessage ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`w-[90%] max-w-[290px] rounded-2xl border p-2.5 text-sm ${
                      isClientMessage
                        ? "rounded-br-md border-slate-300 bg-slate-100 text-slate-900"
                        : "rounded-bl-md border-slate-200 bg-white text-slate-800"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-slate-600">{senderLabel}</span>
                      <span className="text-[11px] text-slate-500">
                        {formatMessageTime(entry.time)}
                      </span>
                    </div>
                    <p className="leading-relaxed whitespace-pre-wrap break-words">{entry.text}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            submitMessage();
          }}
        >
          <Input
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={`Message ${counterpartName}...`}
            className="h-9 border-slate-200 focus-visible:ring-slate-400"
            data-testid="input-home-chat-message"
          />
          <Button
            type="submit"
            size="icon"
            className="h-9 w-9 rounded-lg border-slate-900 bg-slate-900 text-white hover:bg-slate-800 disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-500"
            disabled={!canSend || sendMessage.isPending}
            data-testid="button-home-chat-send"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
