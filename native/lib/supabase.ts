import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra ?? {};

export const supabase = createClient(
  extra.supabaseUrl ?? "https://cnnttsihfbyxhzlmzdtv.supabase.co",
  extra.supabaseAnonKey ?? "sb_publishable_ufdxXaTlLUEzFP7Ze2tULg_7qW1pFS3"
);

export const API_BASE = extra.apiBaseUrl ?? "https://tv.aimhuge.com";
