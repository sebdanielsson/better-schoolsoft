import { type FormEvent, useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth.tsx";
import {
  fetchEvaParent,
  fetchEvaParentProfile,
  fetchEvaProfilePermissions,
  updateEvaProfileAddress,
  updateEvaProfileContact,
  updateEvaProfileName,
  updateEvaProfileNotPublish,
  type EvaParentProfile,
  type EvaProfilePermissions,
} from "../api/schoolsoft.ts";
import { cn } from "../lib/utils.ts";

interface Banner {
  kind: "success" | "error";
  text: string;
}

/* Reused throughout the page — one card per section. */
const cardClass = "bg-white border border-slate-200 rounded-lg shadow-sm px-6 py-5";
const cardHeaderClass = "flex items-center justify-between mb-3";
const cardHeadingClass = "text-[1.05rem] font-bold tracking-[-0.01em]";

/* Form helpers. Labels stack their span (uppercase caption) above the input. */
const formClass = "flex flex-col gap-3";
const formRowClass = "flex gap-3 flex-wrap";
const formActionsClass = "flex gap-2 mt-1";
const formLabelClass = "flex flex-col gap-[0.3rem] flex-1";
const formCaptionClass = "text-[0.78rem] font-semibold text-slate-500 uppercase tracking-[0.02em]";
const formInputClass =
  "px-3 py-[0.55rem] border border-slate-200 rounded-md text-[0.95rem] font-[inherit] bg-white focus:outline-none focus:border-blue-600 focus:shadow-[0_0_0_3px_rgba(37,99,235,0.15)]";

/* Buttons. Primary "inline" is the small variant used inside form actions. */
const btnPrimaryInlineClass =
  "bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer border-0";
const btnSecondaryClass =
  "bg-white border border-slate-200 text-slate-900 px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-50 hover:border-slate-300 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer";

/* Read-only value displays and helper text. */
const valueClass = "text-base text-slate-900 leading-[1.55]";
const hintClass = "mt-[0.65rem] text-[0.8rem] text-slate-500";

/* Description list grid used for Contact + Identity sections. */
const dlClass = "grid grid-cols-[max-content_1fr] gap-y-[0.4rem] gap-x-5 text-[0.92rem]";
const dtClass = "font-semibold text-slate-500 text-[0.78rem] tracking-[0.02em] uppercase pt-1";
const ddClass = "text-slate-900 flex items-center gap-2 flex-wrap";

export default function ProfilePage() {
  const { session, getEvaToken } = useAuth();
  const [profile, setProfile] = useState<EvaParentProfile | null>(null);
  const [permissions, setPermissions] = useState<EvaProfilePermissions | null>(null);
  const [userId, setUserId] = useState<number | null>(session?.userId ?? null);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<Banner | null>(null);

  const [editingName, setEditingName] = useState(false);
  const [fName, setFName] = useState("");
  const [lName, setLName] = useState("");
  const [savingName, setSavingName] = useState(false);

  const [editingAddress, setEditingAddress] = useState(false);
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [poCode, setPoCode] = useState("");
  const [city, setCity] = useState("");
  const [savingAddress, setSavingAddress] = useState(false);

  const [editingContact, setEditingContact] = useState(false);
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [homePhone, setHomePhone] = useState("");
  const [workPhone, setWorkPhone] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [savingContact, setSavingContact] = useState(false);

  const [savingNotPublish, setSavingNotPublish] = useState(false);

  const [revealSsn, setRevealSsn] = useState(false);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const token = await getEvaToken();
        if (!token) throw new Error("Sign in via SchoolSoft to view your profile");

        let uid = session.userId;
        if (!uid) {
          const parent = await fetchEvaParent(session.school, token);
          uid = parent.userId;
        }
        if (cancelled) return;
        setUserId(uid);

        const [p, perms] = await Promise.all([
          fetchEvaParentProfile(session.school, token, uid),
          fetchEvaProfilePermissions(session.school, token, session.orgId),
        ]);
        if (cancelled) return;
        setProfile(p);
        setPermissions(perms);
        setFName(p.fName ?? "");
        setLName(p.lName ?? "");
        setAddress1(p.address1 ?? "");
        setAddress2(p.address2 ?? "");
        setPoCode(p.poCode ?? "");
        setCity(p.city ?? "");
        setEmail(p.email ?? "");
        setMobile(p.mobile ?? "");
        setHomePhone(p.homePhone ?? "");
        setWorkPhone(p.workPhone ?? "");
        setContactInfo(p.contactInfo ?? "");
      } catch (e) {
        if (!cancelled) {
          setBanner({
            kind: "error",
            text: e instanceof Error ? e.message : "Could not load profile",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, getEvaToken]);

  async function saveName(e: FormEvent) {
    e.preventDefault();
    if (!session || !userId) return;
    setSavingName(true);
    setBanner(null);
    try {
      const token = await getEvaToken();
      if (!token) throw new Error("Authentication expired");
      await updateEvaProfileName(session.school, token, userId, {
        fName: fName.trim(),
        lName: lName.trim(),
      });
      setProfile((p) => (p ? { ...p, fName: fName.trim(), lName: lName.trim() } : p));
      setEditingName(false);
      setBanner({ kind: "success", text: "Name saved." });
    } catch (e) {
      setBanner({ kind: "error", text: e instanceof Error ? e.message : "Could not save name" });
    } finally {
      setSavingName(false);
    }
  }

  async function saveAddress(e: FormEvent) {
    e.preventDefault();
    if (!session || !userId) return;
    setSavingAddress(true);
    setBanner(null);
    try {
      const token = await getEvaToken();
      if (!token) throw new Error("Authentication expired");
      await updateEvaProfileAddress(session.school, token, userId, {
        address1: address1.trim(),
        address2: address2.trim(),
        poCode: poCode.trim(),
        city: city.trim(),
      });
      setProfile((p) =>
        p
          ? {
              ...p,
              address1: address1.trim(),
              address2: address2.trim(),
              poCode: poCode.trim(),
              city: city.trim(),
            }
          : p,
      );
      setEditingAddress(false);
      setBanner({ kind: "success", text: "Address saved." });
    } catch (e) {
      setBanner({
        kind: "error",
        text: e instanceof Error ? e.message : "Could not save address",
      });
    } finally {
      setSavingAddress(false);
    }
  }

  async function saveContact(e: FormEvent) {
    e.preventDefault();
    if (!session || !userId) return;
    setSavingContact(true);
    setBanner(null);
    try {
      const token = await getEvaToken();
      if (!token) throw new Error("Authentication expired");
      const body = {
        email: email.trim(),
        mobile: mobile.trim(),
        homePhone: homePhone.trim(),
        workPhone: workPhone.trim(),
        contactInfo: contactInfo.trim(),
        orgId: session.orgId,
      };
      await updateEvaProfileContact(session.school, token, userId, body);
      setProfile((p) =>
        p
          ? {
              ...p,
              email: body.email,
              mobile: body.mobile,
              homePhone: body.homePhone,
              workPhone: body.workPhone,
              contactInfo: body.contactInfo,
            }
          : p,
      );
      setEditingContact(false);
      setBanner({ kind: "success", text: "Contact details saved." });
    } catch (e) {
      setBanner({
        kind: "error",
        text: e instanceof Error ? e.message : "Could not save contact details",
      });
    } finally {
      setSavingContact(false);
    }
  }

  async function toggleHideProfile(hide: boolean) {
    if (!session || !userId || !profile) return;
    /* Optimistic update + rollback on error. */
    const prev = profile.notPublish ?? false;
    setProfile((p) => (p ? { ...p, notPublish: hide } : p));
    setSavingNotPublish(true);
    setBanner(null);
    try {
      const token = await getEvaToken();
      if (!token) throw new Error("Authentication expired");
      await updateEvaProfileNotPublish(session.school, token, userId, hide);
      setBanner({
        kind: "success",
        text: hide ? "Your profile is now hidden from others." : "Your profile is visible again.",
      });
    } catch (e) {
      setProfile((p) => (p ? { ...p, notPublish: prev } : p));
      setBanner({
        kind: "error",
        text: e instanceof Error ? e.message : "Could not update visibility",
      });
    } finally {
      setSavingNotPublish(false);
    }
  }

  if (loading)
    return (
      <div className="py-16 px-8 text-center text-slate-500 text-[0.95rem]">Loading profile…</div>
    );
  if (!profile) {
    return (
      <div className="flex flex-col gap-4 max-w-[720px] mx-auto">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <h2 className="text-2xl font-bold tracking-tight">Profile settings</h2>
        </div>
        {banner && <BannerView banner={banner} />}
      </div>
    );
  }

  const fullName = `${profile.fName} ${profile.lName}`.trim();
  const ssn = profile.socialNumber ?? "";
  const notPublish = !!profile.notPublish;

  return (
    <div className="flex flex-col gap-4 max-w-[720px] mx-auto">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h2 className="text-2xl font-bold tracking-tight">Profile settings</h2>
        <span className="text-[0.85rem] text-slate-500">{session?.orgName}</span>
      </div>

      {banner && <BannerView banner={banner} role="status" />}

      {/* Name section */}
      <section className={cardClass}>
        <div className={cardHeaderClass}>
          <h3 className={cardHeadingClass}>Name</h3>
          {permissions?.allowNameChange &&
            (editingName ? null : (
              <button
                type="button"
                className={btnSecondaryClass}
                onClick={() => {
                  setEditingName(true);
                  setBanner(null);
                }}
              >
                Edit
              </button>
            ))}
        </div>
        {editingName ? (
          <form onSubmit={saveName} className={formClass}>
            <div className={formRowClass}>
              <label className={formLabelClass}>
                <span className={formCaptionClass}>First name</span>
                <input
                  type="text"
                  className={formInputClass}
                  value={fName}
                  onChange={(e) => {
                    setFName(e.target.value);
                  }}
                  required
                />
              </label>
              <label className={formLabelClass}>
                <span className={formCaptionClass}>Last name</span>
                <input
                  type="text"
                  className={formInputClass}
                  value={lName}
                  onChange={(e) => {
                    setLName(e.target.value);
                  }}
                  required
                />
              </label>
            </div>
            <div className={formActionsClass}>
              <button type="submit" className={btnPrimaryInlineClass} disabled={savingName}>
                {savingName ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                className={btnSecondaryClass}
                disabled={savingName}
                onClick={() => {
                  setEditingName(false);
                  setFName(profile.fName);
                  setLName(profile.lName);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className={valueClass}>{fullName}</div>
        )}
        {!permissions?.allowNameChange && (
          <div className={hintClass}>Your school doesn't allow name changes via the app.</div>
        )}
      </section>

      {/* Address section */}
      <section className={cardClass}>
        <div className={cardHeaderClass}>
          <h3 className={cardHeadingClass}>Address</h3>
          {permissions?.allowAddressChange &&
            (editingAddress ? null : (
              <button
                type="button"
                className={btnSecondaryClass}
                onClick={() => {
                  setEditingAddress(true);
                  setBanner(null);
                }}
              >
                Edit
              </button>
            ))}
        </div>
        {editingAddress ? (
          <form onSubmit={saveAddress} className={formClass}>
            <label className={formLabelClass}>
              <span className={formCaptionClass}>Address line 1</span>
              <input
                type="text"
                className={formInputClass}
                value={address1}
                onChange={(e) => {
                  setAddress1(e.target.value);
                }}
              />
            </label>
            <label className={formLabelClass}>
              <span className={formCaptionClass}>Address line 2</span>
              <input
                type="text"
                className={formInputClass}
                value={address2}
                onChange={(e) => {
                  setAddress2(e.target.value);
                }}
              />
            </label>
            <div className={formRowClass}>
              <label className={cn(formLabelClass, "max-w-[140px]")}>
                <span className={formCaptionClass}>Postal code</span>
                <input
                  type="text"
                  className={formInputClass}
                  value={poCode}
                  onChange={(e) => {
                    setPoCode(e.target.value);
                  }}
                />
              </label>
              <label className={formLabelClass}>
                <span className={formCaptionClass}>City</span>
                <input
                  type="text"
                  className={formInputClass}
                  value={city}
                  onChange={(e) => {
                    setCity(e.target.value);
                  }}
                />
              </label>
            </div>
            <div className={formActionsClass}>
              <button type="submit" className={btnPrimaryInlineClass} disabled={savingAddress}>
                {savingAddress ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                className={btnSecondaryClass}
                disabled={savingAddress}
                onClick={() => {
                  setEditingAddress(false);
                  setAddress1(profile.address1 ?? "");
                  setAddress2(profile.address2 ?? "");
                  setPoCode(profile.poCode ?? "");
                  setCity(profile.city ?? "");
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className={valueClass}>
            {[profile.address1, profile.address2].filter(Boolean).join(", ") || "—"}
            <br />
            {[profile.poCode, profile.city].filter(Boolean).join(" ") || ""}
          </div>
        )}
        {!permissions?.allowAddressChange && (
          <div className={hintClass}>Your school doesn't allow address changes via the app.</div>
        )}
      </section>

      {/* Contact section */}
      <section className={cardClass}>
        <div className={cardHeaderClass}>
          <h3 className={cardHeadingClass}>Contact</h3>
          {!editingContact && (
            <button
              type="button"
              className={btnSecondaryClass}
              onClick={() => {
                setEditingContact(true);
                setBanner(null);
              }}
            >
              Edit
            </button>
          )}
        </div>
        {editingContact ? (
          <form onSubmit={saveContact} className={formClass}>
            <label className={formLabelClass}>
              <span className={formCaptionClass}>Email</span>
              <input
                type="email"
                className={formInputClass}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                }}
              />
            </label>
            <div className={formRowClass}>
              <label className={formLabelClass}>
                <span className={formCaptionClass}>Mobile</span>
                <input
                  type="tel"
                  className={formInputClass}
                  value={mobile}
                  onChange={(e) => {
                    setMobile(e.target.value);
                  }}
                />
              </label>
              <label className={formLabelClass}>
                <span className={formCaptionClass}>Home phone</span>
                <input
                  type="tel"
                  className={formInputClass}
                  value={homePhone}
                  onChange={(e) => {
                    setHomePhone(e.target.value);
                  }}
                />
              </label>
              <label className={formLabelClass}>
                <span className={formCaptionClass}>Work phone</span>
                <input
                  type="tel"
                  className={formInputClass}
                  value={workPhone}
                  onChange={(e) => {
                    setWorkPhone(e.target.value);
                  }}
                />
              </label>
            </div>
            <label className={formLabelClass}>
              <span className={formCaptionClass}>Other contact info</span>
              <input
                type="text"
                className={formInputClass}
                value={contactInfo}
                onChange={(e) => {
                  setContactInfo(e.target.value);
                }}
              />
            </label>
            <div className={formActionsClass}>
              <button type="submit" className={btnPrimaryInlineClass} disabled={savingContact}>
                {savingContact ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                className={btnSecondaryClass}
                disabled={savingContact}
                onClick={() => {
                  setEditingContact(false);
                  setEmail(profile.email ?? "");
                  setMobile(profile.mobile ?? "");
                  setHomePhone(profile.homePhone ?? "");
                  setWorkPhone(profile.workPhone ?? "");
                  setContactInfo(profile.contactInfo ?? "");
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <dl className={dlClass}>
            <dt className={dtClass}>Email</dt>
            <dd className={ddClass}>{profile.email || "—"}</dd>
            <dt className={dtClass}>Mobile</dt>
            <dd className={ddClass}>{profile.mobile || "—"}</dd>
            {profile.homePhone && (
              <>
                <dt className={dtClass}>Home phone</dt>
                <dd className={ddClass}>{profile.homePhone}</dd>
              </>
            )}
            {profile.workPhone && (
              <>
                <dt className={dtClass}>Work phone</dt>
                <dd className={ddClass}>{profile.workPhone}</dd>
              </>
            )}
            {profile.contactInfo && (
              <>
                <dt className={dtClass}>Other contact info</dt>
                <dd className={ddClass}>{profile.contactInfo}</dd>
              </>
            )}
          </dl>
        )}
      </section>

      {/* Identity (read-only SSN) */}
      <section className={cardClass}>
        <div className={cardHeaderClass}>
          <h3 className={cardHeadingClass}>Identity</h3>
        </div>
        <dl className={dlClass}>
          <dt className={dtClass}>Social security number</dt>
          <dd className={ddClass}>
            {ssn ? (
              <>
                <span className="font-mono text-[0.9rem] tracking-[0.05em] bg-slate-50 px-2 py-[0.15em] rounded">
                  {revealSsn ? ssn : "•••••• – ••••"}
                </span>
                <button
                  type="button"
                  className="text-blue-600 text-xs underline-offset-2 hover:underline cursor-pointer bg-transparent border-0 px-2 py-[0.15rem]"
                  onClick={() => {
                    setRevealSsn((v) => !v);
                  }}
                >
                  {revealSsn ? "Hide" : "Show"}
                </button>
              </>
            ) : (
              "—"
            )}
          </dd>
        </dl>
        <div className={hintClass}>
          Your social security number is never shown to other students or guardians, regardless of
          the privacy setting below.
        </div>
      </section>

      {/* Privacy / hide profile */}
      <section className={cardClass}>
        <div className={cardHeaderClass}>
          <h3 className={cardHeadingClass}>Privacy</h3>
        </div>
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[0.95rem] mb-[0.2rem]">Hide my profile</div>
            <div className="text-[0.82rem] text-slate-500 leading-[1.5]">
              When on, students and other guardians at your child's schools can't see your user
              account or contact details. School staff and administrators can still see you.
            </div>
          </div>
          <label
            className="relative inline-block w-12 h-7 shrink-0 cursor-pointer"
            aria-label="Hide my profile"
          >
            <input
              type="checkbox"
              className="peer absolute inset-0 m-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
              checked={notPublish}
              disabled={savingNotPublish}
              onChange={(e) => {
                void toggleHideProfile(e.target.checked);
              }}
            />
            <span
              className={cn(
                "absolute inset-0 rounded-full transition-colors duration-[0.18s]",
                "bg-slate-300 peer-checked:bg-blue-600",
                "peer-focus-visible:shadow-[0_0_0_3px_rgba(37,99,235,0.25)]",
                savingNotPublish && "opacity-60",
              )}
            >
              <span
                className={cn(
                  "absolute top-[3px] left-[3px] w-[22px] h-[22px] rounded-full bg-white",
                  "shadow-[0_2px_4px_rgba(15,23,42,0.18)] transition-transform duration-[0.18s]",
                  notPublish && "translate-x-[20px]",
                )}
              />
            </span>
          </label>
        </div>
      </section>
    </div>
  );
}

function BannerView({ banner, role }: { banner: Banner; role?: "status" }) {
  const tone =
    banner.kind === "success"
      ? "bg-green-50 border-green-200 text-green-800"
      : "bg-red-50 border-red-200 text-red-800";
  return (
    <div role={role} className={cn("px-4 py-[0.7rem] rounded-lg text-sm border", tone)}>
      {banner.text}
    </div>
  );
}
