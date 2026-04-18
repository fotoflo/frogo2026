import { headers } from "next/headers";

export async function isMobileRequest(): Promise<boolean> {
  const headersList = await headers();
  const ua = headersList.get("user-agent") ?? "";

  // Tablets (iPad, Android tablets) get the TV interface, not the phone UI.
  // Modern iPadOS reports as MacIntel by default, so the iPad token only
  // appears on older/legacy iPads — still route them to TV.
  const isTablet =
    /iPad/i.test(ua) ||
    // Android convention: phones include "Mobile", tablets don't.
    (/Android/i.test(ua) && !/Mobile/i.test(ua));
  if (isTablet) return false;

  return /Android|iPhone|iPod|webOS|BlackBerry|Opera Mini|IEMobile/i.test(ua);
}
