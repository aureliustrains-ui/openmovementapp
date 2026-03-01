import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, Activity, CheckCircle2 } from "lucide-react";

export default function AdminAnalytics() {
  return (
    <div className="space-y-8 animate-in fade-in max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-display font-bold text-slate-900 tracking-tight">Analytics</h1>
        <p className="text-slate-500 mt-1">High-level view of roster engagement and performance.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-none shadow-sm bg-white rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Active Clients</CardTitle>
            <Activity className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">2</div>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-sm bg-white rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Adherence</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">85%</div>
            <p className="text-xs text-green-600 flex items-center mt-1">
              <TrendingUp className="h-3 w-3 mr-1" /> +5% from last week
            </p>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-sm bg-white rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Sessions Completed</CardTitle>
            <BarChart3 className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">14</div>
            <p className="text-xs text-slate-500 mt-1">This month</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-slate-200 shadow-sm bg-white rounded-2xl">
          <CardHeader className="border-b border-slate-100">
            <CardTitle>Client Adherence Board</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
             <div className="divide-y divide-slate-100">
               <div className="p-4 flex items-center justify-between">
                 <div>
                   <div className="font-semibold text-slate-900">John Smith</div>
                   <div className="text-sm text-slate-500">Strength Prep</div>
                 </div>
                 <div className="text-right">
                    <div className="font-bold text-green-600">100%</div>
                    <div className="text-xs text-slate-400">2/2 this week</div>
                 </div>
               </div>
               <div className="p-4 flex items-center justify-between">
                 <div>
                   <div className="font-semibold text-slate-900">Sarah Connor</div>
                   <div className="text-sm text-slate-500">Hypertrophy Block 1</div>
                 </div>
                 <div className="text-right">
                    <div className="font-bold text-amber-500">0%</div>
                    <div className="text-xs text-slate-400">Pending Movement Check</div>
                 </div>
               </div>
             </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm bg-white rounded-2xl flex flex-col items-center justify-center p-12 text-center text-slate-500">
            <TrendingUp className="h-12 w-12 text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900">Progression Charts</h3>
            <p className="max-w-sm mt-1">Track estimated 1RM and volume load over time once more data is collected.</p>
        </Card>
      </div>
    </div>
  );
}
