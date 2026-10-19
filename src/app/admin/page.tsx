import type { Metadata } from "next";
import { AdminPanel } from "@/components/AdminPanel";
import { LoginForm } from "@/components/LoginForm";
import { adminConfigured, isAdmin } from "@/lib/auth";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function AdminPage() {
  if (!adminConfigured()) {
    return (
      <main>
        <h1>Admin</h1>
        <p className="err">
          The admin is not set up. Set <code>ADMIN_PASSWORD</code> and <code>SESSION_SECRET</code>{" "}
          (16 or more characters) in the environment, then restart. See the README.
        </p>
      </main>
    );
  }
  if (!(await isAdmin())) {
    return (
      <main>
        <h1>Admin</h1>
        <LoginForm />
      </main>
    );
  }
  const catalog = await getStore().readCatalog();
  const store = getStore().mode;
  return (
    <main>
      <h1>Admin</h1>
      {store === "none" ? (
        <p className="err">
          Storage is not connected, so nothing can be saved. In Vercel open this project&apos;s{" "}
          <b>Storage</b> tab, create or connect a <b>Blob</b> store, then redeploy.
        </p>
      ) : (
        <AdminPanel clips={catalog.clips} storage={store} />
      )}
    </main>
  );
}
