import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useSendMessage } from "@/lib/api";

/**
 * A small "what's on your mind?" box on the client home screen. The note is saved as a
 * message on the client's page (Notes & Logs) and shows up in the coach's notifications;
 * the coach answers outside the app, so there is no chat here.
 */
export function CoachNoteBox({ clientId, disabled }: { clientId: string; disabled?: boolean }) {
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);
  const sendMessage = useSendMessage();

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    setError(false);
    try {
      await sendMessage.mutateAsync({ clientId, text: trimmed });
      setText("");
      setSent(true);
    } catch {
      setError(true);
    }
  };

  return (
    <Card className="rounded-2xl border-slate-200 shadow-sm" data-testid="coach-note-box">
      <CardContent className="space-y-3 p-5">
        <h2 className="text-base font-semibold text-slate-900">What's on your mind?</h2>
        {sent ? (
          <div
            className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700"
            data-testid="coach-note-sent"
          >
            Sent, thank you.
            <button
              type="button"
              onClick={() => setSent(false)}
              className="ml-2 font-semibold text-[var(--color-brand-700)] underline"
            >
              Write another
            </button>
          </div>
        ) : (
          <>
            <Textarea
              value={text}
              onChange={(event) => setText(event.target.value.slice(0, 2000))}
              placeholder="A question about the schedule, an exercise or the plan? Something too hard or too easy?"
              className="min-h-[84px] resize-none"
              disabled={disabled}
              data-testid="input-coach-note"
            />
            {error ? (
              <p className="text-sm text-rose-600">Could not send. Please try again.</p>
            ) : null}
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={send}
                disabled={disabled || !text.trim() || sendMessage.isPending}
                data-testid="button-send-coach-note"
              >
                {sendMessage.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send to your coach
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
