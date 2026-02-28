import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { HelpCircle, Code, Paintbrush, Database } from "lucide-react";

export default function Help() {
  return (
    <MarketingLayout>
      <div className="pt-24 pb-32 bg-slate-50 min-h-[calc(100vh-4rem)]">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-16">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 mb-6">
              <HelpCircle className="h-8 w-8" />
            </div>
            <h1 className="text-4xl font-display font-bold text-slate-900 mb-4">How to extend this template</h1>
            <p className="text-xl text-slate-600">This mockup is designed to be easily turned into a real application.</p>
          </div>

          <div className="space-y-6">
            <Card className="border-none shadow-md">
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                  <Paintbrush className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle>Customizing Branding</CardTitle>
                  <CardDescription>Update colors and typography</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="text-slate-600 leading-relaxed">
                <p>To change the color scheme, edit the CSS variables in <code>client/src/index.css</code>. The primary color is currently Indigo. You can generate a new palette using HSL values.</p>
                <p className="mt-2">To change fonts, update the Google Fonts link in <code>client/index.html</code> and update the <code>--font-sans</code> and <code>--font-display</code> variables in your CSS.</p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md">
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="p-3 bg-green-100 text-green-600 rounded-lg">
                  <Database className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle>Graduating to a Full Stack App</CardTitle>
                  <CardDescription>Adding a real backend</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="text-slate-600 leading-relaxed">
                <p>Currently, this app uses mock data stored in <code>client/src/lib/mock-data.ts</code>. When you're happy with the design, you can ask Replit Agent to "Graduate to full-stack".</p>
                <p className="mt-2">This will unlock the <code>server/</code> folder, set up a PostgreSQL database using Drizzle ORM, and allow you to build real API endpoints.</p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md">
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="p-3 bg-purple-100 text-purple-600 rounded-lg">
                  <Code className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle>Extending Modules</CardTitle>
                  <CardDescription>Adding new features</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="text-slate-600 leading-relaxed">
                <p>To add a new module (like CRM or Analytics):</p>
                <ol className="list-decimal list-inside mt-2 space-y-1">
                  <li>Create a new page in <code>client/src/pages/app/</code></li>
                  <li>Add it to the routing in <code>client/src/App.tsx</code></li>
                  <li>Add a link to it in the sidebar in <code>client/src/components/layout/AppLayout.tsx</code></li>
                </ol>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
}
