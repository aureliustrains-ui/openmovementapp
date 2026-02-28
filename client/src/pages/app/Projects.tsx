import { useState } from "react";
import { projectsData } from "@/lib/mock-data";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Filter, MoreHorizontal, Calendar as CalIcon } from "lucide-react";

export default function Projects() {
  const [search, setSearch] = useState("");

  const filteredProjects = projectsData.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Projects</h1>
          <p className="text-slate-500">Manage and track your team's initiatives.</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> New Project
        </Button>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            type="search" 
            placeholder="Search projects..." 
            className="w-full pl-9 bg-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant="outline" className="bg-white">
          <Filter className="mr-2 h-4 w-4" /> Filter
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProjects.map(project => (
          <Card key={project.id} className="border-none shadow-sm hover:shadow-md transition-shadow cursor-pointer bg-white group">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg">
                  {project.name.charAt(0)}
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </div>
              
              <h3 className="font-display font-semibold text-lg text-slate-900 mb-1">{project.name}</h3>
              <p className="text-sm text-slate-500 mb-6">Led by {project.assignee}</p>
              
              <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                <Badge variant="secondary" className={
                  project.status === 'Completed' ? 'bg-green-100 text-green-700 hover:bg-green-200' :
                  project.status === 'In Progress' ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' :
                  'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }>
                  {project.status}
                </Badge>
                
                <div className="flex items-center text-xs text-slate-500 font-medium">
                  <CalIcon className="mr-1 h-3.5 w-3.5" />
                  {new Date(project.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
