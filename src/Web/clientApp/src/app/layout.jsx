import "../index.css";
import AppShell from "../components/AppShell";
import { ThemeProvider } from "../components/ThemeProvider";
import { TooltipProvider } from "../components/ui/tooltip";

export const metadata = {
  title: "ZXC Bank",
  description: "Internet banking application",
};

export default function RootLayout({ children }) {
  return (
    <html lang="cs" suppressHydrationWarning className="font-sans">
      <body>
        <ThemeProvider>
          <TooltipProvider>
            <AppShell>{children}</AppShell>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
