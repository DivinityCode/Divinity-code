export const CONNECTOR_ADAPTERS = [
  {
    adapter: 'ticket_reference',
    description: 'Attach issue, ticket, or project-tracker references to a run.',
    resource_types: ['ticket', 'issue'],
    auth_modes: ['connector', 'token'],
    write_capable: false
  },
  {
    adapter: 'docs_reference',
    description: 'Attach document, knowledge-base, or specification references to a run.',
    resource_types: ['document', 'knowledge_base'],
    auth_modes: ['connector', 'token'],
    write_capable: false
  },
  {
    adapter: 'ci_status',
    description: 'Attach CI workflow, check, or deployment status references to a run.',
    resource_types: ['ci_run', 'check_run', 'deployment'],
    auth_modes: ['connector', 'token'],
    write_capable: false
  }
];

export function publicConnectorAdapters() {
  return CONNECTOR_ADAPTERS.map(adapter => ({
    ...adapter,
    resource_types: [...adapter.resource_types],
    auth_modes: [...adapter.auth_modes]
  }));
}
