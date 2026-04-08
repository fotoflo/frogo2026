import { headers } from "next/headers";

export async function isMobileRequest(): Promise<boolean> {
  const headersList = await headers();
  const ua = headersList.get("user-agent") ?? "";
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|Opera Mini|IEMobile/i.test(ua);
}
