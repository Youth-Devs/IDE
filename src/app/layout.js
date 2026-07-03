import "./globals.css";

export const metadata = {
  title: "YouthDevs Vibe IDE",
  description: "Learn to build websites with AI instantly",
  icons: {
    icon: '/icon.svg',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* 🚀 THE FORCE DIRECTIVE: Pull Tailwind directly via CDN to force layout alignment if local compiler stalls */}
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body className="antialiased bg-[#050b08] text-slate-50 m-0 p-0 overflow-hidden">
        {children}
      </body>
    </html>
  );
}
