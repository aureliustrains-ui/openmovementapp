import { Link } from "wouter";
import { ChevronRight } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  title: string;
  description?: string;
  ctaLabel: string;
  ctaHref?: string;
  onCtaClick?: () => void;
  ctaDisabled?: boolean;
  ctaVariant?: ButtonProps["variant"];
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
  ctaVariant = "default",
  secondaryText,
  testId,
}: Props) {
  return (
    <Card className="border-slate-200 shadow-sm rounded-xl bg-white" data-testid={testId}>
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
            <Button className="w-full md:w-auto" variant={ctaVariant}>
              {ctaLabel}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        ) : (
          <Button
            className="w-full md:w-auto"
            variant={ctaVariant}
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
