import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Rocket } from "lucide-react";

interface ComingSoonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
}

export function ComingSoonDialog({
  open,
  onOpenChange,
  title = "Coming Soon",
  description = "We're still building this feature. Check back soon!",
}: ComingSoonDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="flex flex-col items-center justify-center pt-4">
          <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center mb-4">
            <Rocket className="h-6 w-6 text-indigo-600" />
          </div>
          <DialogTitle className="text-2xl font-bold text-center">{title}</DialogTitle>
          <DialogDescription className="text-center pt-2">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center mt-4">
          <Button
            type="button"
            className="bg-slate-900 hover:bg-slate-800 text-white rounded-full px-8"
            onClick={() => onOpenChange(false)}
            data-testid="button-close-coming-soon"
          >
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
