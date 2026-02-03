// Mock Auth0 connection data for testing
export const mockConnections = [
  {
    id: 'con_google123',
    name: 'google-oauth2',
    display_name: 'Google',
    strategy: 'google-oauth2',
    options: {
      client_id: 'google-client-id',
      client_secret: '***',
      allowed_audiences: [],
      scope: ['email', 'profile'],
    },
    enabled_clients: ['app1', 'app2'],
    realms: ['google-oauth2'],
    is_domain_connection: false,
    show_as_button: true,
  },
  {
    id: 'con_github456',
    name: 'github',
    display_name: 'GitHub',
    strategy: 'github',
    options: {
      client_id: 'github-client-id',
      client_secret: '***',
      scope: ['user:email', 'read:user'],
    },
    enabled_clients: ['app1'],
    realms: ['github'],
    is_domain_connection: false,
    show_as_button: true,
  },
  {
    id: 'con_facebook789',
    name: 'facebook',
    display_name: 'Facebook',
    strategy: 'facebook',
    options: {
      client_id: 'facebook-app-id',
      client_secret: '***',
      scope: ['email', 'public_profile'],
    },
    enabled_clients: ['app2'],
    realms: ['facebook'],
    is_domain_connection: false,
    show_as_button: true,
  },
  {
    id: 'con_linkedin101',
    name: 'linkedin',
    display_name: 'LinkedIn',
    strategy: 'linkedin',
    options: {
      client_id: 'linkedin-client-id',
      client_secret: '***',
      scope: ['r_emailaddress', 'r_liteprofile'],
    },
    enabled_clients: [],
    realms: ['linkedin'],
    is_domain_connection: false,
    show_as_button: false,
  },
];

// Mock single connection response
export const mockSingleConnection = mockConnections[0];

// Mock list response with pagination
export const mockConnectionListResponse = {
  connections: mockConnections,
  total: mockConnections.length,
  start: 0,
  limit: 10,
};

// Mock create connection response
export const mockCreateConnectionResponse = {
  id: 'con_new123',
  name: 'new-google-connection',
  display_name: 'New Google',
  strategy: 'google-oauth2',
  options: {
    client_id: 'new-google-client-id',
    client_secret: '***',
    scope: ['email', 'profile'],
  },
  enabled_clients: [],
  realms: ['new-google-connection'],
  is_domain_connection: false,
  show_as_button: true,
};

// Mock update connection response
export const mockUpdateConnectionResponse = {
  ...mockConnections[0],
  display_name: 'Updated Google',
  options: {
    ...mockConnections[0].options,
    scope: ['email', 'profile', 'openid'],
  },
};
