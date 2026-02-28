import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Box, Plus, Users, CheckCircle2 } from "lucide-react";

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const nextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) {
      setStep(step + 1);
    } else {
      setLoading(true);
      setTimeout(() => {
        setLocation("/app/dashboard");
      }, 1000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl w-full space-y-8 bg-white p-10 rounded-3xl shadow-xl border border-slate-100">
        <div className="text-center mb-8">
          <Box className="mx-auto h-12 w-12 text-indigo-600 mb-4" />
          <div className="flex justify-center gap-2 mb-6">
            {[1, 2, 3].map((s) => (
              <div 
                key={s} 
                className={`h-2 w-12 rounded-full ${s <= step ? 'bg-indigo-600' : 'bg-slate-200'}`}
              />
            ))}
          </div>
          <h2 className="text-3xl font-display font-bold text-slate-900">
            {step === 1 && "Create your workspace"}
            {step === 2 && "Invite your team"}
            {step === 3 && "You're all set!"}
          </h2>
          <p className="mt-2 text-slate-600">
            {step === 1 && "This is where your team will collaborate."}
            {step === 2 && "Nexus is better with teammates."}
            {step === 3 && "Let's start doing some great work."}
          </p>
        </div>

        <form onSubmit={nextStep} className="space-y-6">
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
              <div className="space-y-2">
                <Label htmlFor="workspaceName">Workspace Name</Label>
                <Input id="workspaceName" placeholder="Acme Corp" required autoFocus />
              </div>
              <div className="space-y-2">
                <Label>Workspace Logo (Optional)</Label>
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center text-slate-500 hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer">
                  <Plus className="h-8 w-8 mb-2 text-slate-400" />
                  <span className="text-sm font-medium">Upload logo</span>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
              <div className="space-y-2">
                <Label>Email addresses</Label>
                <div className="space-y-3">
                  <Input placeholder="colleague@example.com" autoFocus />
                  <Input placeholder="another@example.com" />
                  <Input placeholder="manager@example.com" />
                </div>
              </div>
              <Button type="button" variant="outline" className="w-full border-dashed">
                <Users className="mr-2 h-4 w-4" /> Get invite link instead
              </Button>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col items-center py-8 animate-in fade-in zoom-in-95">
              <div className="h-24 w-24 rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-6">
                <CheckCircle2 className="h-12 w-12" />
              </div>
              <p className="text-center text-slate-600 max-w-sm">
                Your workspace "Acme Corp" has been created and your invitations have been sent.
              </p>
            </div>
          )}

          <div className="pt-4 flex gap-4">
            {step > 1 && (
              <Button type="button" variant="ghost" onClick={() => setStep(step - 1)} className="w-full">
                Back
              </Button>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {step < 3 ? "Continue" : (loading ? "Entering Workspace..." : "Go to Dashboard")}
            </Button>
          </div>
          
          {step === 2 && (
            <div className="text-center">
              <button type="button" onClick={() => setStep(3)} className="text-sm text-slate-500 hover:text-slate-800">
                Skip for now
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
