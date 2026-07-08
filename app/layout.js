import "./globals.css";

export const metadata = {
  title: "Maarr Expenses",
  description: "Simple expense entry with print support",
  icons: {
    icon: "/maarr.png",
    shortcut: "/maarr.png",
    apple: "/maarr.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
