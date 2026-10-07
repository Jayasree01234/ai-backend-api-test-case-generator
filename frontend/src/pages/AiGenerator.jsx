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
}) {
  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1>AI Test Generator</h1>
          <p>
            Generate executable API test code from your OpenAPI
            specification.
          </p>
        </div>
      </div>

      {/* Generation Settings */}
      <div className="dashboard-card">
        <div className="card-header">
          <div>
            <h2>Generation Settings</h2>
            <p>
              Choose the target language and testing framework.
            </p>
          </div>
        </div>

        {!projectId ? (
          <div className="empty-state">
            <h3>Select a project first</h3>
            <p>
              Select a project before generating API tests.
            </p>
          </div>
        ) : (
          <>
            <div className="form-grid">
              {/* Target Language */}
              <div className="form-group">
                <label>Target Language</label>

                <select
                  value={targetLanguage}
                  onChange={(event) =>
                    handleLanguageChange(event.target.value)
                  }
                >
                  <option value="Python">Python</option>
                  <option value="Node.js">Node.js</option>
                  <option value="Spring Boot">Spring Boot</option>
                </select>
              </div>

              {/* Framework */}
              <div className="form-group">
                <label>Testing Framework</label>

                <select
                  value={targetFramework}
                  onChange={(event) =>
                    setTargetFramework(event.target.value)
                  }
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

            {/* Generation Summary */}
            <div className="generator-summary">
              <div>
                <span>Project</span>

                <strong>
                  {projects.find(
                    (project) =>
                      String(project.id) === String(projectId)
                  )?.name || "Selected project"}
                </strong>
              </div>

              <div>
                <span>OpenAPI File</span>

                <strong>
                  {selectedFile
                    ? selectedFile.name
                    : "OpenAPI specification"}
                </strong>
              </div>

              <div>
                <span>Output</span>

                <strong>
                  {targetLanguage} / {targetFramework}
                </strong>
              </div>
            </div>

            {generateError && (
              <div className="error-message">
                {generateError}
              </div>
            )}

            <button
              className="primary-button generate-button"
              onClick={generateTestCode}
              disabled={generating}
            >
              {generating
                ? "Generating Test Code..."
                : "✧ Generate Test Code"}
            </button>
          </>
        )}
      </div>

      {/* Generated Code */}
      {generatedCode && (
        <div className="dashboard-card">
          <div className="card-header">
            <div>
              <h2>Generated Test Code</h2>
              <p>
                Your generated test file is ready to use.
              </p>
            </div>

            <button
              className="secondary-button"
              onClick={handleDownload}
            >
              Download File
            </button>
          </div>

          <div className="generated-file-name">
            {generatedFilename}
          </div>

          <pre className="code-window">
            <code>{generatedCode}</code>
          </pre>
        </div>
      )}
    </div>
  );
}

export default AiGenerator;