import "server-only";
export async function avatarData(url: string): Promise<string | undefined> {
  try {
    const u = new URL(url);
    if (
      u.protocol !== "https:" ||
      u.hostname !== "avatars.githubusercontent.com" ||
      u.port ||
      u.username ||
      u.password
    )
      return;
    u.searchParams.set("s", "96");
    const r = await fetch(u, {
      redirect: "error",
      signal: AbortSignal.timeout(4000),
      next: { revalidate: 86400 },
    });
    const type = r.headers.get("content-type")?.split(";")[0];
    if (!r.ok || !["image/png", "image/jpeg"].includes(type || "")) return;
    const reader = r.body?.getReader();
    if (!reader) return;
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 150000) {
        await reader.cancel();
        return;
      }
      chunks.push(value);
    }
    const b = Buffer.concat(chunks);
    const png = b
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpg = b[0] === 255 && b[1] === 216 && b[2] === 255;
    if ((type === "image/png" && !png) || (type === "image/jpeg" && !jpg))
      return;
    return `data:${type};base64,${b.toString("base64")}`;
  } catch {
    return;
  }
}
