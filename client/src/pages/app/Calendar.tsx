import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { calendarData } from "@/lib/mock-data";
import { Plus, ChevronLeft, ChevronRight, Clock, Users } from "lucide-react";

export default function Calendar() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Calendar</h1>
          <p className="text-slate-500">Schedule events and track meetings.</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> New Event
        </Button>
      </div>

      <div className="flex gap-6 flex-col xl:flex-row">
        {/* Left side: List view */}
        <div className="xl:w-1/3 space-y-4">
          <Card className="border-none shadow-sm bg-white">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Upcoming Events</h3>
              <Button variant="ghost" size="sm" className="h-8 text-indigo-600 text-xs">View All</Button>
            </div>
            <CardContent className="p-0">
              <div className="divide-y border-slate-100">
                {calendarData.map(event => (
                  <div key={event.id} className="p-4 hover:bg-slate-50 transition-colors">
                    <div className="text-xs font-semibold text-indigo-600 mb-1">
                      {new Date(event.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </div>
                    <h4 className="font-medium text-slate-900 mb-2">{event.title}</h4>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> {event.time}
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" /> {event.participants.length}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right side: Mock Month View */}
        <Card className="flex-1 border-none shadow-sm bg-white overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between bg-slate-50/50">
            <h2 className="text-lg font-display font-semibold text-slate-800">March 2026</h2>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8 bg-white"><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" className="h-8 bg-white">Today</Button>
              <Button variant="outline" size="icon" className="h-8 w-8 bg-white"><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="grid grid-cols-7 border-b border-slate-100">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="py-2 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider border-r last:border-r-0">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 auto-rows-fr bg-slate-100 gap-px">
            {/* Mock calendar grid - 35 cells */}
            {Array.from({ length: 35 }).map((_, i) => {
              const date = i - 2; // Offset for mock start day
              const isCurrentMonth = date > 0 && date <= 31;
              const hasEvent = date === 15 || date === 22; // Mock event days
              
              return (
                <div key={i} className={`min-h-[100px] p-2 bg-white ${!isCurrentMonth ? 'opacity-40 bg-slate-50' : ''}`}>
                  <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${date === 15 ? 'bg-indigo-600 text-white' : 'text-slate-700'}`}>
                    {isCurrentMonth ? date : (date <= 0 ? 28 + date : date - 31)}
                  </div>
                  
                  {hasEvent && isCurrentMonth && (
                    <div className="mt-1 px-1.5 py-1 text-[10px] leading-tight rounded bg-indigo-50 text-indigo-700 font-medium truncate border border-indigo-100">
                      10:00 AM Sync
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
