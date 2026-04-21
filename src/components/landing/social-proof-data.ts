export type VendorLogo = {
  darkSrc?: string;
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
    src: "/landing/vendors/alora-graduation.webp",
    darkSrc: "/landing/vendors/alora-graduation-dark.webp",
    alt: "Logo Alora Graduation",
    widthClass: "w-44 sm:w-56",
  },
  {
    id: "dnix-visual",
    name: "DNIX Visual",
    src: "/landing/vendors/dnix-visual.webp",
    darkSrc: "/landing/vendors/dnix-visual-dark.webp",
    alt: "Logo DNIX Visual",
    widthClass: "w-36 sm:w-44",
  },
  {
    id: "dinakara-visual",
    name: "Dinakara Visual",
    src: "/landing/vendors/dinakara-visual.webp",
    darkSrc: "/landing/vendors/dinakara-visual-dark.webp",
    alt: "Logo Dinakara Visual",
    widthClass: "w-44 sm:w-56",
  },
  {
    id: "lengkara-visual",
    name: "Lengkara Visual",
    src: "/landing/vendors/lengkara-visual.webp",
    darkSrc: "/landing/vendors/lengkara-visual-dark.webp",
    alt: "Logo Lengkara Visual",
    widthClass: "w-36 sm:w-44",
  },
  {
    id: "lumiavoto",
    name: "Lumiavoto",
    src: "/landing/vendors/lumiavoto.webp",
    darkSrc: "/landing/vendors/lumiavoto-dark.webp",
    alt: "Logo Lumiavoto",
    widthClass: "w-24 sm:w-28",
  },
  {
    id: "mora-space",
    name: "Mora Space",
    src: "/landing/vendors/mora-space.webp",
    darkSrc: "/landing/vendors/mora-space-dark.webp",
    alt: "Logo Mora Space",
    widthClass: "w-44 sm:w-56",
  },
  {
    id: "seraphic-graduation",
    name: "Seraphic Graduation",
    src: "/landing/vendors/seraphic-graduation.webp",
    darkSrc: "/landing/vendors/seraphic-graduation-dark.webp",
    alt: "Logo Seraphic Graduation",
    widthClass: "w-28 sm:w-36",
  },
];

export const vendorReviews: VendorReview[] = [
  {
    id: "review-lengkara-visual",
    vendorName: "Lengkara Visual",
    businessLabel: "Lengkara Visual",
    quote: {
      id: "Workflow jadi jauh lebih rapi dan semuanya terasa lebih tersistem. Client Desk & Fastpik bikin operasional vendor terlihat lebih profesional, dan ini aplikasi yang selama ini aku cari untuk bantu ngatur booking dengan lebih enak.",
      en: "The workflow feels much neater and far more organized. Client Desk & Fastpik make vendor operations look more professional, and it is the kind of app I had been looking for to manage bookings more comfortably.",
    },
    rating: 5,
  },
  {
    id: "review-seraphic-graduation",
    vendorName: "Seraphic Graduation",
    businessLabel: "Seraphic Graduation",
    quote: {
      id: "Fitur-fiturnya ngebantu banget untuk manage klien secara otomatis dari booking sampai selesai. Vendor jadi tidak perlu input data manual lagi ke spreadsheet atau GCal, dan support-nya juga responsif saat ada bug atau masukan.",
      en: "The features are incredibly helpful for managing clients automatically from booking to completion. Vendors no longer need to enter data manually into spreadsheets or Google Calendar, and the support is responsive whenever there are bugs or feedback.",
    },
    rating: 5,
  },
  {
    id: "review-alora-graduation",
    vendorName: "Alora Graduation",
    businessLabel: "Alora Graduation",
    quote: {
      id: "Sejauh ini sangat worth it karena kerja admin jadi lebih sistematis dan tidak serepot dulu. Fastpik juga memudahkan client pilih foto, jadi experience dari booking sampai after editing terasa lebih profesional dan menaikkan value vendor.",
      en: "So far it has been very worth it because admin work is more systematic and no longer as tedious as before. Fastpik also makes it easier for clients to choose photos, so the experience from booking to after editing feels more professional and raises the vendor's value.",
    },
    rating: 5,
  },
];
