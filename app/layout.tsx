import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "../components/Providers";
import { AppLayout } from "../components/AppLayout";

export const metadata: Metadata = {
  title: "Timesheet App",
  description: "Modern personal timesheet management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased min-h-screen bg-background text-foreground transition-colors duration-300">
        <Providers>
          <AppLayout>{children}</AppLayout>
        </Providers>
      </body>
    </html>
  );
}
