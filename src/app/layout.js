import "./globals.css"; // Ensure standard Tailwind directives are imported here

export const metadata = {
  title: "YouthDevs Vibe IDE",
  description: "Learn to build websites with AI instantly",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased bg-slate-950 text-slate-50 m-0 p-0 overflow-hidden">
        {children}
      </body>
    </html>
  );
}