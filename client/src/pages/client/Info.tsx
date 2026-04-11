import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ClientInfo() {
  const sections: Array<{
    title: string;
    body: string[];
    className?: string;
  }> = [
    {
      title: "Session view",
      body: [
        "Each session shows the exercises for that day, with sets, reps, tempo, and any notes you need to follow.",
      ],
    },
    {
      title: "Sets and reps",
      body: [
        "Sets tell you how many rounds to complete. Reps tell you how many repetitions to do in each round.",
      ],
    },
    {
      title: "Tempo",
      className: "md:col-span-2",
      body: [
        "Tempo tells you how fast to move through each rep. It is written in four parts: lowering phase, pause at the bottom, lifting phase, pause at the top.",
        "Eccentric means the lowering phase of the movement. 0 means no pause. X means move as fast as possible with control.",
        "Example: 31X1 = 3 seconds down, 1 second pause at the bottom, up fast with control, 1 second pause at the top.",
      ],
    },
    {
      title: "Session notes",
      body: [
        "Use Session notes to log your reps, weight, effort, and any quick notes after the session.",
      ],
    },
    {
      title: "Movement checks",
      body: [
        "Movement checks are short video submissions used to review movement quality before you move on.",
      ],
    },
    {
      title: "Progress updates",
      body: [
        "Progress updates are used to show how the plan is going and capture your progress over time.",
      ],
    },
    {
      title: "Goals",
      body: [
        "Your goals help connect the work in the app to what you are trying to improve.",
      ],
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in">
      <div>
        <h1 className="text-3xl font-display font-bold text-slate-900 tracking-tight">Guide</h1>
        <p className="text-slate-500 mt-1">Quick reference for using your plan in the app.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sections.map((section) => (
          <Card
            key={section.title}
            className={`border-slate-200 shadow-sm bg-white rounded-2xl ${section.className ?? ""}`}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{section.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0 text-sm leading-relaxed text-slate-600">
              {section.body.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
