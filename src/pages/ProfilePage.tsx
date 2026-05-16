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

interface Banner {
  kind: "success" | "error";
  text: string;
}

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

  if (loading) return <div className="loading">Loading profile…</div>;
  if (!profile) {
    return (
      <div className="profile-page">
        <div className="page-header">
          <h2>Profile settings</h2>
        </div>
        {banner && <div className={`banner banner-${banner.kind}`}>{banner.text}</div>}
      </div>
    );
  }

  const fullName = `${profile.fName} ${profile.lName}`.trim();
  const ssn = profile.socialNumber ?? "";

  return (
    <div className="profile-page">
      <div className="page-header">
        <h2>Profile settings</h2>
        <span className="page-subtitle">{session?.orgName}</span>
      </div>

      {banner && (
        <div className={`banner banner-${banner.kind}`} role="status">
          {banner.text}
        </div>
      )}

      {/* Name section */}
      <section className="profile-card">
        <div className="profile-card-header">
          <h3>Name</h3>
          {permissions?.allowNameChange &&
            (editingName ? null : (
              <button
                type="button"
                className="btn-secondary"
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
          <form onSubmit={saveName} className="profile-form">
            <div className="profile-form-row">
              <label>
                <span>First name</span>
                <input
                  type="text"
                  value={fName}
                  onChange={(e) => {
                    setFName(e.target.value);
                  }}
                  required
                />
              </label>
              <label>
                <span>Last name</span>
                <input
                  type="text"
                  value={lName}
                  onChange={(e) => {
                    setLName(e.target.value);
                  }}
                  required
                />
              </label>
            </div>
            <div className="profile-form-actions">
              <button type="submit" className="btn-primary inline" disabled={savingName}>
                {savingName ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                className="btn-secondary"
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
          <div className="profile-value">{fullName}</div>
        )}
        {!permissions?.allowNameChange && (
          <div className="profile-hint">Your school doesn't allow name changes via the app.</div>
        )}
      </section>

      {/* Address section */}
      <section className="profile-card">
        <div className="profile-card-header">
          <h3>Address</h3>
          {permissions?.allowAddressChange &&
            (editingAddress ? null : (
              <button
                type="button"
                className="btn-secondary"
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
          <form onSubmit={saveAddress} className="profile-form">
            <label>
              <span>Address line 1</span>
              <input
                type="text"
                value={address1}
                onChange={(e) => {
                  setAddress1(e.target.value);
                }}
              />
            </label>
            <label>
              <span>Address line 2</span>
              <input
                type="text"
                value={address2}
                onChange={(e) => {
                  setAddress2(e.target.value);
                }}
              />
            </label>
            <div className="profile-form-row">
              <label style={{ maxWidth: "140px" }}>
                <span>Postal code</span>
                <input
                  type="text"
                  value={poCode}
                  onChange={(e) => {
                    setPoCode(e.target.value);
                  }}
                />
              </label>
              <label>
                <span>City</span>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => {
                    setCity(e.target.value);
                  }}
                />
              </label>
            </div>
            <div className="profile-form-actions">
              <button type="submit" className="btn-primary inline" disabled={savingAddress}>
                {savingAddress ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                className="btn-secondary"
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
          <div className="profile-value">
            {[profile.address1, profile.address2].filter(Boolean).join(", ") || "—"}
            <br />
            {[profile.poCode, profile.city].filter(Boolean).join(" ") || ""}
          </div>
        )}
        {!permissions?.allowAddressChange && (
          <div className="profile-hint">Your school doesn't allow address changes via the app.</div>
        )}
      </section>

      {/* Contact section */}
      <section className="profile-card">
        <div className="profile-card-header">
          <h3>Contact</h3>
          {!editingContact && (
            <button
              type="button"
              className="btn-secondary"
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
          <form onSubmit={saveContact} className="profile-form">
            <label>
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                }}
              />
            </label>
            <div className="profile-form-row">
              <label>
                <span>Mobile</span>
                <input
                  type="tel"
                  value={mobile}
                  onChange={(e) => {
                    setMobile(e.target.value);
                  }}
                />
              </label>
              <label>
                <span>Home phone</span>
                <input
                  type="tel"
                  value={homePhone}
                  onChange={(e) => {
                    setHomePhone(e.target.value);
                  }}
                />
              </label>
              <label>
                <span>Work phone</span>
                <input
                  type="tel"
                  value={workPhone}
                  onChange={(e) => {
                    setWorkPhone(e.target.value);
                  }}
                />
              </label>
            </div>
            <label>
              <span>Other contact info</span>
              <input
                type="text"
                value={contactInfo}
                onChange={(e) => {
                  setContactInfo(e.target.value);
                }}
              />
            </label>
            <div className="profile-form-actions">
              <button type="submit" className="btn-primary inline" disabled={savingContact}>
                {savingContact ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                className="btn-secondary"
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
          <dl className="profile-dl">
            <dt>Email</dt>
            <dd>{profile.email || "—"}</dd>
            <dt>Mobile</dt>
            <dd>{profile.mobile || "—"}</dd>
            {profile.homePhone && (
              <>
                <dt>Home phone</dt>
                <dd>{profile.homePhone}</dd>
              </>
            )}
            {profile.workPhone && (
              <>
                <dt>Work phone</dt>
                <dd>{profile.workPhone}</dd>
              </>
            )}
            {profile.contactInfo && (
              <>
                <dt>Other contact info</dt>
                <dd>{profile.contactInfo}</dd>
              </>
            )}
          </dl>
        )}
      </section>

      {/* Identity (read-only SSN) */}
      <section className="profile-card">
        <div className="profile-card-header">
          <h3>Identity</h3>
        </div>
        <dl className="profile-dl">
          <dt>Social security number</dt>
          <dd>
            {ssn ? (
              <>
                <span className="profile-ssn">{revealSsn ? ssn : "•••••• – ••••"}</span>
                <button
                  type="button"
                  className="btn-link inline-link"
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
        <div className="profile-hint">
          Your social security number is never shown to other students or guardians, regardless of
          the privacy setting below.
        </div>
      </section>

      {/* Privacy / hide profile */}
      <section className="profile-card">
        <div className="profile-card-header">
          <h3>Privacy</h3>
        </div>
        <div className="profile-toggle-row">
          <div className="profile-toggle-info">
            <div className="profile-toggle-label">Hide my profile</div>
            <div className="profile-toggle-help">
              When on, students and other guardians at your child's schools can't see your user
              account or contact details. School staff and administrators can still see you.
            </div>
          </div>
          <label
            className={`switch ${savingNotPublish ? "is-saving" : ""}`}
            aria-label="Hide my profile"
          >
            <input
              type="checkbox"
              checked={!!profile.notPublish}
              disabled={savingNotPublish}
              onChange={(e) => {
                void toggleHideProfile(e.target.checked);
              }}
            />
            <span className="switch-track">
              <span className="switch-thumb" />
            </span>
          </label>
        </div>
      </section>
    </div>
  );
}
