import type { Metadata } from "next";
import Script from "next/script";
import { Cairo } from "next/font/google";
import "./globals.css";
import { cookies } from "next/headers";
import { Nav } from "@/components/Nav";
import { ChatWidget } from "@/components/ChatWidget";
import { MathGridCanvas } from "@/components/MathGridCanvas";
import { getSession } from "@/lib/auth/server";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  display: "swap",
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Math Mentor — الأستاذ منذر حدارة",
  description: "منصة رياضيات للثانوية والشهادة المتوسطة في لبنان، مع صف تفاعلي وبنك أسئلة ومساعد الأستاذ منذر.",
};

const themeScript = `(function(){try{var t=localStorage.getItem("mm-theme");if(t!=="light"&&t!=="dark"){var m=document.cookie.match(/(?:^|; )mm-theme=(dark|light)/);t=m?m[1]:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");}document.documentElement.setAttribute("data-theme",t);document.documentElement.classList.toggle("theme-dark",t==="dark");document.documentElement.classList.toggle("theme-light",t!=="dark");}catch(e){document.documentElement.setAttribute("data-theme","light");}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  const themeCookie = (await cookies()).get("mm-theme")?.value;
  const theme = themeCookie === "dark" ? "dark" : "light";
  return (
    <html
      lang="ar"
      dir="rtl"
      data-theme={theme}
      className={theme === "dark" ? "theme-dark" : "theme-light"}
      suppressHydrationWarning
    >
      <body className={cairo.className}>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <MathGridCanvas />
        <div className="app-frame">
          <Nav initialUser={user} />
          {children}
          <footer className="site-footer">
            <strong>Math Mentor</strong>
            <span>الأستاذ منذر حدارة · رياضيات الثانوية والشهادة المتوسطة</span>
          </footer>
        </div>
        <ChatWidget />
        <Script id="mathjax-config" strategy="beforeInteractive">
          {`window.MathJax = { tex: { inlineMath: [['\\\\(','\\\\)']], displayMath: [['\\\\[','\\\\]']] } };`}
        </Script>
        <Script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
