import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowRight, CheckCircle, Zap, Shield, Globe } from "lucide-react";
import heroImg from "@/assets/images/hero-bg.png";

export default function Landing() {
  return (
    <MarketingLayout>
      {/* Hero Section */}
      <section className="relative pt-24 pb-32 overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-slate-50">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white" />
        </div>
        
        <div className="container mx-auto px-4 text-center max-w-4xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-sm font-medium mb-6">
            <span className="flex h-2 w-2 rounded-full bg-indigo-600"></span>
            CoachingApp is live
          </div>
          <h1 className="text-5xl md:text-7xl font-display font-bold text-slate-900 tracking-tight mb-6">
            The operating system for <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-cyan-500">modern teams</span>
          </h1>
          <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            One unified platform for your projects, messages, calendar, and files. Stop switching between tabs and start doing your best work.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <Button size="lg" className="h-14 px-8 text-lg w-full sm:w-auto shadow-lg shadow-indigo-200">
                Start for free <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="h-14 px-8 text-lg w-full sm:w-auto">
                Book a demo
              </Button>
            </Link>
          </div>
        </div>

        <div className="container mx-auto px-4 mt-20">
          <div className="relative rounded-2xl border border-slate-200 shadow-2xl overflow-hidden bg-white max-w-5xl mx-auto">
            <img src={heroImg} alt="Dashboard Preview" className="w-full h-auto object-cover opacity-90" />
            <div className="absolute inset-0 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)] rounded-2xl pointer-events-none"></div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-slate-900 mb-4">Everything you need, nothing you don't.</h2>
            <p className="text-lg text-slate-600">Built with performance and simplicity in mind.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-10 max-w-5xl mx-auto">
            {[
              { title: "Lightning Fast", desc: "Built on modern web tech for a sub-100ms experience.", icon: Zap },
              { title: "Enterprise Security", desc: "Bank-level encryption and role-based access controls.", icon: Shield },
              { title: "Work Anywhere", desc: "Fully responsive and functional on any device.", icon: Globe },
            ].map((feature, i) => (
              <div key={i} className="p-6 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="h-12 w-12 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-6">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-display font-bold mb-3">{feature.title}</h3>
                <p className="text-slate-600">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
