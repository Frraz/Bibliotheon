export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.DATABASE_PATH !== ":memory:") {
    const { db } = await import("./db");
    const { migrar } = await import("./db/migrar");
    migrar(db as never);
  }
}
