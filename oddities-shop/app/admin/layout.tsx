"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

const ADMIN_EMAIL = "coldbratpokes@gmail.com";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  useEffect(() => {
    async function checkAuth() {
      // Allow upload page to handle its own auth
      if (pathname === "/admin/upload") return;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || user.email !== ADMIN_EMAIL) {
        window.location.href = "/";
      }
    }

    checkAuth();
  }, [pathname]);

  return <>{children}</>;
}
