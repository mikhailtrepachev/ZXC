"use client";

import Header from "../widgets/Header";
import Footer from "../widgets/Footer";

export default function AppShell({ children }) {
  return (
    <>
      <Header />
      {children}
      <Footer />
    </>
  );
}
