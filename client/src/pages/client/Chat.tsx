import { useState } from "react";
import { chatsData, currentUser } from "@/lib/mock-data";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, MessageCircle } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function ClientChat() {
  const [message, setMessage] = useState("");
  
  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-8rem)] flex flex-col animate-in fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold text-slate-900 tracking-tight">Chat with Coach</h1>
        <p className="text-slate-500 mt-1">Ask questions, share updates, or discuss your form.</p>
      </div>

      <Card className="flex-1 flex flex-col border-slate-200 shadow-sm overflow-hidden bg-white rounded-2xl">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {chatsData.map(msg => (
            <div key={msg.id} className={`flex gap-4 ${msg.isClient ? 'flex-row-reverse' : ''}`}>
              <Avatar className="h-10 w-10 shrink-0 border border-slate-100 shadow-sm">
                <AvatarFallback className={msg.isClient ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-700'}>
                  {msg.sender.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className={`flex flex-col ${msg.isClient ? 'items-end' : 'items-start'}`}>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="font-semibold text-slate-900 text-sm">{msg.sender}</span>
                  <span className="text-xs text-slate-500">{msg.time}</span>
                </div>
                <div className={`text-sm leading-relaxed p-4 rounded-2xl max-w-md ${
                  msg.isClient 
                    ? 'bg-indigo-600 text-white rounded-tr-sm' 
                    : 'bg-slate-50 border border-slate-100 text-slate-700 rounded-tl-sm'
                }`}>
                  {msg.text}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <form className="relative flex items-center" onSubmit={e => e.preventDefault()}>
            <Input 
              placeholder="Message your coach..." 
              className="w-full pr-12 py-6 rounded-xl bg-white border-slate-200 focus-visible:ring-indigo-500 shadow-sm"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <Button 
              type="submit" 
              size="icon" 
              className="absolute right-2 h-9 w-9 rounded-lg bg-indigo-600 hover:bg-indigo-700 shadow-sm"
            >
              <Send className="h-4 w-4 text-white" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
