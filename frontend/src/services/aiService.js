import { supabase } from "./supabase";

export async function generateTestsWithAI(
  openapiSpec,
  language,
  framework
) {
  const { data, error } =
    await supabase.functions.invoke(
      "generate-tests",
      {
        body: {
          openapiSpec,
          language,
          framework,
        },
      }
    );

  if (error) {
    throw error;
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}