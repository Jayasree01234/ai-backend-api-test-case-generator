import { getProjects } from "./projectService";

const GENERATIONS_KEY = "api_test_ai_generations";

function readGenerations() {
  try {
    const value = JSON.parse(localStorage.getItem(GENERATIONS_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function createId() {
  return globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function saveGeneration({
  projectId,
  openapiFilename,
  language,
  framework,
  generatedFilename,
  generatedCode,
}) {
  const projects = await getProjects();

  if (!projects.some((project) => project.id === projectId)) {
    throw new Error("Please select a valid project.");
  }

  const generation = {
    id: createId(),
    project_id: projectId,
    openapi_filename: openapiFilename || "OpenAPI specification",
    language,
    framework,
    generated_filename: generatedFilename,
    generated_code: generatedCode,
    created_at: new Date().toISOString(),
  };

  localStorage.setItem(
    GENERATIONS_KEY,
    JSON.stringify([generation, ...readGenerations()])
  );

  return generation;
}

export async function getProjectGenerations(projectId) {
  const projects = await getProjects();

  if (!projects.some((project) => project.id === projectId)) {
    return [];
  }

  return readGenerations()
    .filter((generation) => generation.project_id === projectId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}