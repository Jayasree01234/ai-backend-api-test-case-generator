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



/* =====================================================
   API ENDPOINT FUNCTIONS
===================================================== */

function normalizeMethod(method) {
  return String(method || "").trim().toUpperCase();
}

function normalizeEndpoint(endpoint) {
  const normalized = String(endpoint || "")
    .trim()
    .replace(/\/+/g, "/");

  if (!normalized) {
    return "";
  }

  return normalized.startsWith("/")
    ? normalized
    : `/${normalized}`;
}

function endpointKey(method, endpoint) {
  return `${normalizeMethod(method)} ${normalizeEndpoint(endpoint)}`;
}

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
  const projectId = apiData.project_id;
  const method = normalizeMethod(apiData.method);
  const endpoint = normalizeEndpoint(apiData.endpoint);

  if (!projectId || !method || !endpoint) {
    throw new Error(
      "Project, HTTP method, and endpoint are required."
    );
  }

  // Check whether this endpoint already exists in the project.
  const { data: existing, error: lookupError } = await supabase
    .from("apis")
    .select("*")
    .eq("project_id", projectId)
    .eq("method", method)
    .eq("endpoint", endpoint)
    .limit(1);

  if (lookupError) {
    throw lookupError;
  }

  if (existing && existing.length > 0) {
    throw new Error(
      `${method} ${endpoint} already exists in this project.`
    );
  }

  const { data, error } = await supabase
    .from("apis")
    .insert([
      {
        project_id: projectId,
        method,
        endpoint,
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

  // Remove duplicates within this import batch.
  const uniqueApis = [];
  const seen = new Set();

  for (const api of apis) {
    const projectId = api.project_id;
    const method = normalizeMethod(api.method);
    const endpoint = normalizeEndpoint(api.endpoint);

    if (!projectId || !method || !endpoint) {
      continue;
    }

    const key =
      `${projectId}::${endpointKey(method, endpoint)}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    uniqueApis.push({
      ...api,
      method,
      endpoint,
    });
  }

  if (uniqueApis.length === 0) {
    return [];
  }

  // Check existing endpoints for each project.
  const projects = [
    ...new Set(uniqueApis.map((api) => api.project_id)),
  ];

  const existingKeys = new Set();

  for (const projectId of projects) {
    const { data: existing, error } = await supabase
      .from("apis")
      .select("project_id, method, endpoint")
      .eq("project_id", projectId);

    if (error) {
      throw error;
    }

    for (const api of existing || []) {
      existingKeys.add(
        `${projectId}::${endpointKey(api.method, api.endpoint)}`
      );
    }
  }

  const apisToInsert = uniqueApis.filter((api) => {
    const key =
      `${api.project_id}::${endpointKey(api.method, api.endpoint)}`;

    return !existingKeys.has(key);
  });

  if (apisToInsert.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("apis")
    .insert(apisToInsert)
    .select();

  if (error) {
    throw error;
  }

  return data || [];
}
