export type VendorLogo = {
  darkModeTreatment?: "neutral-white" | "original";
  id: string;
  name: string;
  src: string;
  alt: string;
  widthClass?: string;
};

export type VendorReview = {
  id: string;
  vendorName: string;
  businessLabel: string;
  quote: {
    id: string;
    en: string;
  };
  rating: number;
};

export const vendorLogos: VendorLogo[] = [
  {
    id: "alora-graduation",
    name: "Alora Graduation",
    src: "/landing/vendors/alora-graduation-optimized.png",
    alt: "Logo Alora Graduation",
    widthClass: "w-32 sm:w-36",
    darkModeTreatment: "neutral-white",
  },
  {
    id: "dnix-visual",
    name: "DNIX Visual",
    src: "/landing/vendors/dnix-visual-optimized.png",
    alt: "Logo DNIX Visual",
    widthClass: "w-24 sm:w-28",
    darkModeTreatment: "original",
  },
  {
    id: "dinakara-visual",
    name: "Dinakara Visual",
    src: "/landing/vendors/dinakara-visual-optimized.png",
    alt: "Logo Dinakara Visual",
    widthClass: "w-32 sm:w-36",
    darkModeTreatment: "neutral-white",
  },
  {
    id: "lengkara-visual",
    name: "Lengkara Visual",
    src: "/landing/vendors/lengkara-visual-optimized.png",
    alt: "Logo Lengkara Visual",
    widthClass: "w-24 sm:w-28",
    darkModeTreatment: "original",
  },
  {
    id: "lumiavoto",
    name: "Lumiavoto",
    src: "/landing/vendors/lumiavoto-optimized.png",
    alt: "Logo Lumiavoto",
    widthClass: "w-28 sm:w-32",
    darkModeTreatment: "neutral-white",
  },
  {
    id: "mora-space",
    name: "Mora Space",
    src: "/landing/vendors/mora-space-optimized.png",
    alt: "Logo Mora Space",
    widthClass: "w-28 sm:w-32",
    darkModeTreatment: "neutral-white",
  },
  {
    id: "seraphic-graduation",
    name: "Seraphic Graduation",
    src: "/landing/vendors/seraphic-graduation-optimized.png",
    alt: "Logo Seraphic Graduation",
    widthClass: "w-28 sm:w-32",
    darkModeTreatment: "neutral-white",
  },
];

export const vendorReviews: VendorReview[] = [
  {
    id: "review-lengkara-visual",
    vendorName: "Lengkara Visual",
    businessLabel: "Lengkara Visual",
    quote: {
      id: "Workflow jadi jauh lebih rapi dan semuanya terasa lebih tersistem. Client Desk & Fastpik bikin operasional vendor terasa lebih profesional.",
      en: "The workflow feels much neater and far more organized. Client Desk & Fastpik also make vendor operations feel more professional.",
    },
    rating: 5,
  },
  {
    id: "review-seraphic-graduation",
    vendorName: "Seraphic Graduation",
    businessLabel: "Seraphic Graduation",
    quote: {
      id: "Manage klien jadi jauh lebih otomatis dari booking sampai selesai. Vendor juga tidak perlu input manual lagi ke spreadsheet atau GCal.",
      en: "Client management becomes far more automated from booking to completion. Vendors also no longer need to enter data manually into spreadsheets or Google Calendar.",
    },
    rating: 5,
  },
  {
    id: "review-alora-graduation",
    vendorName: "Alora Graduation",
    businessLabel: "Alora Graduation",
    quote: {
      id: "Semua jadi lebih sistematis dan jauh lebih ringan buat admin karena banyak proses sudah otomatis. Ini juga terasa menaikkan value vendor dari booking sampai after editing.",
      en: "Everything feels more systematic and much lighter for the admin side because so many steps are already automated. It also helps raise a vendor's value from booking through after editing.",
    },
    rating: 5,
  },
];
