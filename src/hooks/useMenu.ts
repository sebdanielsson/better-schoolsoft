import { useSchoolsoftContext } from "./useSchoolsoftContext.tsx";
import { useQuery } from "./useQuery.ts";
import { fetchEvaMenu } from "../api/schoolsoft.ts";
import { menuFromResponse, menuKey, type Menu } from "../lib/menu.ts";

/** The child in focus's menu (see `lib/menu.ts`), or `null` while it loads
 *  or if it couldn't be read, in which case every section stays visible. */
export function useMenu(): Menu {
  const ctx = useSchoolsoftContext();
  const { data } = useQuery(
    ctx && menuKey(ctx.keyPrefix),
    async () =>
      menuFromResponse(
        await fetchEvaMenu(
          ctx!.school,
          await ctx!.token(),
          ctx!.parentUserId,
          ctx!.orgId,
          ctx!.studentId,
        ),
      ),
    { staleMs: 30 * 60_000 },
  );
  /* An empty menu is more likely a glitch than a child with no modules. */
  return data && data.size > 0 ? data : null;
}
