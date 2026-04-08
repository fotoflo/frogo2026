"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import analytics from "@/lib/analytics";

export default function AnalyticsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  useEffect(() => {
    analytics.page();
  }, [pathname]);

  return <>{children}</>;
}
