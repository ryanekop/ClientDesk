export const TUTORIAL_TOPICS = [
  {
    id: "overview",
    slug: "overview",
    icon: "overview",
    accent: {
      icon: "text-blue-600",
      iconBg: "bg-blue-50",
      iconBorder: "border-blue-100",
    },
    stepKeys: ["step1", "step2", "step3", "step4"],
    noteKeys: ["note1", "note2"],
  },
  {
    id: "workflow",
    slug: "workflow",
    icon: "workflow",
    accent: {
      icon: "text-violet-600",
      iconBg: "bg-violet-50",
      iconBorder: "border-violet-100",
    },
    stepKeys: ["step1", "step2", "step3", "step4"],
    noteKeys: ["note1", "note2"],
  },
  {
    id: "formVsManual",
    slug: "form-vs-manual",
    icon: "formVsManual",
    accent: {
      icon: "text-amber-600",
      iconBg: "bg-amber-50",
      iconBorder: "border-amber-100",
    },
    stepKeys: ["step1", "step2", "step3", "step4"],
    noteKeys: ["note1", "note2"],
  },
  {
    id: "servicesPackages",
    slug: "services-packages",
    icon: "servicesPackages",
    accent: {
      icon: "text-emerald-600",
      iconBg: "bg-emerald-50",
      iconBorder: "border-emerald-100",
    },
    stepKeys: ["step1", "step2", "step3", "step4"],
    noteKeys: ["note1", "note2"],
  },
  {
    id: "teamAssignment",
    slug: "team-assignment",
    icon: "teamAssignment",
    accent: {
      icon: "text-rose-600",
      iconBg: "bg-rose-50",
      iconBorder: "border-rose-100",
    },
    stepKeys: ["step1", "step2", "step3", "step4"],
    noteKeys: ["note1", "note2"],
  },
  {
    id: "bookingList",
    slug: "booking-list",
    icon: "bookingList",
    accent: {
      icon: "text-cyan-600",
      iconBg: "bg-cyan-50",
      iconBorder: "border-cyan-100",
    },
    stepKeys: ["step1", "step2", "step3", "step4"],
    noteKeys: ["note1", "note2"],
  },
  {
    id: "bookingStatus",
    slug: "booking-status",
    icon: "bookingStatus",
    accent: {
      icon: "text-indigo-600",
      iconBg: "bg-indigo-50",
      iconBorder: "border-indigo-100",
    },
    stepKeys: ["step1", "step2", "step3", "step4"],
    noteKeys: ["note1", "note2"],
  },
  {
    id: "finance",
    slug: "finance",
    icon: "finance",
    accent: {
      icon: "text-green-600",
      iconBg: "bg-green-50",
      iconBorder: "border-green-100",
    },
    stepKeys: ["step1", "step2", "step3", "step4"],
    noteKeys: ["note1", "note2"],
  },
  {
    id: "googleIntegration",
    slug: "google-integration",
    icon: "googleIntegration",
    accent: {
      icon: "text-orange-600",
      iconBg: "bg-orange-50",
      iconBorder: "border-orange-100",
    },
    stepKeys: ["step1", "step2", "step3", "step4"],
    noteKeys: ["note1", "note2"],
  },
  {
    id: "dailyTips",
    slug: "daily-tips",
    icon: "dailyTips",
    accent: {
      icon: "text-slate-600",
      iconBg: "bg-slate-50",
      iconBorder: "border-slate-200",
    },
    stepKeys: ["step1", "step2", "step3", "step4"],
    noteKeys: ["note1", "note2"],
  },
] as const;

export type TutorialTopic = (typeof TUTORIAL_TOPICS)[number];
export type TutorialTopicId = TutorialTopic["id"];
export type TutorialTopicSlug = TutorialTopic["slug"];
export type TutorialTopicIconKey = TutorialTopic["icon"];

export function getTutorialTopicBySlug(slug: string) {
  return TUTORIAL_TOPICS.find((topic) => topic.slug === slug) ?? null;
}
