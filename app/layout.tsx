import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "HHYC · HHYC CRM Touchpoint System",
  description: "Hebe Haven Yacht Club — HHYC member database sync and CRM touchpoint system",
};

// Injected before React hydrates to prevent FOUC
const themeScript = `
(function(){
  try {
    var t = localStorage.getItem('hebe-theme');
    if (t === 'light') { document.documentElement.classList.remove('dark'); }
    else { document.documentElement.classList.add('dark'); }
  } catch(e) { document.documentElement.classList.add('dark'); }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${inter.variable} font-sans h-full`}>
        {children}
      </body>
    </html>
  );
}
