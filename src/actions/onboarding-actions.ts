"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export type OnboardingInput = {
  fullName: string;
  email: string;
  country: string;
  phoneNumber: string;
};

export type OnboardingResult = { success: true } | { success: false; error: string };

export async function submitOnboardingApplication(
  input: OnboardingInput,
): Promise<OnboardingResult> {
  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  const country = input.country.trim();
  const phoneNumber = input.phoneNumber.trim();

  if (!fullName || !email || !country || !phoneNumber) {
    return { success: false, error: "Every field is required." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("onboarding_applications").insert({
    full_name: fullName,
    email,
    country,
    phone_number: phoneNumber,
    status: "pending",
  });

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "An application with this email already exists." };
    }
    return { success: false, error: error.message };
  }

  return { success: true };
}
