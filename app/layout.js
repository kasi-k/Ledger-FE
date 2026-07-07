import "./globals.css";

export const metadata = {
  title: "Expense Tracker",
  description: "Simple expense entry with print support",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
