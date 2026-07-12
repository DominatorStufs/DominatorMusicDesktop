import { Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { UIStyleProvider } from "@/hooks/use-ui-style";
import NextTopLoader from 'nextjs-toploader';
import { Toaster } from "sonner";
import MobileMenu from "@/components/mobile-menu";
import MusicProvider from "@/components/music-provider";
import UIStyleButton from "@/components/ui-style-button";
import AppClerkProvider from "@/components/clerk-provider-wrapper";
import StatsRecap from "@/components/stats-recap";
import OnboardingTour from "@/components/onboarding-tour";

const bricolage_grotesque = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700", "800"],
});

export const metadata = {
  title: "DominatorMusic",
  description: "Open-Source music streamer.",
  icons: "/favi-icon.jpg",
  manifest: "/manifest.json",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Prevents flash of wrong UI style / glass effect before hydration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('ui-style')||'normal';var g=localStorage.getItem('ui-glass')==='on';document.documentElement.setAttribute('data-ui-style',s);document.documentElement.setAttribute('data-glass',g?'on':'off');}catch(e){}})();`,
          }}
        />
      </head>
      <body className={bricolage_grotesque.className}>
        <AppClerkProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <UIStyleProvider>
              <NextTopLoader
                color="hsl(var(--primary))"
                initialPosition={0.08}
                crawlSpeed={200}
                height={3}
                crawl={true}
                showSpinner={false}
                easing="ease"
                speed={200}
                shadow="0 0 10px hsl(var(--primary)),0 0 15px hsl(var(--primary))"
                zIndex={1600}
                showAtBottom={false}
              />
              <MusicProvider>
                {children}
              </MusicProvider>
              <MobileMenu />
              <UIStyleButton />
              <StatsRecap />
              <OnboardingTour />
              <Toaster position="top-center" visibleToasts={1} />
            </UIStyleProvider>
          </ThemeProvider>
        </AppClerkProvider>
      </body>
    </html>
  );
}
