"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/providers";
import { DashboardProvider, useDashboard } from "@/lib/dashboard";
import { Shell, TabKey } from "@/components/Shell";
import { PainelTab } from "@/components/tabs/PainelTab";
import { FaturasTab } from "@/components/tabs/FaturasTab";
import { MetasTab } from "@/components/tabs/MetasTab";
import { AtividadesTab } from "@/components/tabs/AtividadesTab";

function TabBody({ tab }: { tab: TabKey }) {
  const { loading, error } = useDashboard();

  if (error) {
    return <div className="center-note">⚠️ {error}</div>;
  }
  if (loading) {
    return <div className="center-note">Abrindo a ficha…</div>;
  }

  switch (tab) {
    case "painel":
      return <PainelTab />;
    case "faturas":
      return <FaturasTab />;
    case "metas":
      return <MetasTab />;
    case "atividades":
      return <AtividadesTab />;
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const { loading, me, households, currentHouseholdId } = useAuth();
  const [tab, setTab] = useState<TabKey>("painel");

  useEffect(() => {
    if (loading) return;
    if (!me) {
      router.replace("/login");
    } else if (households.length === 0) {
      router.replace("/onboarding");
    }
  }, [loading, me, households.length, router]);

  if (loading || !me || !currentHouseholdId) {
    return <div className="center-note">Carregando…</div>;
  }

  return (
    <DashboardProvider householdId={currentHouseholdId} key={currentHouseholdId}>
      <Shell tab={tab} onTab={setTab}>
        <TabBody tab={tab} />
      </Shell>
    </DashboardProvider>
  );
}
