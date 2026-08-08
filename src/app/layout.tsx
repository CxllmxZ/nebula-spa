import type { Metadata } from "next";
import { Noto_Serif_Thai, IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const serifThai = Noto_Serif_Thai({
  variable: "--font-serif-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const sansThai = IBM_Plex_Sans_Thai({
  variable: "--font-sans",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Nebula Spa - จองนวดสปา",
    template: "%s | Nebula Spa",
  },
  description: "ร้านนวดสปาไทย เนบิวล่าสปา - จองบริการนวดออนไลน์ ง่าย รวดเร็ว",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      className={cn(
        "h-full",
        "antialiased",
        serifThai.variable,
        sansThai.variable,
        "font-sans",
      )}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
