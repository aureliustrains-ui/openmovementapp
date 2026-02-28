import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { currentUser, projectsData, tasksData, messagesData } from "@/lib/mock-data";
import { CheckCircle2, Clock, MessageSquare, TrendingUp, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const pendingTasks = tasksData.filter(t => t.status !== 'Done');
  const recentMessages = messagesData.slice(-3);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Good morning, {currentUser.name.split(' ')[0]}</h1>
          <p className="text-slate-500">Here's what's happening in your workspace today.</p>
        </div>
        <Button>
          Create New Project
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Active Projects</CardTitle>
            <TrendingUp className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{projectsData.length}</div>
            <p className="text-xs text-green-600 flex items-center mt-1">
              <ArrowUpRight className="h-3 w-3 mr-1" /> +1 from last week
            </p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">My Tasks</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-cyan-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{pendingTasks.length}</div>
            <p className="text-xs text-slate-500 mt-1">2 due today</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Unread Messages</CardTitle>
            <MessageSquare className="h-4 w-4 text-pink-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">14</div>
            <p className="text-xs text-slate-500 mt-1">Across 3 channels</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Upcoming Events</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">2</div>
            <p className="text-xs text-slate-500 mt-1">Next: Team Sync (10:00 AM)</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tasks */}
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>My Tasks</CardTitle>
            <CardDescription>Tasks assigned to you across all projects</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingTasks.map(task => (
                <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-colors">
                  <div className={`mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                    task.status === 'In Progress' ? 'border-indigo-500 text-indigo-500' : 'border-slate-300'
                  }`}>
                    {task.status === 'In Progress' && <div className="h-2 w-2 rounded-full bg-indigo-500" />}
                  </div>
                  <div>
                    <p className="font-medium text-sm text-slate-900">{task.title}</p>
                    <p className="text-xs text-slate-500">Project: {projectsData.find(p => p.id === task.projectId)?.name}</p>
                  </div>
                </div>
              ))}
              <Button variant="ghost" className="w-full text-indigo-600 mt-2">View All Tasks</Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest updates in your workspace</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {recentMessages.map((msg, i) => (
                <div key={msg.id} className="flex gap-4 relative">
                  {i !== recentMessages.length - 1 && (
                    <div className="absolute left-4 top-10 bottom-[-16px] w-px bg-slate-200" />
                  )}
                  <div className="h-8 w-8 rounded-full bg-slate-100 flex-shrink-0 flex items-center justify-center text-slate-600 font-medium text-xs z-10">
                    {msg.sender.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm">
                      <span className="font-semibold text-slate-900">{msg.sender}</span> posted in <span className="font-medium text-indigo-600">#{msg.channel}</span>
                    </p>
                    <p className="text-sm text-slate-600 mt-1 bg-slate-50 p-3 rounded-r-lg rounded-bl-lg border border-slate-100">
                      {msg.content}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">{msg.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
