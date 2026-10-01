import { supabase } from "./supabase";

export async function getProjects() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error("User is not authenticated.");
  }

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

export async function createProject(name, description) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error("User is not authenticated.");
  }

  const { data, error } = await supabase
    .from("projects")
    .insert([
      {
        name,
        description,
        owner_id: user.id,
      },
    ])
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}


// =====================================================
// API ENDPOINT FUNCTIONS
// =====================================================

export async function getProjectApis(projectId) {
  const { data, error } = await supabase
    .from("apis")
    .select("*")
    .eq("project_id", projectId)
    .order("id", { ascending: true });

  if (error) {
    throw error;
  }

  return data || [];
}

export async function createProjectApi(apiData) {
  const { data, error } = await supabase
    .from("apis")
    .insert([
      {
        project_id: apiData.project_id,
        method: apiData.method,
        endpoint: apiData.endpoint,
        request_body: apiData.request_body || "",
      },
    ])
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function createProjectApis(apis) {
  if (!Array.isArray(apis) || apis.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("apis")
    .insert(apis)
    .select();

  if (error) {
    throw error;
  }

  return data || [];
}