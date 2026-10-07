
function Projects({
  projects,
  projectId,
  projectName,
  projectDescription,
  projectLoading,
  projectError,
  showCreateProject,
  setProjectName,
  setProjectDescription,
  setShowCreateProject,
  handleCreateProject,
  handleSelectProject,
}) {
  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1>Projects</h1>
          <p>Create and manage your API testing projects.</p>
        </div>

        <button
          className="primary-button"
          onClick={() => setShowCreateProject(!showCreateProject)}
        >
          {showCreateProject ? "Cancel" : "+ New Project"}
        </button>
      </div>

      {showCreateProject && (
        <div className="dashboard-card">
          <div className="card-header">
            <div>
              <h2>Create New Project</h2>
              <p>Create a project to organize your API testing work.</p>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Project Name</label>

              <input
                type="text"
                value={projectName}
                onChange={(event) =>
                  setProjectName(event.target.value)
                }
                placeholder="Enter project name"
              />
            </div>

            <div className="form-group">
              <label>Description</label>

              <input
                type="text"
                value={projectDescription}
                onChange={(event) =>
                  setProjectDescription(event.target.value)
                }
                placeholder="Enter project description"
              />
            </div>
          </div>

          {projectError && (
            <div className="error-message">
              {projectError}
            </div>
          )}

          <button
            className="primary-button"
            onClick={handleCreateProject}
            disabled={projectLoading}
          >
            {projectLoading ? "Creating..." : "Create Project"}
          </button>
        </div>
      )}

      <div className="dashboard-card">
        <div className="card-header">
          <div>
            <h2>Your Projects</h2>
            <p>Select a project to work with.</p>
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="empty-state">
            <h3>No projects yet</h3>
            <p>Create your first project to get started.</p>
          </div>
        ) : (
          <div className="project-list">
            {projects.map((project) => {
              const isSelected =
                String(projectId) === String(project.id);

              return (
                <div
                  key={project.id}
                  className={`project-card ${
                    isSelected ? "selected" : ""
                  }`}
                  onClick={() => handleSelectProject(project)}
                >
                  <div className="project-card-content">
                    <h3>{project.name}</h3>

                    <p>
                      {project.description ||
                        "No description provided."}
                    </p>

                    <small>
                      Created{" "}
                      {project.created_at
                        ? new Date(
                            project.created_at
                          ).toLocaleDateString()
                        : ""}
                    </small>
                  </div>

                  <div className="project-card-action">
                    {isSelected ? (
                      <span className="project-status selected-status">
                        Selected
                      </span>
                    ) : (
                      <span className="project-status">
                        Select
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default Projects;

