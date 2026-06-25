import { createDependent, deleteDependent, updateDependent, updateOwnProfile } from "@/lib/actions/attendee";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export default async function AccountPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireProfile();
  const params = (await searchParams) ?? {};
  const saved = typeof params.saved === "string" ? params.saved : null;
  const error = typeof params.error === "string" ? params.error : null;
  const supabase = await createClient();
  const [{ data: shirtSizes }, { data: dependentData }] = await Promise.all([
    supabase.from("shirt_sizes").select("id,label").eq("active", true).order("sort_order"),
    supabase.from("profiles").select("*").eq("owner_profile_id", profile.id).order("last_name")
  ]);
  const dependents = (dependentData ?? []) as Profile[];

  return (
    <section className="grid">
      <div className="page-title">
        <h1>My Account</h1>
        <p>Update the contact information used for event planning.</p>
      </div>
      {saved ? <div className="notice">Account updated successfully.</div> : null}
      {error ? <div className="error">{error}</div> : null}
      <form className="panel form" action={updateOwnProfile}>
        <div className="grid two">
          <div className="field">
            <label htmlFor="first_name">First name</label>
            <input id="first_name" name="first_name" defaultValue={profile.first_name} required />
          </div>
          <div className="field">
            <label htmlFor="last_name">Last name</label>
            <input id="last_name" name="last_name" defaultValue={profile.last_name} required />
          </div>
        </div>
        <div className="grid two">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" defaultValue={profile.email ?? ""} required />
          </div>
          <div className="field">
            <label htmlFor="phone">Phone</label>
            <input id="phone" name="phone" type="tel" defaultValue={profile.phone ?? ""} />
          </div>
        </div>
        <h2>Food and Drink Preferences</h2>
        <p className="muted">Enter one item per line. Commas also work.</p>
        <div className="field">
          <label htmlFor="shirt_size_id">T-shirt size</label>
          <select id="shirt_size_id" name="shirt_size_id" defaultValue={profile.shirt_size_id ?? ""}>
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
            <label htmlFor="allergies">Allergies</label>
            <textarea
              id="allergies"
              name="allergies"
              defaultValue={profile.allergies.join("\n")}
              placeholder={"Peanuts\nShellfish"}
            />
          </div>
          <div className="field">
            <label htmlFor="drink_preferences">Drink preferences</label>
            <textarea
              id="drink_preferences"
              name="drink_preferences"
              defaultValue={profile.drink_preferences.join("\n")}
              placeholder={"Coke\nDiet Coke\nCoffee"}
            />
          </div>
          <div className="field">
            <label htmlFor="snack_preferences">Snack preferences</label>
            <textarea
              id="snack_preferences"
              name="snack_preferences"
              defaultValue={profile.snack_preferences.join("\n")}
              placeholder={"Pretzels\nPopcorn\nFruit"}
            />
          </div>
          <div className="field">
            <label htmlFor="food_preferences">Food preferences</label>
            <textarea
              id="food_preferences"
              name="food_preferences"
              defaultValue={profile.food_preferences.join("\n")}
              placeholder={"Vegetarian\nPizza\nTacos"}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="comments">Comments</label>
          <textarea
            id="comments"
            name="comments"
            defaultValue={profile.comments ?? ""}
            placeholder="Anything else the organizer should know"
          />
        </div>
        <button className="button" type="submit">
          Save account
        </button>
      </form>

      {profile.role === "attendee" ? (
        <>
          <div className="page-title compact">
            <h2>Dependents</h2>
            <p>Dependents attend the same events as you but do not have their own login.</p>
          </div>

          <form className="panel form" action={createDependent}>
            <h2>Add Dependent</h2>
            <DependentFields shirtSizes={shirtSizes ?? []} />
            <button className="button" type="submit">
              Add dependent
            </button>
          </form>

          <div className="grid">
            {dependents.length === 0 ? <div className="panel muted">No dependents added.</div> : null}
            {dependents.map((dependent) => (
              <details className="panel" key={dependent.id}>
                <summary>
                  <strong>{dependent.first_name} {dependent.last_name}</strong>
                  <span className="muted"> Dependent</span>
                </summary>
                <form className="form dependent-edit-form" action={updateDependent}>
                  <input type="hidden" name="id" value={dependent.id} />
                  <DependentFields dependent={dependent} shirtSizes={shirtSizes ?? []} />
                  <div className="actions">
                    <button className="button" type="submit">Save dependent</button>
                  </div>
                </form>
                <form action={deleteDependent}>
                  <input type="hidden" name="id" value={dependent.id} />
                  <button className="button danger" type="submit">Remove dependent</button>
                </form>
              </details>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

function DependentFields({
  dependent,
  shirtSizes
}: {
  dependent?: Profile;
  shirtSizes: { id: string; label: string }[];
}) {
  const fieldPrefix = dependent ? `dependent-${dependent.id}` : "new-dependent";

  return (
    <>
      <div className="grid two">
        <div className="field">
          <label htmlFor={`${fieldPrefix}-first-name`}>First name</label>
          <input id={`${fieldPrefix}-first-name`} name="first_name" defaultValue={dependent?.first_name ?? ""} required />
        </div>
        <div className="field">
          <label htmlFor={`${fieldPrefix}-last-name`}>Last name</label>
          <input id={`${fieldPrefix}-last-name`} name="last_name" defaultValue={dependent?.last_name ?? ""} required />
        </div>
      </div>
      <div className="field">
        <label htmlFor={`${fieldPrefix}-shirt-size`}>T-shirt size</label>
        <select id={`${fieldPrefix}-shirt-size`} name="shirt_size_id" defaultValue={dependent?.shirt_size_id ?? ""}>
          <option value="">Choose a size</option>
          {shirtSizes.map((size) => <option key={size.id} value={size.id}>{size.label}</option>)}
        </select>
      </div>
      <p className="muted">Enter one item per line. Commas also work.</p>
      <div className="grid two">
        <PreferenceField id={`${fieldPrefix}-allergies`} name="allergies" label="Allergies" values={dependent?.allergies} />
        <PreferenceField id={`${fieldPrefix}-drinks`} name="drink_preferences" label="Drink preferences" values={dependent?.drink_preferences} />
        <PreferenceField id={`${fieldPrefix}-snacks`} name="snack_preferences" label="Snack preferences" values={dependent?.snack_preferences} />
        <PreferenceField id={`${fieldPrefix}-food`} name="food_preferences" label="Food preferences" values={dependent?.food_preferences} />
      </div>
      <div className="field">
        <label htmlFor={`${fieldPrefix}-comments`}>Comments</label>
        <textarea id={`${fieldPrefix}-comments`} name="comments" defaultValue={dependent?.comments ?? ""} />
      </div>
    </>
  );
}

function PreferenceField({
  id,
  name,
  label,
  values = []
}: {
  id: string;
  name: string;
  label: string;
  values?: string[];
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <textarea id={id} name={name} defaultValue={values.join("\n")} />
    </div>
  );
}
