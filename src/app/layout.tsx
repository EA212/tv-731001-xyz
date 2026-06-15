import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "导航站",
  description: "网站导航",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        <meta name="referrer" content="no-referrer" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" href="/favicon.ico" type="image/x-icon" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}