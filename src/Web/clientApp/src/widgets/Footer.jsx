"use client";

import { Building2, Globe, Mail, MessageCircle } from "lucide-react";
import { Button } from "../components/ui/button";
import { Separator } from "../components/ui/separator";
import { Link } from "../routing";

const groups = [
  {
    title: "Products",
    links: ["Current accounts", "Savings", "Cards", "Loans"],
  },
  {
    title: "Company",
    links: ["About", "Contact", "Careers", "Support"],
  },
  {
    title: "Legal",
    links: ["Privacy", "Terms", "Security"],
  },
];

export default function Footer() {
  const year = new Date().getFullYear();
  const socialIcons = [Globe, Mail, MessageCircle];

  return (
    <footer className="mt-auto border-t bg-background">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div className="space-y-2">
            <Link to="/accounts" className="inline-flex items-center gap-2 no-underline">
              <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Building2 className="size-5" />
              </span>
              <span className="text-lg font-semibold">ZXC Bank</span>
            </Link>
            <p className="max-w-md text-xs text-muted-foreground sm:text-sm">
              Digital banking for accounts, transfers, cards, and everyday financial control.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 sm:gap-6">
            {groups.map((group) => (
              <div key={group.title} className="space-y-2">
                <h3 className="text-xs font-medium uppercase tracking-widest">{group.title}</h3>
                <ul className="space-y-1 text-xs text-muted-foreground sm:text-sm">
                  {group.links.map((item) => (
                    <li key={item}>
                      <Link to="/accounts" className="hover:text-foreground">
                        {item}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        <div className="flex flex-col gap-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>Copyright {year} ZXC Bank. All rights reserved.</p>
          <div className="flex items-center gap-2">
            {socialIcons.map((Icon, index) => (
              <Button key={index} variant="ghost" size="icon" asChild>
                <a href="https://github.com/mikhailtrepachev/ZXC" target="_blank" rel="noreferrer" aria-label="Social link">
                  <Icon className="size-4" />
                </a>
              </Button>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
