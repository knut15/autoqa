import type { Metadata } from "next";
import { Geist_Mono, IBM_Plex_Sans_KR } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const plexSansKr = IBM_Plex_Sans_KR({
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AutoQA",
  description: "자동화 회귀 테스트 실행 관제 대시보드",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      suppressHydrationWarning
      className={`${plexSansKr.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
