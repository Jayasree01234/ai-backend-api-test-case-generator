export async function generateTestsWithAI(
  openapiSpec,
  language,
  framework
) {
  const response = await fetch(
    "http://localhost:3001/generate-tests",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        openapiSpec,
        language,
        framework,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error || "Failed to generate test code."
    );
  }

  return data;
}