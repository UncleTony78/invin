import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Newsreader } from "next/font/google";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

/* Only the Editorial invoice design uses it */
const serif = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "InVin",
  description: "Bill, track and get paid, all in one calm place.",
  icons: { icon: "/favicon.svg" },
};

/* Set the theme before first paint so nothing flashes. */
/* Dark by default; a saved choice wins. Customers' invoice and estimate pages are always light (their document, not our app). */
const themeScript = `try{var d=document.documentElement,p=location.pathname,c=p.indexOf("/i/")===0||p.indexOf("/e/")===0,t=null;try{t=localStorage.getItem("invin.theme")}catch(e){}d.dataset.theme=c?"light":(t==="light"?"light":"dark")}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="dark" className={`${plexSans.variable} ${plexMono.variable} ${serif.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
