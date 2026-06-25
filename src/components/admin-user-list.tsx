import Link from "next/link";
import { convertDependentToAccount, deleteDependentAsAdmin, updateProfile } from "@/lib/actions/admin";
import { fullName } from "@/lib/format";
import type { Profile } from "@/lib/types";

type ShirtSizeOption = {
  id: string;
  label: string;
};

export function AdminUserList({
  profiles,
  shirtSizes,
  selectedProfile
}: {
  profiles: Profile[];
  shirtSizes: ShirtSizeOption[];
  selectedProfile: Profile | null;
}) {
  const ownerById = new Map(profiles.map((profile) => [profile.id, profile]));

  return (
    <>
      <div className="panel table-wrap">
        <h2>Users</h2>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Role</th>
              <th>Account type</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {profiles.length === 0 ? (
              <tr>
                <td colSpan={6}>No users yet.</td>
              </tr>
            ) : (
              profiles.map((profile) => (
                <tr key={profile.id}>
                  <td>{fullName(profile)}</td>
                  <td>{profile.email}</td>
                  <td>{profile.phone ?? "-"}</td>
                  <td>{profile.role}</td>
                  <td>
                    {profile.owner_profile_id
                      ? `Dependent of ${fullName(ownerById.get(profile.owner_profile_id) ?? { first_name: "", last_name: "" })}`
                      : "Login account"}
                  </td>
                  <td>
                    <Link className="button secondary" href={`/admin/users?edit=${profile.id}#edit-user-title`}>
                      Edit
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedProfile ? (
        <div className="user-dialog-backdrop">
          <div
            className="user-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-user-title"
          >
          <div className="user-dialog-content">
            <div className="user-dialog-header">
              <div>
                <h2 id="edit-user-title">Edit {fullName(selectedProfile)}</h2>
                <p className="muted">Update contact details, preferences, comments, or access level.</p>
              </div>
              <Link className="dialog-close" href="/admin/users" aria-label="Close">
                &times;
              </Link>
            </div>

            <form className="form" action={updateProfile}>
              <input type="hidden" name="id" value={selectedProfile.id} />
              <div className="grid two">
                <div className="field">
                  <label htmlFor="edit-first-name">First name</label>
                  <input id="edit-first-name" name="first_name" defaultValue={selectedProfile.first_name} required />
                </div>
                <div className="field">
                  <label htmlFor="edit-last-name">Last name</label>
                  <input id="edit-last-name" name="last_name" defaultValue={selectedProfile.last_name} required />
                </div>
              </div>
              <div className="grid three">
                <div className="field">
                  <label htmlFor="edit-email">Email</label>
                  <input
                    id="edit-email"
                    name="email"
                    type="email"
                    defaultValue={selectedProfile.email ?? ""}
                    required={Boolean(selectedProfile.auth_user_id)}
                    disabled={!selectedProfile.auth_user_id}
                  />
                </div>
                <div className="field">
                  <label htmlFor="edit-role">Role</label>
                  <select id="edit-role" name="role" defaultValue={selectedProfile.role} disabled={Boolean(selectedProfile.owner_profile_id)}>
                    <option value="attendee">Attendee</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="edit-phone">Phone</label>
                  <input id="edit-phone" name="phone" type="tel" defaultValue={selectedProfile.phone ?? ""} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="edit-shirt-size">T-shirt size</label>
                <select
                  id="edit-shirt-size"
                  name="shirt_size_id"
                  defaultValue={selectedProfile.shirt_size_id ?? ""}
                >
                  <option value="">Choose a size</option>
                  {shirtSizes.map((size) => (
                    <option key={size.id} value={size.id}>
                      {size.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid two">
                <PreferenceField
                  id="edit-allergies"
                  label="Allergies"
                  name="allergies"
                  values={selectedProfile.allergies}
                />
                <PreferenceField
                  id="edit-drinks"
                  label="Drink preferences"
                  name="drink_preferences"
                  values={selectedProfile.drink_preferences}
                />
                <PreferenceField
                  id="edit-snacks"
                  label="Snack preferences"
                  name="snack_preferences"
                  values={selectedProfile.snack_preferences}
                />
                <PreferenceField
                  id="edit-foods"
                  label="Food preferences"
                  name="food_preferences"
                  values={selectedProfile.food_preferences}
                />
              </div>
              <div className="field">
                <label htmlFor="edit-comments">User comments</label>
                <textarea id="edit-comments" name="comments" defaultValue={selectedProfile.comments ?? ""} />
              </div>
              <div className="field">
                <label htmlFor="edit-admin-notes">Admin notes</label>
                <textarea id="edit-admin-notes" name="admin_notes" defaultValue={selectedProfile.admin_notes ?? ""} />
              </div>
              <div className="user-dialog-actions">
                <Link className="button secondary" href="/admin/users">
                  Cancel
                </Link>
                <button className="button" type="submit">
                  Save user
                </button>
              </div>
            </form>
            {selectedProfile.owner_profile_id ? (
              <>
                <form className="form conversion-form" action={convertDependentToAccount}>
                  <input type="hidden" name="id" value={selectedProfile.id} />
                  <h3>Create Login Account</h3>
                  <p className="muted">This keeps all existing event, bed, preference, and game information.</p>
                  <div className="grid two">
                    <div className="field">
                      <label htmlFor="convert-email">Email</label>
                      <input id="convert-email" name="email" type="email" required />
                    </div>
                    <div className="field">
                      <label htmlFor="convert-password">Initial password</label>
                      <input id="convert-password" name="password" type="password" minLength={6} required />
                    </div>
                  </div>
                  <button className="button secondary" type="submit">Convert to login account</button>
                </form>
                <form action={deleteDependentAsAdmin}>
                  <input type="hidden" name="id" value={selectedProfile.id} />
                  <button className="button danger" type="submit">Remove dependent</button>
                </form>
              </>
            ) : null}
          </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function PreferenceField({
  id,
  label,
  name,
  values
}: {
  id: string;
  label: string;
  name: string;
  values: string[];
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <textarea id={id} name={name} defaultValue={values.join("\n")} placeholder="One item per line" />
    </div>
  );
}
