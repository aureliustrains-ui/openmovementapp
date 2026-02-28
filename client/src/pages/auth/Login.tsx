import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Box } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Mock login delay
    setTimeout(() => {
      setLoading(false);
      toast({ title: "Welcome back!" });
      setLocation("/app/dashboard");
    }, 1000);
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div className="flex items-center gap-2 mb-8">
            <Box className="h-8 w-8 text-indigo-600" />
            <span className="font-display font-bold text-2xl">Nexus</span>
          </div>

          <h2 className="mt-6 text-3xl font-display font-bold tracking-tight text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Don't have an account?{' '}
            <Link href="/signup">
              <a className="font-medium text-indigo-600 hover:text-indigo-500">Sign up today</a>
            </Link>
          </p>

          <div className="mt-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-1">
                <Label htmlFor="email">Email address</Label>
                <Input id="email" type="email" required defaultValue="alex@example.com" />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <div className="text-sm">
                    <Link href="/reset-password">
                      <a className="font-medium text-indigo-600 hover:text-indigo-500">
                        Forgot your password?
                      </a>
                    </Link>
                  </div>
                </div>
                <Input id="password" type="password" required defaultValue="password" />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign in"}
              </Button>
            </form>
            
            <div className="mt-6 text-center text-sm text-slate-500">
              <p>Demo Credentials: alex@example.com / password</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Right side artistic panel */}
      <div className="hidden lg:block relative w-0 flex-1 bg-slate-900">
        <div className="absolute inset-0 flex flex-col justify-center px-16 text-white overflow-hidden">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-cyan-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
          
          <h2 className="text-4xl font-display font-bold z-10 relative">Build faster, together.</h2>
          <p className="mt-4 text-xl text-slate-300 max-w-lg z-10 relative">
            Join thousands of teams who have transformed how they work with Nexus.
          </p>
          
          <div className="mt-12 grid grid-cols-2 gap-8 z-10 relative">
            <div className="border border-slate-700 bg-slate-800/50 p-6 rounded-2xl backdrop-blur-sm">
              <h3 className="font-bold text-2xl mb-1">99.9%</h3>
              <p className="text-slate-400">Uptime SLA</p>
            </div>
            <div className="border border-slate-700 bg-slate-800/50 p-6 rounded-2xl backdrop-blur-sm">
              <h3 className="font-bold text-2xl mb-1">2M+</h3>
              <p className="text-slate-400">Tasks Completed</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
