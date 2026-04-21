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
      className="landing-marquee-track flex min-w-max items-center gap-10 pr-10 sm:gap-14 sm:pr-14"
      aria-hidden={ariaHidden}
    >
      {logos.map((logo) => (
        <div
          key={`${ariaHidden ? "duplicate" : "primary"}-${logo.id}`}
          title={logo.name}
          className="flex h-20 min-w-[176px] items-center justify-center px-2 sm:h-24 sm:min-w-[216px] sm:px-3"
        >
          <Image
            src={logo.src}
            alt={logo.alt}
            width={640}
            height={240}
            className={`${logo.widthClass ?? "w-36 sm:w-44"} h-auto max-h-14 object-contain dark:hidden sm:max-h-16`}
          />
          {logo.darkSrc ? (
            <Image
              src={logo.darkSrc}
              alt={logo.alt}
              width={640}
              height={240}
              className={`${logo.widthClass ?? "w-36 sm:w-44"} hidden h-auto max-h-14 object-contain dark:block sm:max-h-16`}
            />
          ) : null}
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
      <Card className="h-full border-border/70 bg-background/85 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.22)] backdrop-blur-sm">
        <CardContent className="flex h-full flex-col gap-4 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <ReviewStars rating={review.rating} />
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
              {review.rating}/5
            </span>
          </div>

          <div className="space-y-2.5">
            <Quote className="h-4.5 w-4.5 text-primary/45" />
            <p className="text-pretty text-sm leading-6 text-foreground/85 sm:text-[15px] sm:leading-6">
              {quote}
            </p>
          </div>

          <div className="mt-auto border-t border-border/70 pt-3.5">
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
      <div className="container relative mx-auto space-y-10 px-4 sm:space-y-12">
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
          <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg">
            {t("socialProofSubtitle")}
          </p>
        </motion.div>

        <div className="landing-marquee-mask overflow-hidden py-1">
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
