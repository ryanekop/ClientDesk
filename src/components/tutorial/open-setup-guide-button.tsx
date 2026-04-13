"use client";

import * as React from "react";
import { ArrowRight } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { requestOpenOnboardingReviewModal } from "@/lib/onboarding";

export function OpenSetupGuideButton({
  label,
  variant = "default",
}: {
  label: string;
  variant?: "default" | "outline";
}) {
  const router = useRouter();

  const handleClick = React.useCallback(() => {
    requestOpenOnboardingReviewModal();
    router.push("/dashboard");
  }, [router]);

  return (
    <Button className="gap-2" variant={variant} onClick={handleClick}>
      {label} <ArrowRight className="h-4 w-4" />
    </Button>
  );
}
