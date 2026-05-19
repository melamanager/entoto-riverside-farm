import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth";
import { LangProvider } from "@/lib/lang";
import { MobileNav } from "@/components/mobile-nav";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "ENTOTO Riverside Farm — Operations",
  description: "Smart strawberry farm management — valves, beds, farmers, harvest, disease AI, and live farm map.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#f8fafc] text-slate-900">
        <LangProvider>
        <AuthProvider>
          <div className="min-h-screen flex">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
              <Topbar />
              <main className="flex-1 overflow-auto pb-16 md:pb-0">{children}</main>
              <MobileNav />
            </div>
          </div>
        </AuthProvider>
        </LangProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
