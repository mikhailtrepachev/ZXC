"use client";

import Footer from "../widgets/Footer";
import AppSidebar from "./AppSidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "./ui/sidebar";

export default function AppShell({ children }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-h-screen">
        <div className="fixed left-3 top-3 z-50 md:hidden">
          <SidebarTrigger className="border bg-background shadow-sm" />
        </div>
        <div className="flex flex-1 flex-col">{children}</div>
        <Footer />
      </SidebarInset>
    </SidebarProvider>
  );
}
