import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Banner } from "@/components/Banner";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getCurrentStore } from "@/lib/store-context";
import { getStoreBranding } from "@/lib/store-branding";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const store = await getCurrentStore();
  if (!store) return { title: "Store not found" };

  const branding = getStoreBranding(store);
  return {
    title: {
      default: branding.name,
      template: `%s | ${branding.name}`,
    },
    description: branding.description,
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const store = await getCurrentStore();
  const branding = store ? getStoreBranding(store) : null;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body
        className="flex min-h-full flex-col"
        style={
          branding
            ? ({
                "--accent": branding.theme.accent,
                "--accent-dark": branding.theme.accentDark,
              } as React.CSSProperties)
            : undefined
        }
      >
        <Banner />
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
