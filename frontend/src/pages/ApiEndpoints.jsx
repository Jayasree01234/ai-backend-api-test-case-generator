
function ApiEndpoints({
  projects,
  projectId,
  projectApis,
  apiMethod,
  apiEndpoint,
  apiRequestBody,
  apiError,
  apiLoading,
  selectedFile,
  importedApis,
  uploadError,
  uploading,
  setApiMethod,
  setApiEndpoint,
  setApiRequestBody,
  handleCreateApi,
  handleFileChange,
  handleImportOpenApi,
  handleSelectProject,
}) {
  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1>API Endpoints</h1>
          <p>
            Add, manage, and import API endpoints for your project.
          </p>
        </div>
      </div>

      {/* PROJECT SELECTION */}
      <div className="dashboard-card">
        <div className="card-header">
          <div>
            <h2>Project</h2>
            <p>
              Select the project whose APIs you want to manage.
            </p>
          </div>
        </div>

        <div className="form-group">
          <label>Select Project</label>

          <select
            value={projectId || ""}
            onChange={(event) => {
              const project = projects.find(
                (item) =>
                  String(item.id) === event.target.value
              );

              if (project) {
                handleSelectProject(project);
              }
            }}
          >
            <option value="">Select a project</option>

            {projects.map((project) => (
              <option
                key={project.id}
                value={project.id}
              >
                {project.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!projectId ? (
        <div className="dashboard-card">
          <div className="empty-state">
            <h3>Select a project</h3>
            <p>
              Select a project above to manage its API endpoints.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* MANUAL API */}
          <div className="dashboard-card">
            <div className="card-header">
              <div>
                <h2>Add API Endpoint</h2>
                <p>
                  Add an API endpoint manually.
                </p>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label>HTTP Method</label>

                <select
                  value={apiMethod}
                  onChange={(event) =>
                    setApiMethod(event.target.value)
                  }
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="PATCH">PATCH</option>
                  <option value="DELETE">DELETE</option>
                </select>
              </div>

              <div className="form-group">
                <label>Endpoint</label>

                <input
                  type="text"
                  value={apiEndpoint}
                  onChange={(event) =>
                    setApiEndpoint(event.target.value)
                  }
                  placeholder="/users"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Request Body</label>

              <textarea
                value={apiRequestBody}
                onChange={(event) =>
                  setApiRequestBody(event.target.value)
                }
                placeholder='{"name":"John"}'
                rows="5"
              />
            </div>

            {apiError && (
              <div className="error-message">
                {apiError}
              </div>
            )}

            <button
              className="primary-button"
              onClick={handleCreateApi}
              disabled={apiLoading}
            >
              {apiLoading ? "Adding..." : "Add Endpoint"}
            </button>
          </div>

          {/* OPENAPI IMPORT */}
          <div className="dashboard-card">
            <div className="card-header">
              <div>
                <h2>Import OpenAPI Specification</h2>
                <p>
                  Upload an OpenAPI JSON or YAML file to detect
                  API endpoints automatically.
                </p>
              </div>
            </div>

            <div className="upload-area">
              <input
                type="file"
                accept=".json,.yaml,.yml"
                onChange={handleFileChange}
              />

              {selectedFile && (
                <div className="selected-file">
                  <strong>Selected file</strong>
                  <span>{selectedFile.name}</span>
                </div>
              )}

              {uploadError && (
                <div className="error-message">
                  {uploadError}
                </div>
              )}

              <button
                className="primary-button"
                onClick={handleImportOpenApi}
                disabled={!selectedFile || uploading}
              >
                {uploading
                  ? "Importing..."
                  : "Import OpenAPI"}
              </button>
            </div>

            {importedApis.length > 0 && (
              <div className="imported-api-list">
                <h3>Detected Endpoints</h3>

                {importedApis.map((api, index) => (
                  <div
                    className="api-item"
                    key={`${api.method}-${api.endpoint}-${index}`}
                  >
                    <span className="api-method">
                      {api.method}
                    </span>

                    <span>{api.endpoint}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* EXISTING APIS */}
          <div className="dashboard-card">
            <div className="card-header">
              <div>
                <h2>Project API Endpoints</h2>
                <p>
                  API endpoints currently available in this project.
                </p>
              </div>

              <span className="endpoint-count">
                {projectApis.length} endpoint
                {projectApis.length !== 1 ? "s" : ""}
              </span>
            </div>

            {projectApis.length === 0 ? (
              <div className="empty-state">
                <h3>No API endpoints</h3>
                <p>
                  Add an endpoint manually or import an OpenAPI
                  specification.
                </p>
              </div>
            ) : (
              <div className="api-list">
                {projectApis.map((api) => (
                  <div
                    className="api-item"
                    key={api.id}
                  >
                    <span className="api-method">
                      {api.method}
                    </span>

                    <span className="api-endpoint">
                      {api.endpoint}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default ApiEndpoints;
