import { useState } from "react";

function GenerationHistory({
  generations = [],
  projectId,
  projects = [],
  loading = false,
}) {
  const [selectedGeneration, setSelectedGeneration] =
    useState(null);

  const selectedProject = projects.find(
    (project) =>
      String(project.id) === String(projectId)
  );

  // Support both snake_case and camelCase field names.
  const getCode = (generation) =>
    generation?.generated_code ??
    generation?.generatedCode ??
    generation?.code ??
    "";

  const getFilename = (generation) =>
    generation?.generated_filename ||
    generation?.generatedFilename ||
    "generated_tests.txt";

  const handleDownload = (generation) => {
    if (!generation) return;

    const code = getCode(generation);

    if (!code) {
      alert("No saved code was found for this generation.");
      return;
    }

    const blob = new Blob([code], {
      type: "text/plain;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = getFilename(generation);

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="page-content">
      {/* PAGE HEADER */}
      <div className="page-header">
        <div>
          <h1>Generation History</h1>

          <p>
            View previously generated API test files
            for your project.
          </p>
        </div>
      </div>

      {/* HISTORY LIST */}
      <div className="dashboard-card">
        <div className="card-header">
          <div>
            <h2>
              {selectedProject
                ? selectedProject.name
                : "Generation History"}
            </h2>

            <p>Previously generated test-code files.</p>
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
              from the Test Generator.
            </p>
          </div>
        ) : (
          <div className="generation-list">
            {generations.map((generation, index) => (
              <div
                className="generation-card"
                key={
                  generation.id ||
                  `${getFilename(generation)}-${index}`
                }
              >
                <div>
                  <h3>{getFilename(generation)}</h3>

                  <p>
                    OpenAPI:{" "}
                    {generation.openapi_filename ||
                      generation.openapiFilename ||
                      "OpenAPI specification"}
                  </p>

                  <p>
                    {generation.language || "Unknown language"}
                    {" / "}
                    {generation.framework || "Unknown framework"}
                  </p>

                  <small>
                    {generation.created_at ||
                    generation.createdAt
                      ? new Date(
                          generation.created_at ||
                            generation.createdAt
                        ).toLocaleString()
                      : ""}
                  </small>
                </div>

                <div className="generation-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      setSelectedGeneration(generation)
                    }
                  >
                    View Code
                  </button>

                  <button
                    type="button"
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

      {/* CODE PREVIEW POPUP */}
      {selectedGeneration && (
        <div
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedGeneration(null);
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Generated test code"
            style={{
              background: "#ffffff",
              color: "#111827",
              width: "100%",
              maxWidth: "1000px",
              maxHeight: "90vh",
              borderRadius: "12px",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "16px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <h2
                  style={{
                    margin: "0 0 8px",
                    overflowWrap: "anywhere",
                  }}
                >
                  {getFilename(selectedGeneration)}
                </h2>

                <p style={{ margin: 0, color: "#4b5563" }}>
                  {selectedGeneration.language || "Unknown language"}
                  {" / "}
                  {selectedGeneration.framework || "Unknown framework"}
                </p>
              </div>

              <div
                className="generation-actions"
                style={{
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    handleDownload(selectedGeneration)
                  }
                >
                  Download
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    setSelectedGeneration(null)
                  }
                >
                  Close
                </button>
              </div>
            </div>

            {getCode(selectedGeneration) ? (
              <pre
                style={{
                  margin: 0,
                  padding: "20px",
                  borderRadius: "8px",
                  background: "#111827",
                  color: "#f9fafb",
                  overflow: "auto",
                  maxHeight: "65vh",
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                  fontSize: "13px",
                  lineHeight: 1.65,
                  textAlign: "left",
                }}
              >
                <code>{getCode(selectedGeneration)}</code>
              </pre>
            ) : (
              <div
                style={{
                  padding: "24px",
                  borderRadius: "8px",
                  background: "#f3f4f6",
                }}
              >
                <h3>Code is unavailable</h3>

                <p>
                  This history entry contains no saved test code.
                  Generate a new test file and save it to history.
                </p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default GenerationHistory;