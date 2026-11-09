import type { Metadata, Viewport } from "next";
import "./globals.css";
import Script from "next/script";

export const metadata: Metadata = {
  title: "¿A quién le toca? — La ruleta de las tareas",
  description: "Sortea tareas, reparte favores y lleva la cuenta de los escaqueos.",
  applicationName: "¿A quién le toca?",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "¿A quién le toca?" },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.svg",
  }
};
export const viewport: Viewport = {
  themeColor: "#090b12",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  const adsenseClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

  return (
    <html lang="es">
      <body>
        {children}

        {adsenseClient && (
          <Script
            id="google-adsense"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`}
            strategy="afterInteractive"
            crossOrigin="anonymous"
          />
        )}
      </body>
    </html>
  );
}
