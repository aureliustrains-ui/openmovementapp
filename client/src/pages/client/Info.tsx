import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ClientInfo() {
  const sections: Array<{
    title: string;
    body: string[];
    className?: string;
  }> = [
    {
      title: "Consistency",
      className: "md:col-span-2",
      body: [
        "Consistency is the most important rule of training.",
        "Progress usually does not come from one perfect session. It comes from showing up again and again over time. Even on difficult days, doing a minimum amount is often better than doing nothing.",
        "If you want to improve at something, you need to practice it consistently.",
        "Above all: be consistent.",
        "Avoid choices that hurt consistency: training too much or too hard, training with poor quality, changing goals or methods too often, or chasing new ideas while forgetting the basics.",
        "The best plan is the one you can follow well over time.",
        "If motivation, uncertainty, or problems come up, use Messages and ask for support.",
      ],
    },
    {
      title: "Goals",
      body: [
        "Goals show what we are trying to work toward in each movement.",
        "You can see them in the movement details inside the session. They help guide your effort and show what kind of progress we are looking for, for example more weight, more repetitions, longer holds, or better control.",
        "You do not need to achieve the goal immediately. That is normal. What matters is that you work toward it over time and keep trying to improve gradually.",
      ],
    },
    {
      title: "Sets and reps",
      body: [
        "Reps means repetitions. This tells you how many times you should perform the movement in one round of the exercise.",
        "Sets means rounds. This tells you how many times you repeat that number of repetitions.",
        "Example: 3 sets of 8 reps means do 8 repetitions, rest, then repeat for 3 total rounds.",
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
        "Use Session notes to log your reps, weight, effort, and quick notes after each session.",
      ],
    },
    {
      title: "Movement checks",
      body: [
        "Movement checks are short video submissions used to review movement quality before you move forward in your plan.",
      ],
    },
    {
      title: "Progress updates",
      body: [
        "Progress updates are used to show how the plan is going and capture your progress over time.",
      ],
    },
    {
      title: "Deload",
      body: [
        "Some sessions may be marked as deload sessions.",
        "A deload session usually has much lower volume than normal, sometimes around 40% of the usual volume. This is intentional and important to follow.",
        "The goal of a deload is to reduce overall fatigue while keeping training quality high. The intensity may stay similar, or sometimes even feel high, but the total amount of work is lower.",
        "Not every plan includes deloads. If a session is marked as a deload, follow it as written.",
      ],
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in">
      <div>
        <h1 className="text-3xl font-display font-bold text-slate-900 tracking-tight">Guide</h1>
        <p className="text-slate-500 mt-1">Quick reference for using your plan in the app.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 items-start gap-3 md:gap-4">
        {sections.map((section) => (
          <Card
            key={section.title}
            className={`self-start border-slate-200 shadow-sm bg-white rounded-2xl ${section.className ?? ""}`}
          >
            <CardHeader className="px-4 pt-4 pb-1.5">
              <CardTitle className="text-base">{section.title}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0 space-y-1.5 text-sm leading-6 text-slate-600">
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
