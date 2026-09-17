import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { ChatWidget } from "@/components/ChatWidget";
import { PwaRegister } from "@/components/PwaRegister";

export const metadata: Metadata = {
  title: "MathMentor · أكاديمية منذر حداره",
  description: "Lebanese curriculum learning platform with professor-reviewed AI videos and paper solutions.",
  applicationName: "MathMentor",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "MathMentor · أكاديمية منذر حداره",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/brand/mathmentor-logo.svg", type: "image/svg+xml" },
      { url: "/brand/mathmentor-logo.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/brand/mathmentor-logo-192.png", sizes: "192x192" },
      { url: "/brand/mathmentor-logo.png", sizes: "512x512" },
    ],
    shortcut: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B1F3A",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar">
      <body>
        <Nav />
        {children}
        <ChatWidget />
        <PwaRegister />
        <Script id="mathjax-config" strategy="beforeInteractive">
          {`window.MathJax = { tex: { inlineMath: [['\\\\(','\\\\)']], displayMath: [['\\\\[','\\\\]']] } };`}
        </Script>
        <Script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
