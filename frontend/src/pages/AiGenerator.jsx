
function AiGenerator({
  projects,
  projectId,
  targetLanguage,
  targetFramework,
  generatedCode,
  generatedFilename,
  generating,
  generateError,
  selectedFile,
  setTargetFramework,
  handleLanguageChange,
  generateTestCode,
  handleDownload,
  aiProgress = "",
  aiAnalysis = null,
  aiAnalysisIdeas = [],
}) {
  const selectedProject = projects.find(
    (project) => String(project.id) === String(projectId)
  );

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1>AI Test Generator</h1>
          <p>
            Analyze an OpenAPI specification and generate an executable test file.
          </p>
        </div>
      </div>

      <div className="dashboard-card">
        <div className="card-header">
          <div>
            <h2>Generation Settings</h2>
            <p>Choose your target language and testing framework.</p>
          </div>
        </div>

        {!projectId ? (
          <div className="empty-state">
            <h3>Select a project first</h3>
            <p>Select a project before generating API tests.</p>
          </div>
        ) : (
          <>
            <div className="form-grid">
              <div className="form-group">
                <label>Target Language</label>
                <select
                  value={targetLanguage}
                  onChange={(event) => handleLanguageChange(event.target.value)}
                  disabled={generating}
                >
                  <option value="Python">Python</option>
                  <option value="Node.js">Node.js</option>
                  <option value="Spring Boot">Spring Boot</option>
                </select>
              </div>

              <div className="form-group">
                <label>Testing Framework</label>
                <select
                  value={targetFramework}
                  onChange={(event) => setTargetFramework(event.target.value)}
                  disabled={generating}
                >
                  {targetLanguage === "Python" && (
                    <>
                      <option value="Pytest">Pytest</option>
                      <option value="Unittest">Unittest</option>
                    </>
                  )}

                  {targetLanguage === "Node.js" && (
                    <>
                      <option value="Jest">Jest</option>
                      <option value="Mocha">Mocha</option>
                    </>
                  )}

                  {targetLanguage === "Spring Boot" && (
                    <>
                      <option value="JUnit">JUnit</option>
                      <option value="TestNG">TestNG</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            <div className="generator-summary">
              <div>
                <span>Project</span>
                <strong>{selectedProject?.name || "Selected project"}</strong>
              </div>

              <div>
                <span>OpenAPI File</span>
                <strong>{selectedFile?.name || "OpenAPI specification"}</strong>
              </div>

              <div>
                <span>Output</span>
                <strong>{targetLanguage} / {targetFramework}</strong>
              </div>
            </div>

            {generateError && (
              <div className="error-message" role="alert">
                {generateError}
              </div>
            )}

            {generating && (
              <div className="dashboard-card" aria-live="polite">
                <h3>AI is working</h3>
                <p>
                  {aiProgress ||
                    "Preparing the OpenAPI specification for analysis..."}
                </p>
                <p>
                  The first run may take longer while the browser downloads the
                  AI model. WebGPU support is required.
                </p>
              </div>
            )}

            <button
              type="button"
              className="primary-button generate-button"
              onClick={generateTestCode}
              disabled={generating}
            >
              {generating ? "Generating Test Code..." : "✧ Generate Test Code"}
            </button>
          </>
        )}
      </div>

      {aiAnalysis && (
        <div className="dashboard-card">
          <div className="card-header">
            <div>
              <h2>AI Analysis</h2>
              <p>Overview returned by the browser AI model.</p>
            </div>
          </div>

          <p>{aiAnalysis}</p>

          {aiAnalysisIdeas.length > 0 && (
            <>
              <h3>Additional Test Ideas</h3>
              <ul>
                {aiAnalysisIdeas.map((idea, index) => (
                  <li key={`${index}-${idea}`}>{idea}</li>
                ))}
              </ul>
              <p>
                These are suggestions only. They are not necessarily included
                in the generated executable test file.
              </p>
            </>
          )}
        </div>
      )}

      {generatedCode && (
        <div className="dashboard-card">
          <div className="card-header">
            <div>
              <h2>Generated Test Code</h2>
              <p>Your generated test file is ready to review and download.</p>
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={handleDownload}
            >
              Download File
            </button>
          </div>

          <div className="generated-file-name">{generatedFilename}</div>

          <pre className="code-window">
            <code>{generatedCode}</code>
          </pre>
        </div>
      )}
    </div>
  );
}

export default AiGenerator;
