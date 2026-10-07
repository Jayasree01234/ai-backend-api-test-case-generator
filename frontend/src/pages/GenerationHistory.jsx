import { useState } from "react";

function GenerationHistory({
  generations,
  projectId,
  projects,
  loading,
}) {
  const [selectedGeneration, setSelectedGeneration] =
    useState(null);

  const selectedProject = projects.find(
    (project) =>
      String(project.id) === String(projectId)
  );

  const handleDownload = (generation) => {
    const blob = new Blob(
      [generation.generated_code || ""],
      {
        type: "text/plain;charset=utf-8",
      }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    link.download =
      generation.generated_filename ||
      "generated_tests.txt";

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1>Generation History</h1>

          <p>
            View previously generated API test files
            for your project.
          </p>
        </div>
      </div>

      <div className="dashboard-card">
        <div className="card-header">
          <div>
            <h2>
              {selectedProject
                ? selectedProject.name
                : "Generation History"}
            </h2>

            <p>
              Previously generated test-code files.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <p>Loading generation history...</p>
          </div>
        ) : generations.length === 0 ? (
          <div className="empty-state">
            <h3>No generations yet</h3>

            <p>
              Generate your first API test file
              from the AI Generator.
            </p>
          </div>
        ) : (
          <div className="generation-list">
            {generations.map((generation) => (
              <div
                className="generation-card"
                key={generation.id}
              >
                <div>
                  <h3>
                    {generation.generated_filename}
                  </h3>

                  <p>
                    OpenAPI:{" "}
                    {generation.openapi_filename ||
                      "OpenAPI specification"}
                  </p>

                  <p>
                    {generation.language} /{" "}
                    {generation.framework}
                  </p>

                  <small>
                    {generation.created_at
                      ? new Date(
                          generation.created_at
                        ).toLocaleString()
                      : ""}
                  </small>
                </div>

                <div className="generation-actions">
                  <button
                    className="secondary-button"
                    onClick={() =>
                      setSelectedGeneration(
                        generation
                      )
                    }
                  >
                    View Code
                  </button>

                  <button
                    className="secondary-button"
                    onClick={() =>
                      handleDownload(generation)
                    }
                  >
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedGeneration && (
        <div className="dashboard-card">
          <div className="card-header">
            <div>
              <h2>
                {selectedGeneration.generated_filename}
              </h2>

              <p>
                {selectedGeneration.language} /{" "}
                {selectedGeneration.framework}
              </p>
            </div>

            <div className="generation-actions">
              <button
                className="secondary-button"
                onClick={() =>
                  handleDownload(selectedGeneration)
                }
              >
                Download
              </button>

              <button
                className="secondary-button"
                onClick={() =>
                  setSelectedGeneration(null)
                }
              >
                Close
              </button>
            </div>
          </div>

          <pre className="code-window">
            <code>
              {selectedGeneration.generated_code}
            </code>
          </pre>
        </div>
      )}
    </div>
  );
}

export default GenerationHistory;