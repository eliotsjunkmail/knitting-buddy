import { redirect, notFound } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import PatternViewer from "@/components/PatternViewer";

export default async function PatternPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser();
  if (!auth) redirect("/");

  const { id } = await params;
  const pattern = await prisma.pattern.findFirst({
    where: { id, userId: auth.userId },
    include: { progress: true },
  });

  if (!pattern) notFound();

  return (
    <PatternViewer
      pattern={{
        id: pattern.id,
        name: pattern.name,
        rows: pattern.rows as { label: string; steps: string[] }[],
        imageData: pattern.imageData,
        progress: pattern.progress
          ? {
              currentRow: pattern.progress.currentRow,
              currentStep: pattern.progress.currentStep,
              lastUsed: pattern.progress.lastUsed.toISOString(),
              timePerStep: pattern.progress.timePerStep as Record<string, number>,
            }
          : null,
      }}
    />
  );
}
