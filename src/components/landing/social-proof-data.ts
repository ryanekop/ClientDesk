export type VendorLogo = {
  id: string;
  name: string;
  src: string;
  alt: string;
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
    id: "vendor-a",
    name: "Vendor A",
    src: "/landing/vendors/vendor-a.svg",
    alt: "Placeholder logo Vendor A",
  },
  {
    id: "studio-b",
    name: "Studio B",
    src: "/landing/vendors/studio-b.svg",
    alt: "Placeholder logo Studio B",
  },
  {
    id: "creative-c",
    name: "Creative C",
    src: "/landing/vendors/creative-c.svg",
    alt: "Placeholder logo Creative C",
  },
  {
    id: "vendor-d",
    name: "Vendor D",
    src: "/landing/vendors/vendor-d.svg",
    alt: "Placeholder logo Vendor D",
  },
  {
    id: "studio-e",
    name: "Studio E",
    src: "/landing/vendors/studio-e.svg",
    alt: "Placeholder logo Studio E",
  },
  {
    id: "creative-f",
    name: "Creative F",
    src: "/landing/vendors/creative-f.svg",
    alt: "Placeholder logo Creative F",
  },
];

export const vendorReviews: VendorReview[] = [
  {
    id: "review-vendor-a",
    vendorName: "Vendor A",
    businessLabel: "Vendor Wisuda",
    quote: {
      id: "Placeholder review ini membantu menunjukkan area testimoni sambil menunggu isi final dari vendor asli.",
      en: "This placeholder review helps show the testimonial area while waiting for the final copy from the real vendor.",
    },
    rating: 5,
  },
  {
    id: "review-studio-b",
    vendorName: "Studio B",
    businessLabel: "Studio Kreatif",
    quote: {
      id: "Contoh ini dipakai dulu agar ritme layout, jarak, dan gaya kartu review bisa langsung disiapkan dengan rapi.",
      en: "This example is here so the layout rhythm, spacing, and testimonial card styling can be prepared neatly right away.",
    },
    rating: 5,
  },
  {
    id: "review-creative-c",
    vendorName: "Creative C",
    businessLabel: "Vendor Wedding",
    quote: {
      id: "Nanti saat file dan review asli masuk, cukup ganti data tanpa perlu ubah struktur section social proof ini.",
      en: "Once the real files and reviews arrive, you can simply swap the data without changing the social proof section structure.",
    },
    rating: 5,
  },
];
