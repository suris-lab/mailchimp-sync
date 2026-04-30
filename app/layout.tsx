import type { Metadata } from "next";
import { Inter, Lora } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const lora = Lora({ subsets: ["latin"], variable: "--font-lora" });

export const metadata: Metadata = {
  title: "HHYC · Sheets → Mailchimp Sync",
  description: "Hebe Haven Yacht Club — real-time Google Sheets to Mailchimp contact sync",
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
      <body className={`${inter.variable} ${lora.variable} font-sans h-full`}>
        {children}
      </body>
    </html>
  );
}
