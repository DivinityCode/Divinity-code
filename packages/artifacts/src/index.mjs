const ARTIFACT_TYPES = ['patch', 'log', 'summary'];

function artifactContent({ run_id, task, status, type }) {
  if (type === 'summary') {
    return {
      summary: `Run ${run_id} for task ${task.task_id || 'unknown'} is ${status}: ${task.objective || 'No objective provided'}`
    };
  }

  if (type === 'log') {
    return {
      lines: [
        `task_id=${task.task_id || 'unknown'}`,
        `status=${status}`,
        `objective=${task.objective || 'No objective provided'}`
      ]
    };
  }

  return {
    patch: '',
    note: 'No code patch has been generated for this scaffolded run.'
  };
}

export function createRunArtifacts({ run_id, task, status }) {
  return ARTIFACT_TYPES.map(type => ({
    artifact_id: `artifact_${run_id}_${type}`,
    run_id,
    type,
    uri: `artifact://${run_id}/${type}`,
    content: artifactContent({ run_id, task, status, type })
  }));
}

export function publicArtifactMetadata(artifact) {
  return {
    artifact_id: artifact.artifact_id,
    run_id: artifact.run_id,
    type: artifact.type,
    uri: artifact.uri
  };
}
