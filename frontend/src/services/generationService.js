import { supabase } from "./supabase";

export async function saveGeneration({
  projectId,
  openapiFilename,
  language,
  framework,
  generatedFilename,
  generatedCode,
}) {
  const { data, error } = await supabase
    .from("generations")
    .insert([
      {
        project_id: projectId,
        openapi_filename: openapiFilename,
        language,
        framework,
        generated_filename: generatedFilename,
        generated_code: generatedCode,
      },
    ])
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getProjectGenerations(projectId) {
  const { data, error } = await supabase
    .from("generations")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}