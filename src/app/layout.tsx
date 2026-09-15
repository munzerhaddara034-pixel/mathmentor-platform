import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { ChatWidget } from "@/components/ChatWidget";

export const metadata: Metadata = {
  title: "Munzer Haddara Math Academy",
  description: "Lebanese curriculum learning platform with professor-reviewed AI videos and paper solutions.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar">
      <body>
        <Nav />
        {children}
        <ChatWidget />
        <Script id="mathjax-config" strategy="beforeInteractive">
          {`window.MathJax = { tex: { inlineMath: [['\\\\(','\\\\)']], displayMath: [['\\\\[','\\\\]']] } };`}
        </Script>
        <Script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
