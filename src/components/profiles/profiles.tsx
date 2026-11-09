"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Empty, Input } from "@/components/ui/controls";
import { Badge, levelTone } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/app-shell";
import { FaceThumb } from "@/components/shared/face-thumb";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { fmt } from "@/lib/utils";
import type { AnalysisSummary, ProfileRow } from "@/server/repos";
import type { Award, RatingRecord, RatingSummary } from "@/server/repos-psl";
import { AwardsCard, RatingTimeline } from "@/components/compare/progress";
import { formatPsl } from "@/engine/psl/rating";
import { LegacyMethodTag } from "@/components/psl/legacy-tag";
import { paths } from "@/lib/paths";

export function ProfilesList({ profiles }: { profiles: ProfileRow[] }) {
  const { t, lang } = useT();
  const router = useRouter();
  const del = async (p: ProfileRow) => {
    if (!confirm(t("common.deleteConfirm"))) return;
    await api.deleteProfile(p.id);
    router.refresh();
  };
  return (
    <div className="space-y-6">
      <PageHeader kicker={t("nav.profiles")} title={t("profiles.title")} subtitle={t("profiles.sub")} />
      {profiles.length === 0 ? (
        <Empty>{t("profiles.empty")}</Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {profiles.map((p) => (
            <Card key={p.id} className="p-4 flex gap-4">
              <Link href={paths.profile(p.id)}>
                <FaceThumb imageId={p.imageId} label={p.label} size={72} />
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={paths.profile(p.id)} className="font-display font-semibold truncate block hover:text-accent">
                  {p.label}
                </Link>
                <div className="text-xs text-fg-3">
                  {t(p.analysisCount === 1 ? "profiles.oneAnalysis" : "profiles.nAnalyses", { n: p.analysisCount })} · {p.latestAt ? fmt.date(p.latestAt, lang) : "—"}
                </div>
                <div className="mt-1 font-display text-xl num">{fmt.score(p.latestOverall, 1)}</div>
                <div className="mt-2 flex gap-1">
                  <Link href={paths.profile(p.id)}>
                    <Button size="sm" variant="outline">{t("common.open")}</Button>
                  </Link>
                  <Button size="sm" variant="ghost" onClick={() => del(p)} title={t("common.delete")}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProfileDetail({ profile, analyses, ratings = [], ratingRecords = [], awards = [], participation = { completed: 0, total: 0 } }: { profile: ProfileRow; analyses: AnalysisSummary[]; ratings?: RatingSummary[]; ratingRecords?: RatingRecord[]; awards?: Award[]; participation?: { completed: number; total: number } }) {
  const { t, lang } = useT();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(profile.label);
  const rename = async () => {
    if (label.trim() && label.trim() !== profile.label) await api.renameProfile(profile.id, label.trim());
    setEditing(false);
    router.refresh();
  };
  const del = async () => {
    if (!confirm(t("common.deleteConfirm"))) return;
    await api.deleteProfile(profile.id);
    router.push("/profiles");
    router.refresh();
  };
  const delAnalysis = async (id: string) => {
    if (!confirm(t("common.deleteConfirm"))) return;
    await api.deleteAnalysis(id);
    router.refresh();
  };
  const scores = analyses.map((a) => a.overall).filter((v): v is number => v != null).reverse();
  return (
    <div className="space-y-6">
      <PageHeader
        kicker={t("nav.profiles")}
        title={
          editing ? (
            <span className="flex items-center gap-2">
              <Input value={label} onChange={(e) => setLabel(e.target.value)} className="max-w-xs" maxLength={60} autoFocus />
              <Button size="sm" onClick={rename}>{t("common.save")}</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>{t("common.cancel")}</Button>
            </span>
          ) : (
            <span className="flex items-center gap-3">
              <FaceThumb imageId={profile.imageId} label={profile.label} size={56} className="rounded-full" />
              {profile.label}
              <button onClick={() => setEditing(true)} className="text-fg-3 hover:text-fg-0" title={t("profiles.rename")}>
                <Pencil size={16} />
              </button>
            </span>
          )
        }
        subtitle={`${t(profile.analysisCount === 1 ? "profiles.oneAnalysis" : "profiles.nAnalyses", { n: profile.analysisCount })} · ${t("common.createdAt")} ${fmt.date(profile.createdAt, lang)}`}
        action={
          <div className="flex gap-2">
            <Link href={`/rater?profile=${profile.id}`}><Button size="sm">{t("dashboardPsl.rate")}</Button></Link>
            <Button variant="danger" size="sm" onClick={del}>
              <Trash2 size={14} /> {t("common.delete")}
            </Button>
          </div>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
        <RatingTimeline records={ratingRecords} />
        <Card>
          <CardHeader title={t("nav.history")} />
          <CardBody>
            {analyses.length === 0 ? (
              <Empty>{t("history.empty")}</Empty>
            ) : (
              <div className="-mx-1 overflow-x-auto px-1"><table className="w-full text-sm">
                <thead className="text-fg-3 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="text-left py-2">{t("common.createdAt")}</th>
                    <th className="text-right py-2">{t("common.overall")}</th>
                    <th className="text-right py-2">{t("analysis.harmony")}</th>
                    <th className="text-right py-2">{t("analysis.symmetryScore")}</th>
                    <th className="text-right py-2">{t("common.coverage")}</th>
                    <th className="text-left py-2 pl-3">{t("common.quality")}</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {analyses.map((a) => (
                    <tr key={a.id} className="border-t border-line">
                      <td className="py-2 text-xs">{fmt.date(a.createdAt, lang)}</td>
                      <td className="py-2 text-right font-mono num">{fmt.score(a.overall, 1)}</td>
                      <td className="py-2 text-right font-mono num text-fg-2">{fmt.score(a.harmony, 1)}</td>
                      <td className="py-2 text-right font-mono num text-fg-2">{fmt.score(a.symmetry, 1)}</td>
                      <td className="py-2 text-right font-mono num text-fg-2">{fmt.pct(a.coverageFraction)}</td>
                      <td className="py-2 pl-3">
                        <Badge tone={levelTone(a.qualityLevel)}>{t(`quality.${a.qualityLevel}`)}</Badge>
                      </td>
                      <td className="py-2 text-right whitespace-nowrap">
                        <Link href={paths.analysis(a.id)}>
                          <Button size="sm" variant="outline">{t("common.open")}</Button>
                        </Link>
                        <Button size="sm" variant="ghost" onClick={() => delAnalysis(a.id)} className="ml-1">
                          <Trash2 size={14} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </CardBody>
        </Card>
        </div>
        <div className="space-y-5">
        <AwardsCard awards={awards} entered={participation.completed} />
        <Card>
          <CardHeader title={t("historyPsl.ratings")} />
          <CardBody>
            {ratings.length === 0 ? (
              <Empty>{t("history.empty")}</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {ratings.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <Link href={paths.rating(r.id)} className="hover:text-accent">{fmt.date(r.createdAt, lang)}</Link>
                      <div className="text-xs text-fg-3">{r.scaleName} · {r.tierName ?? "—"}{r.provisional ? ` · ${t("rater.result.provisional")}` : ""}</div>
                    </div>
                    <LegacyMethodTag rubricVersion={r.rubricVersion} />
                    <span className="font-mono num">{formatPsl(r.score)}</span>
                    <Link href={paths.rating(r.id)}><Button size="sm" variant="outline">{t("common.open")}</Button></Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("profiles.latest")} />
          <CardBody>
            <div className="font-display text-4xl num">{fmt.score(profile.latestOverall, 1)}</div>
            {scores.length > 1 && (
              <svg viewBox="0 0 200 60" className="mt-3 w-full h-16">
                <polyline fill="none" stroke="#22d3ee" strokeWidth="2" points={scores.map((v, i) => `${(i / (scores.length - 1)) * 196 + 2},${58 - (v / 100) * 56}`).join(" ")} />
                {scores.map((v, i) => (
                  <circle key={i} cx={(i / (scores.length - 1)) * 196 + 2} cy={58 - (v / 100) * 56} r="2.5" fill="#22d3ee" />
                ))}
              </svg>
            )}
            <div className="text-xs text-fg-3 mt-2">{scores.length} {t("analysis.dataPoints")}</div>
          </CardBody>
        </Card>
        </div>
      </div>
    </div>
  );
}
