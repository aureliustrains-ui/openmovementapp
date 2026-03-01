import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info as InfoIcon, FileText, ShieldAlert, Zap } from "lucide-react";

export default function ClientInfo() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in">
      <div>
        <h1 className="text-3xl font-display font-bold text-slate-900 tracking-tight">Information & Rules</h1>
        <p className="text-slate-500 mt-1">Everything you need to know about your training program.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow bg-white rounded-2xl overflow-hidden">
          <div className="bg-indigo-50/50 border-b border-indigo-100 p-6 flex items-center gap-4">
            <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
              <Zap className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl">Training Philosophy</CardTitle>
          </div>
          <CardContent className="p-6 text-slate-600 leading-relaxed space-y-4">
            <p>Consistency over intensity. Show up, do the work, and the results will follow.</p>
            <p>Always prioritize form over load. If you can't hit the target reps with good form, lower the weight.</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow bg-white rounded-2xl overflow-hidden">
          <div className="bg-emerald-50/50 border-b border-emerald-100 p-6 flex items-center gap-4">
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
              <FileText className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl">Logging Expectations</CardTitle>
          </div>
          <CardContent className="p-6 text-slate-600 leading-relaxed space-y-4">
            <p>Log your weights and reps for every working set. Warm-ups are optional but recommended.</p>
            <p>Use the RPE (Rate of Perceived Exertion) scale honestly. This helps us adjust your program dynamically.</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow bg-white rounded-2xl overflow-hidden md:col-span-2">
          <div className="bg-amber-50/50 border-b border-amber-100 p-6 flex items-center gap-4">
            <div className="p-3 bg-amber-100 text-amber-600 rounded-xl">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl">Movement Checks</CardTitle>
          </div>
          <CardContent className="p-6 text-slate-600 leading-relaxed space-y-4">
            <p>Certain exercises require a form check before you can proceed. Record a side-angle video showing your full body.</p>
            <p>Ensure good lighting and avoid wearing overly baggy clothing so your joints and posture are visible.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
