import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, inArray, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { diaryEntries, diaryPhotos } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { PILL_CLASS } from "@/lib/ui";
import { DiaryForm } from "./diary-form";
import { DiaryEntryCard, type DiaryEntryData } from "./diary-entry-card";

// Reads live per-user data -- must not be statically prerendered.
export const dynamic = "force-dynamic";

export default async function DiaryPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const entries = await db
    .select()
    .from(diaryEntries)
    .where(eq(diaryEntries.userId, user.id))
    .orderBy(desc(diaryEntries.entryDate), desc(diaryEntries.createdAt));

  const photos =
    entries.length === 0
      ? []
      : await db
          .select()
          .from(diaryPhotos)
          .where(inArray(diaryPhotos.entryId, entries.map((e) => e.id)))
          .orderBy(asc(diaryPhotos.createdAt));

  const photosByEntry = new Map<string, { id: string; photoUrl: string }[]>();
  for (const p of photos) {
    const arr = photosByEntry.get(p.entryId) ?? [];
    arr.push({ id: p.id, photoUrl: p.photoUrl });
    photosByEntry.set(p.entryId, arr);
  }

  const data: DiaryEntryData[] = entries.map((e) => ({
    id: e.id,
    entryDate: e.entryDate,
    weightLbs: e.weightLbs,
    note: e.note,
    photos: photosByEntry.get(e.id) ?? [],
  }));

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Diary</h1>
        <Link href="/" className={`${PILL_CLASS} bg-brutal-yellow`}>
          ← Home
        </Link>
      </div>
      <p className="-mt-2 text-sm font-medium opacity-70">
        Private to you -- daily progress photos, weight, and notes.
      </p>

      <DiaryForm />

      {data.length === 0 ? (
        <p className="text-center text-sm font-bold opacity-60">No entries yet.</p>
      ) : (
        data.map((entry) => <DiaryEntryCard key={entry.id} entry={entry} />)
      )}
    </main>
  );
}
