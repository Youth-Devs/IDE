import "xterm/css/xterm.css";
import "./globals.css";

export const metadata = {
  title: "YouthDevs IDE | Build boldly",
  description: "A focused cloud IDE for building, collaborating, previewing, and shipping software.",
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
      <body className="antialiased bg-white text-slate-900 m-0 p-0 overflow-y-auto">
        {children}
      </body>
    </html>
  );
}
