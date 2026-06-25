import { createDependentAsAdmin, createProfile } from "@/lib/actions/admin";
import { AdminUserList } from "@/components/admin-user-list";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export default async function AdminUsersPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const params = (await searchParams) ?? {};
  const error = typeof params.error === "string" ? params.error : null;
  const saved = typeof params.saved === "string" ? params.saved : null;
  const editId = typeof params.edit === "string" ? params.edit : null;
  const supabase = await createClient();
  const [{ data }, { data: shirtSizes }] = await Promise.all([
    supabase.from("profiles").select("*").order("last_name"),
    supabase.from("shirt_sizes").select("id,label").eq("active", true).order("sort_order")
  ]);
  const profiles = (data ?? []) as Profile[];
  const primaryAttendees = profiles.filter(
    (profile) => profile.role === "attendee" && !profile.owner_profile_id && Boolean(profile.auth_user_id)
  );
  const selectedProfile = editId ? profiles.find((profile) => profile.id === editId) ?? null : null;

  return (
    <section className="grid">
      <div className="page-title">
        <h1>Users</h1>
        <p>Create accounts and manage profile details.</p>
      </div>
      {saved ? <div className="notice">Saved successfully.</div> : null}
      {error ? <div className="error">{error}</div> : null}

      <form className="panel form" action={createProfile}>
        <h2>Create User</h2>
        <div className="grid two">
          <div className="field">
            <label htmlFor="first_name">First name</label>
            <input id="first_name" name="first_name" required />
          </div>
          <div className="field">
            <label htmlFor="last_name">Last name</label>
            <input id="last_name" name="last_name" required />
          </div>
        </div>
        <div className="field">
          <label htmlFor="shirt_size_id">T-shirt size</label>
          <select id="shirt_size_id" name="shirt_size_id" defaultValue="">
            <option value="">Choose a size</option>
            {(shirtSizes ?? []).map((size) => (
              <option key={size.id} value={size.id}>
                {size.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid two">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required />
          </div>
          <div className="field">
            <label htmlFor="password">Initial password</label>
            <input id="password" name="password" type="password" minLength={6} required />
          </div>
        </div>
        <div className="grid two">
          <div className="field">
            <label htmlFor="role">Role</label>
            <select id="role" name="role" defaultValue="attendee">
              <option value="attendee">Attendee</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="phone">Phone</label>
            <input id="phone" name="phone" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="admin_notes">Admin notes</label>
          <textarea id="admin_notes" name="admin_notes" />
        </div>
        <div className="grid two">
          <div className="field">
            <label htmlFor="allergies">Allergies</label>
            <textarea id="allergies" name="allergies" placeholder="One item per line" />
          </div>
          <div className="field">
            <label htmlFor="drink_preferences">Drink preferences</label>
            <textarea id="drink_preferences" name="drink_preferences" placeholder="One item per line" />
          </div>
          <div className="field">
            <label htmlFor="snack_preferences">Snack preferences</label>
            <textarea id="snack_preferences" name="snack_preferences" placeholder="One item per line" />
          </div>
          <div className="field">
            <label htmlFor="food_preferences">Food preferences</label>
            <textarea id="food_preferences" name="food_preferences" placeholder="One item per line" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="comments">User comments</label>
          <textarea id="comments" name="comments" />
        </div>
        <button className="button" type="submit">
          Create user
        </button>
      </form>

      <form className="panel form" action={createDependentAsAdmin}>
        <h2>Create Dependent</h2>
        <p className="muted">The dependent will automatically attend every event assigned to the primary attendee.</p>
        <div className="field">
          <label htmlFor="owner_profile_id">Primary attendee</label>
          <select id="owner_profile_id" name="owner_profile_id" required defaultValue="">
            <option value="">Choose an attendee</option>
            {primaryAttendees.map((attendee) => (
              <option key={attendee.id} value={attendee.id}>
                {attendee.first_name} {attendee.last_name} - {attendee.email}
              </option>
            ))}
          </select>
        </div>
        <div className="grid two">
          <div className="field">
            <label htmlFor="dependent_first_name">First name</label>
            <input id="dependent_first_name" name="first_name" required />
          </div>
          <div className="field">
            <label htmlFor="dependent_last_name">Last name</label>
            <input id="dependent_last_name" name="last_name" required />
          </div>
        </div>
        <div className="field">
          <label htmlFor="dependent_shirt_size_id">T-shirt size</label>
          <select id="dependent_shirt_size_id" name="shirt_size_id" defaultValue="">
            <option value="">Choose a size</option>
            {(shirtSizes ?? []).map((size) => (
              <option key={size.id} value={size.id}>{size.label}</option>
            ))}
          </select>
        </div>
        <div className="grid two">
          <div className="field">
            <label htmlFor="dependent_allergies">Allergies</label>
            <textarea id="dependent_allergies" name="allergies" placeholder="One item per line" />
          </div>
          <div className="field">
            <label htmlFor="dependent_drinks">Drink preferences</label>
            <textarea id="dependent_drinks" name="drink_preferences" placeholder="One item per line" />
          </div>
          <div className="field">
            <label htmlFor="dependent_snacks">Snack preferences</label>
            <textarea id="dependent_snacks" name="snack_preferences" placeholder="One item per line" />
          </div>
          <div className="field">
            <label htmlFor="dependent_food">Food preferences</label>
            <textarea id="dependent_food" name="food_preferences" placeholder="One item per line" />
          </div>
        </div>
        <div className="grid two">
          <div className="field">
            <label htmlFor="dependent_comments">Comments</label>
            <textarea id="dependent_comments" name="comments" />
          </div>
          <div className="field">
            <label htmlFor="dependent_admin_notes">Admin notes</label>
            <textarea id="dependent_admin_notes" name="admin_notes" />
          </div>
        </div>
        <button className="button" type="submit">Create dependent</button>
      </form>

      <AdminUserList profiles={profiles} shirtSizes={shirtSizes ?? []} selectedProfile={selectedProfile} />
    </section>
  );
}
