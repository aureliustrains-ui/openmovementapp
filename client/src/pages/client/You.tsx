import { Link } from "wouter";
import { ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ClientYou() {
  const { viewedUser } = useAuth();
  if (!viewedUser) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-in fade-in">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="border-slate-200 shadow-sm rounded-xl bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-600">Update your personal details and photo.</p>
            <Link href="/app/settings">
              <Button className="w-full" variant="secondaryDark">
                Open profile
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm rounded-xl bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Guide</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-600">Review key terms and how your training flow works.</p>
            <Link href="/app/client/info">
              <Button className="w-full" variant="secondaryDark">
                Open guide
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
