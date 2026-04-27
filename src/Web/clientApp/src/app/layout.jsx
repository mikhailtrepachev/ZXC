import "../index.css";
import AppShell from "../components/AppShell";
import { Noto_Sans } from "next/font/google";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "../components/ThemeProvider";
import { TooltipProvider } from "../components/ui/tooltip";

const notoSans = Noto_Sans({subsets:['latin'],variable:'--font-sans'});

export const metadata = {
  title: "ZXC Bank",
  description: "Internet banking application",
};

export default function RootLayout({ children }) {
  return (
    <html lang="cs" suppressHydrationWarning className={cn("font-sans", notoSans.variable)}>
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
