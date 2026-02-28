import { useState } from "react";
import { messagesData, usersData } from "@/lib/mock-data";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Hash, Send, Plus, Search } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function Messages() {
  const [activeChannel, setActiveChannel] = useState("general");
  const [message, setMessage] = useState("");

  const channels = ["general", "design", "engineering", "marketing"];
  const channelMessages = messagesData.filter(m => m.channel === activeChannel) || [];

  return (
    <div className="h-[calc(100vh-8rem)] bg-white rounded-xl shadow-sm border border-slate-200 flex overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 border-r border-slate-200 bg-slate-50 flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input type="search" placeholder="Jump to..." className="w-full pl-9 h-9 text-sm" />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-6">
          <div>
            <div className="flex items-center justify-between px-2 mb-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Channels</h3>
              <Button variant="ghost" size="icon" className="h-5 w-5 text-slate-500">
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <div className="space-y-1">
              {channels.map(c => (
                <button
                  key={c}
                  onClick={() => setActiveChannel(c)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    activeChannel === c ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-200/50'
                  }`}
                >
                  <Hash className="h-4 w-4 opacity-70" />
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between px-2 mb-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Direct Messages</h3>
              <Button variant="ghost" size="icon" className="h-5 w-5 text-slate-500">
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <div className="space-y-1">
              {usersData.map(u => (
                <button
                  key={u.id}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm font-medium text-slate-600 hover:bg-slate-200/50 transition-colors"
                >
                  <div className="relative">
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="text-[10px]">{u.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-500 border border-white" />
                  </div>
                  <span className="truncate">{u.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Chat Header */}
        <div className="h-14 border-b border-slate-200 flex items-center px-6">
          <h2 className="font-display font-semibold text-slate-900 flex items-center gap-2">
            <Hash className="h-5 w-5 text-slate-400" />
            {activeChannel}
          </h2>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="text-center text-sm text-slate-500 my-4">
            This is the start of the #{activeChannel} channel.
          </div>
          
          {channelMessages.map(msg => (
            <div key={msg.id} className="flex gap-4">
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarFallback>{msg.sender.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-slate-900 text-sm">{msg.sender}</span>
                  <span className="text-xs text-slate-500">{msg.time}</span>
                </div>
                <div className="mt-1 text-slate-700 text-sm leading-relaxed">
                  {msg.content}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-slate-200">
          <form className="relative flex items-center" onSubmit={e => e.preventDefault()}>
            <Input 
              placeholder={`Message #${activeChannel}`} 
              className="w-full pr-12 py-6 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-indigo-500 shadow-sm"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <Button 
              type="submit" 
              size="icon" 
              className="absolute right-2 h-9 w-9 rounded-lg bg-indigo-600 hover:bg-indigo-700"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
