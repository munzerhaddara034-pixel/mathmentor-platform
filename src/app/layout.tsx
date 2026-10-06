import type { Metadata, Viewport } from "next";
import { Alexandria, IBM_Plex_Sans_Arabic, Inter, Sora } from "next/font/google";
import "./globals.css";
import "@/styles/shell.css";
import "@/styles/v2.css";
import { cookies } from "next/headers";
import { Nav } from "@/components/Nav";
import { SiteFooter } from "@/components/SiteFooter";
import { ChatWidget } from "@/components/ChatWidget";
import { PwaRegister } from "@/components/PwaRegister";
import { CurriculumProvider } from "@/components/curriculum/CurriculumProvider";
import { getSession } from "@/lib/auth/server";
import { getI18n } from "@/lib/i18n/server";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { OG_IMAGE, siteUrl } from "@/lib/seo/site";

/*
 * Fonts (redesign-v2 A). Latin pairing for the default `en`/`fr` locales: Sora 800 (geometric display, matches
 * Alexandria) + Inter (UI). Arabic faces use only the `arabic` subset and are NOT preloaded: their unicode-range
 * means browsers fetch them only when Arabic glyphs render (ar locale, or the Arabic brand name).
 */
const inter = Inter({ subsets: ["latin"], display: "swap", weight: ["400", "600", "700"], variable: "--font-inter" });
const sora = Sora({ subsets: ["latin"], display: "swap", weight: ["800"], variable: "--font-sora" });
const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  display: "swap",
  weight: ["400", "600", "700"],
  variable: "--font-plex-arabic",
  preload: false,
});
/** Arabic display: Alexandria as a single static 800 weight (~29 KB) instead of the variable file. */
const alexandria = Alexandria({ subsets: ["arabic"], display: "swap", weight: ["800"], variable: "--font-alexandria", preload: false });

const baseMetadata: Metadata = {
  applicationName: "MathMentor",
  manifest: "/manifest.webmanifest",
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

/** Title/description follow the visitor's locale (cookie, default en). */
export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return {
    ...baseMetadata,
    metadataBase: new URL(siteUrl()),
    title: m.meta.title,
    description: m.meta.description,
    appleWebApp: { capable: true, title: m.meta.title, statusBarStyle: "black-translucent" },
    openGraph: {
      type: "website",
      siteName: "MathMentor",
      title: m.meta.title,
      description: m.meta.description,
      url: "/",
      images: [OG_IMAGE],
    },
    twitter: { card: "summary", title: m.meta.title, description: m.meta.description, images: [OG_IMAGE.url] },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: "#060913",
  colorScheme: "dark light",
};

/**
 * Runs before paint: (1) theme — A is dark-first, so dark unless the visitor chose light;
 * (2) capability classes — `lowend` swaps glass blur for solid surfaces, `data-saver` stops media previews.
 * Thresholds follow the v2 README (data-saver: Save-Data / 2g / own toggle; lowend: also 3g, ≤ 4 GB RAM, ≤ 4 cores); `mm-fx` in localStorage overrides.
 */
const themeScript = `(function(){var d=document.documentElement;try{var t=localStorage.getItem("mm-theme");if(t!=="light"&&t!=="dark"){var m=document.cookie.match(/(?:^|; )mm-theme=(dark|light)/);t=m?m[1]:"dark";}d.setAttribute("data-theme",t);d.classList.toggle("theme-dark",t==="dark");d.classList.toggle("theme-light",t!=="dark");}catch(e){d.setAttribute("data-theme","dark");}try{var n=navigator,c=n.connection||{},fx=localStorage.getItem("mm-fx"),saver=c.saveData===true||/2g$/.test(c.effectiveType||"")||localStorage.getItem("mm-data-saver")==="1",low=saver||c.effectiveType==="3g"||(n.deviceMemory&&n.deviceMemory<=4)||(n.hardwareConcurrency&&n.hardwareConcurrency<=4);if(fx==="full")low=false;if(fx==="lite")low=true;d.classList.toggle("lowend",!!low);d.classList.toggle("data-saver",!!saver);}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  const { locale, dir, m } = await getI18n();
  const themeCookie = (await cookies()).get("mm-theme")?.value;
  const theme = themeCookie === "light" ? "light" : "dark";
  return (
    <html
      lang={locale}
      dir={dir}
      data-theme={theme}
      className={`${theme === "dark" ? "theme-dark" : "theme-light"} ${inter.variable} ${sora.variable} ${plexArabic.variable} ${alexandria.variable}`}
      suppressHydrationWarning
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <I18nProvider locale={locale} messages={m}>
        <CurriculumProvider>
          <div className="app-frame">
            <Nav initialUser={user} />
            {children}
            <SiteFooter />
          </div>
          <ChatWidget />
          <PwaRegister />
        </CurriculumProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
