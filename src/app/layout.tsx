import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Vasanam Clip Store", template: "%s · Vasanam Clip Store" },
  description: "Clips and clip packages for the Vasanam party game.",
  icons: { icon: "/logo.png" },
};

export const viewport: Viewport = { themeColor: "#14110c" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="wrap">
          <header className="top">
            <Link href="/" className="brand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="" />
              <span>
                <b>VASANAM</b>
                <small>Clip Store</small>
              </span>
            </Link>
          </header>
          {children}
          <p className="notice">
            Clips here are published by the Vasanam team for the Vasanam game. Each clip is used to
            compare how a line is delivered; nothing here is for resale.
          </p>
        </div>
      </body>
    </html>
  );
}
