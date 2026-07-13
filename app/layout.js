import "./globals.css";

export const metadata = {
  title: "Sprintora — Project management that scales with your team",
  description:
    "Fast, simple project management built for growing teams. Onboard in minutes, not months.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
