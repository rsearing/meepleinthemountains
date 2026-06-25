import { login } from "@/lib/actions/auth";

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const error = typeof params.error === "string" ? params.error : null;

  return (
    <section className="grid two">
      <div className="page-title">
        <h1>Log in</h1>
        <p>Use the email and password provided by the retreat organizer.</p>
      </div>
      <form className="panel form" action={login}>
        {error ? <div className="error">{error}</div> : null}
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <button className="button" type="submit">
          Log in
        </button>
      </form>
    </section>
  );
}
