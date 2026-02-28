import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { currentUser, currentWorkspace } from "@/lib/mock-data";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function Settings() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500">Manage your profile and workspace preferences.</p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="bg-slate-100 p-1 rounded-lg w-full justify-start overflow-x-auto">
          <TabsTrigger value="profile" className="rounded-md">My Profile</TabsTrigger>
          <TabsTrigger value="workspace" className="rounded-md">Workspace</TabsTrigger>
          <TabsTrigger value="notifications" className="rounded-md">Notifications</TabsTrigger>
          <TabsTrigger value="billing" className="rounded-md">Billing & Plan</TabsTrigger>
        </TabsList>
        
        <div className="mt-6">
          <TabsContent value="profile" className="space-y-6 m-0">
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your personal details here.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-6">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={currentUser.avatar} />
                    <AvatarFallback>{currentUser.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <Button variant="outline">Change Avatar</Button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" defaultValue={currentUser.name} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input id="email" defaultValue={currentUser.email} disabled />
                  </div>
                </div>
                <Button>Save Changes</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="workspace" className="space-y-6 m-0">
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle>Workspace Settings</CardTitle>
                <CardDescription>Manage the active workspace.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2 max-w-md">
                  <Label htmlFor="ws-name">Workspace Name</Label>
                  <Input id="ws-name" defaultValue={currentWorkspace.name} />
                </div>
                <div className="space-y-2 max-w-md">
                  <Label htmlFor="ws-url">Workspace URL</Label>
                  <div className="flex">
                    <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-slate-200 bg-slate-50 text-slate-500 sm:text-sm">
                      nexus.app/
                    </span>
                    <Input id="ws-url" defaultValue="acme" className="rounded-l-none" />
                  </div>
                </div>
                <Button>Save Workspace</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6 m-0">
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Choose what we update you about.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  {[
                    { title: "Email Notifications", desc: "Receive daily summaries of your tasks." },
                    { title: "Push Notifications", desc: "Get instantly alerted for direct messages." },
                    { title: "Marketing Emails", desc: "Hear about new features and updates." }
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-lg border border-slate-100 bg-slate-50/50">
                      <div>
                        <div className="font-medium text-slate-900">{item.title}</div>
                        <div className="text-sm text-slate-500">{item.desc}</div>
                      </div>
                      <Switch defaultChecked={i !== 2} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="billing" className="space-y-6 m-0">
            <Card className="border-none shadow-sm overflow-hidden">
              <div className="bg-indigo-600 p-8 text-white">
                <h3 className="text-2xl font-display font-bold mb-2">Pro Plan</h3>
                <p className="text-indigo-100 mb-6">You are currently on the Pro plan.</p>
                <div className="text-4xl font-bold mb-1">$29<span className="text-lg font-normal text-indigo-200">/user/mo</span></div>
              </div>
              <CardContent className="p-8">
                <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-6">
                  <div>
                    <div className="font-medium text-slate-900">Next billing date</div>
                    <div className="text-sm text-slate-500">April 1, 2026</div>
                  </div>
                  <Button variant="outline">Manage Subscription</Button>
                </div>
                <div>
                  <h4 className="font-medium text-slate-900 mb-4">Payment Method</h4>
                  <div className="flex items-center gap-4 p-4 rounded-lg border border-slate-200">
                    <div className="h-8 w-12 bg-slate-100 rounded border flex items-center justify-center font-bold text-xs">VISA</div>
                    <div className="flex-1">
                      <div className="font-medium">Visa ending in 4242</div>
                      <div className="text-xs text-slate-500">Expires 12/28</div>
                    </div>
                    <Button variant="ghost" size="sm">Edit</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
