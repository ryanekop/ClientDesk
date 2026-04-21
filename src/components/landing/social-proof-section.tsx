"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { Quote, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  vendorLogos,
  vendorReviews,
  type VendorLogo,
  type VendorReview,
} from "@/components/landing/social-proof-data";

function ReviewStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1 text-amber-500">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          className="h-4 w-4"
          fill={index < rating ? "currentColor" : "none"}
        />
      ))}
    </div>
  );
}

function MarqueeTrack({
  logos,
  ariaHidden = false,
}: {
  logos: VendorLogo[];
  ariaHidden?: boolean;
}) {
  return (
    <div
      className="landing-marquee-track flex min-w-max items-center gap-4 pr-4 sm:gap-5 sm:pr-5"
      aria-hidden={ariaHidden}
    >
      {logos.map((logo) => (
        <div
          key={`${ariaHidden ? "duplicate" : "primary"}-${logo.id}`}
          title={logo.name}
          className="flex h-20 min-w-[170px] items-center justify-center rounded-2xl border border-border/70 bg-background/90 px-5 shadow-sm backdrop-blur-sm sm:h-24 sm:min-w-[210px]"
        >
          <Image
            src={logo.src}
            alt={logo.alt}
            width={220}
            height={90}
            className="h-10 w-auto object-contain sm:h-12"
          />
        </div>
      ))}
    </div>
  );
}

function ReviewCard({
  review,
  locale,
}: {
  review: VendorReview;
  locale: string;
}) {
  const quote = locale === "en" ? review.quote.en : review.quote.id;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.4 }}
      className="h-full"
    >
      <Card className="h-full border-border/80 bg-background/90 shadow-[0_18px_45px_-28px_rgba(15,23,42,0.32)]">
        <CardContent className="flex h-full flex-col gap-5 p-6">
          <div className="flex items-center justify-between gap-3">
            <ReviewStars rating={review.rating} />
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
              {review.rating.toFixed(1)}/5
            </span>
          </div>

          <div className="space-y-3">
            <Quote className="h-5 w-5 text-primary/50" />
            <p className="text-sm leading-7 text-foreground/85 sm:text-[15px]">
              {quote}
            </p>
          </div>

          <div className="mt-auto border-t border-border/70 pt-4">
            <p className="font-semibold">{review.vendorName}</p>
            <p className="text-sm text-muted-foreground">{review.businessLabel}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function SocialProofSection() {
  const t = useTranslations("Landing");
  const locale = useLocale();

  return (
    <section className="relative overflow-hidden border-y bg-gradient-to-b from-background via-muted/20 to-background py-16 sm:py-20">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.06),_transparent_48%)]" />
      <div className="container relative mx-auto space-y-12 px-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          className="mx-auto max-w-3xl text-center"
        >
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.24em] text-primary/70">
            {t("socialProofEyebrow")}
          </p>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("socialProofTitle")}
          </h2>
          <p className="mt-4 text-lg leading-8 text-muted-foreground">
            {t("socialProofSubtitle")}
          </p>
        </motion.div>

        <div className="landing-marquee-mask overflow-hidden">
          <div className="landing-marquee flex w-max items-center">
            <MarqueeTrack logos={vendorLogos} />
            <MarqueeTrack logos={vendorLogos} ariaHidden />
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {vendorReviews.map((review) => (
            <ReviewCard key={review.id} review={review} locale={locale} />
          ))}
        </div>
      </div>
    </section>
  );
}
