import { useState } from "react";
import { ExternalLink, FileText, Globe, MapPin } from "lucide-react";
import { useSchoolsoftContext, type SchoolsoftContext } from "../hooks/useSchoolsoftContext.tsx";
import { useQuery } from "../hooks/useQuery.tsx";
import { fetchLegacyPage, fetchLibraryFile } from "../api/schoolsoft.ts";
import { parseLibrary, parseSchoolInfo, type LibraryFile } from "../lib/legacy-pages.ts";
import { saveBlob } from "../lib/download.ts";
import DashCard, { DashCardEmpty, ErrorBanner } from "../components/DashCard.tsx";
import { Skeleton } from "../components/ui/skeleton.tsx";

const schoolKeys = {
  info: (prefix: string) => `${prefix}legacy:school`,
  library: (prefix: string) => `${prefix}legacy:library`,
};

/** School information and the school's shared files & links. Both only exist
 *  as server-rendered pages upstream; see lib/legacy-pages.ts. */
export default function SchoolPage() {
  const ctx = useSchoolsoftContext();
  const info = useQuery(
    ctx && schoolKeys.info(ctx.keyPrefix),
    async () => {
      await ctx!.cookieSession();
      const html = await fetchLegacyPage(ctx!.school, "right_student_school.jsp");
      return html ? parseSchoolInfo(html) : [];
    },
    { staleMs: 60 * 60_000 },
  );
  const library = useQuery(
    ctx && schoolKeys.library(ctx.keyPrefix),
    async () => {
      await ctx!.cookieSession();
      const html = await fetchLegacyPage(ctx!.school, "right_student_library.jsp");
      return html ? parseLibrary(html) : [];
    },
    { staleMs: 30 * 60_000 },
  );

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-2xl font-bold tracking-tight">School</h2>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-12">
        <DashCard title="About the school" accent="cool" className="md:col-span-4">
          {info.error && <ErrorBanner>{info.error.message}</ErrorBanner>}
          {info.loading ? (
            <Skeleton className="h-24 rounded-md" />
          ) : !info.data || info.data.length === 0 ? (
            <DashCardEmpty>No school information published.</DashCardEmpty>
          ) : (
            <dl className="flex flex-col gap-3 text-[0.9rem]">
              {info.data.map((row) => (
                <div key={row.label} className="flex gap-2.5">
                  {row.href ? (
                    <Globe className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                  ) : (
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                  )}
                  <div className="min-w-0">
                    <dt className="text-xs font-semibold text-slate-500">{row.label}</dt>
                    <dd className="m-0">
                      {row.href ? (
                        <a
                          href={row.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="break-all text-blue-600 hover:underline"
                        >
                          {row.lines.join(" ")}
                        </a>
                      ) : (
                        row.lines.map((l, i) => <div key={i}>{l}</div>)
                      )}
                    </dd>
                  </div>
                </div>
              ))}
            </dl>
          )}
        </DashCard>

        <DashCard title="Files & links" accent="purple" className="md:col-span-8">
          {library.error && <ErrorBanner>{library.error.message}</ErrorBanner>}
          {library.loading ? (
            <div className="flex flex-col gap-1.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 rounded-md" />
              ))}
            </div>
          ) : !library.data || library.data.length === 0 ? (
            <DashCardEmpty>The school hasn't shared any files or links.</DashCardEmpty>
          ) : (
            <div className="flex flex-col gap-4">
              {library.data.map((cat) => (
                <section key={`${cat.section}/${cat.category}`}>
                  {(library.data?.length ?? 0) > 1 && (
                    <h4 className="mb-1.5 text-xs font-semibold tracking-[0.05em] text-slate-500 uppercase">
                      {cat.category || cat.section}
                    </h4>
                  )}
                  <ul className="grid grid-cols-1 gap-1.5 lg:grid-cols-2">
                    {cat.items.map((item) => (
                      <li key={item.kind === "file" ? `f${item.requestId}` : `l${item.href}`}>
                        {item.kind === "file" ? (
                          <FileItem ctx={ctx!} file={item} />
                        ) : (
                          <a
                            href={item.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="grid h-full grid-cols-[auto_1fr] gap-2.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-inherit no-underline transition-colors hover:border-slate-300 hover:shadow-sm"
                          >
                            <ExternalLink
                              className="mt-0.5 h-4 w-4 text-sky-600"
                              aria-hidden="true"
                            />
                            <ItemText
                              title={item.title}
                              description={item.description}
                              meta={new URL(item.href).hostname}
                            />
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </DashCard>
      </div>
    </div>
  );
}

function FileItem({ ctx, file }: { ctx: SchoolsoftContext; file: LibraryFile }) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  async function download() {
    setState("loading");
    try {
      await ctx.cookieSession();
      saveBlob(await fetchLibraryFile(ctx.school, file.requestId), file.fileName);
      setState("idle");
    } catch {
      setState("error");
    }
  }
  return (
    <button
      type="button"
      onClick={() => void download()}
      disabled={state === "loading"}
      className="grid h-full w-full grid-cols-[auto_1fr] gap-2.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-left transition-colors hover:border-slate-300 hover:shadow-sm disabled:opacity-60"
    >
      <FileText className="mt-0.5 h-4 w-4 text-violet-600" aria-hidden="true" />
      <ItemText
        title={file.title}
        description={file.description}
        meta={
          state === "loading"
            ? "Downloading…"
            : state === "error"
              ? "Download failed"
              : [file.fileName, file.size].filter(Boolean).join(" · ")
        }
      />
    </button>
  );
}

function ItemText({
  title,
  description,
  meta,
}: {
  title: string;
  description: string;
  meta: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[0.9rem] font-semibold">{title}</div>
      {description && (
        <div className="line-clamp-2 text-[0.8rem] text-slate-600">{description}</div>
      )}
      <div className="truncate text-[0.75rem] text-slate-400">{meta}</div>
    </div>
  );
}
