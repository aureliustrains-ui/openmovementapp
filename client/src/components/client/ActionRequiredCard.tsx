import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  title: string;
  description?: string;
  ctaLabel: string;
  ctaHref?: string;
  onCtaClick?: () => void;
  ctaDisabled?: boolean;
  secondaryText?: string;
  testId?: string;
};

export function ActionRequiredCard({
  title,
  description,
  ctaLabel,
  ctaHref,
  onCtaClick,
  ctaDisabled,
  secondaryText,
  testId,
}: Props) {
  return (
    <Card className="border-slate-200 shadow-sm rounded-2xl bg-white" data-testid={testId}>
      <CardContent className="p-3.5 md:p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base md:text-lg font-semibold text-slate-900 leading-tight">{title}</h2>
          {description ? <p className="text-xs text-slate-600 mt-1">{description}</p> : null}
          {secondaryText ? (
            <p className="text-xs text-slate-500 mt-2">{secondaryText}</p>
          ) : null}
        </div>
        {ctaHref ? (
          <Link href={ctaHref}>
            <Button className="rounded-xl w-full md:w-auto bg-slate-700 hover:bg-slate-800 text-white">
              {ctaLabel}
            </Button>
          </Link>
        ) : (
          <Button
            className="rounded-xl w-full md:w-auto bg-slate-700 hover:bg-slate-800 text-white"
            onClick={onCtaClick}
            disabled={ctaDisabled}
          >
            {ctaLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
