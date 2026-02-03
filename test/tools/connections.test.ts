import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { CONNECTION_HANDLERS } from '../../src/tools/connections';
import { mockConfig } from '../mocks/config';
import { mockConnections } from '../mocks/auth0/connections';
import { server } from '../setup';

// Mock dependencies
vi.mock('../../src/utils/logger', () => ({
  log: vi.fn(),
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

describe('Connections Tool Handlers', () => {
  const domain = mockConfig.domain;
  const token = mockConfig.token;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  describe('auth0_list_connections', () => {
    it('should return a list of connections', async () => {
      const request = {
        token,
        parameters: {},
      };

      const config = { domain };

      const response = await CONNECTION_HANDLERS.auth0_list_connections(request, config);

      expect(response).toBeDefined();
      expect(response.isError).toBe(false);
      expect(response.content).toBeDefined();
      expect(response.content.length).toBeGreaterThan(0);
      expect(response.content[0].type).toBe('text');

      // The response should contain valid connection data
      const firstItem = JSON.parse(response.content[0].text);
      expect(firstItem).toHaveProperty('id');
      expect(firstItem).toHaveProperty('strategy');
    });

    it('should handle pagination parameters', async () => {
      const request = {
        token,
        parameters: {
          page: 0,
          per_page: 5,
          include_totals: true,
        },
      };

      const config = { domain };

      const response = await CONNECTION_HANDLERS.auth0_list_connections(request, config);

      expect(response.isError).toBe(false);
      expect(response.content.length).toBeGreaterThan(0);

      // The response should contain valid connection data
      const firstItem = JSON.parse(response.content[0].text);
      expect(firstItem).toHaveProperty('id');
    });

    it('should filter by strategy', async () => {
      const request = {
        token,
        parameters: {
          strategy: ['google-oauth2'],
        },
      };

      const config = { domain };

      const response = await CONNECTION_HANDLERS.auth0_list_connections(request, config);

      expect(response.isError).toBe(false);

      const parsedContent = JSON.parse(response.content[0].text);
      expect(Array.isArray(parsedContent)).toBe(true);
    });

    it('should handle API errors (401 Unauthorized)', async () => {
      // Override the handler for this specific test
      server.use(
        http.get('https://*/api/v2/connections', () => {
          return new HttpResponse(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        })
      );

      const request = {
        token: 'invalid-token',
        parameters: {},
      };

      const config = { domain };

      const response = await CONNECTION_HANDLERS.auth0_list_connections(request, config);

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('Failed to list connections');
      expect(response.content[0].text).toContain('Unauthorized');
    });

    it('should handle missing token', async () => {
      const request = {
        token: '',
        parameters: {},
      };

      const config = { domain };

      const response = await CONNECTION_HANDLERS.auth0_list_connections(request, config);

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('Missing authorization token');
    });

    it('should handle missing domain', async () => {
      const request = {
        token,
        parameters: {},
      };

      const config = { domain: undefined };

      const response = await CONNECTION_HANDLERS.auth0_list_connections(request, config);

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('Auth0 domain is not configured');
    });

    // Note: Rate limiting (429) test removed because Auth0 SDK has built-in
    // retry logic (10 retries with exponential backoff), making it impractical
    // to test without very long timeouts or mocking at a lower level.
  });

  describe('auth0_get_connection', () => {
    it('should return a single connection', async () => {
      const connectionId = mockConnections[0].id;

      const request = {
        token,
        parameters: {
          id: connectionId,
        },
      };

      const config = { domain };

      const response = await CONNECTION_HANDLERS.auth0_get_connection(request, config);

      expect(response.isError).toBe(false);

      // The response should be a JSON string that we can parse
      const parsedContent = JSON.parse(response.content[0].text);
      expect(parsedContent.id).toBe(connectionId);
      expect(parsedContent.strategy).toBe('google-oauth2');
    });

    it('should handle missing id parameter', async () => {
      const request = {
        token,
        parameters: {},
      };

      const config = { domain };

      const response = await CONNECTION_HANDLERS.auth0_get_connection(request, config);

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('id is required');
    });

    it('should handle connection not found (404)', async () => {
      // Override the handler for this specific test
      server.use(
        http.get('https://*/api/v2/connections/non-existent-id', () => {
          return new HttpResponse(null, { status: 404 });
        })
      );

      const request = {
        token,
        parameters: {
          id: 'non-existent-id',
        },
      };

      const config = { domain };

      const response = await CONNECTION_HANDLERS.auth0_get_connection(request, config);

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('not found');
    });

    it('should handle missing token', async () => {
      const request = {
        token: '',
        parameters: {
          id: 'con_google123',
        },
      };

      const config = { domain };

      const response = await CONNECTION_HANDLERS.auth0_get_connection(request, config);

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('Missing authorization token');
    });

    it('should handle missing domain', async () => {
      const request = {
        token,
        parameters: {
          id: 'con_google123',
        },
      };

      const config = { domain: undefined };

      const response = await CONNECTION_HANDLERS.auth0_get_connection(request, config);

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('Auth0 domain is not configured');
    });

    it('should handle unauthorized error (401)', async () => {
      server.use(
        http.get('https://*/api/v2/connections/:id', () => {
          return new HttpResponse(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        })
      );

      const request = {
        token: 'invalid-token',
        parameters: {
          id: 'con_google123',
        },
      };

      const config = { domain };

      const response = await CONNECTION_HANDLERS.auth0_get_connection(request, config);

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('Unauthorized');
    });

    it('should handle forbidden error (403)', async () => {
      server.use(
        http.get('https://*/api/v2/connections/:id', () => {
          return new HttpResponse(JSON.stringify({ error: 'Forbidden' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          });
        })
      );

      const request = {
        token,
        parameters: {
          id: 'con_google123',
        },
      };

      const config = { domain };

      const response = await CONNECTION_HANDLERS.auth0_get_connection(request, config);

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('Forbidden');
    });
  });

  describe('auth0_create_connection', () => {
    it('should create a new Google connection', async () => {
      const request = {
        token,
        parameters: {
          name: 'my-google-connection',
          strategy: 'google-oauth2',
          display_name: 'Google Login',
          options: {
            client_id: 'google-client-id',
            client_secret: 'google-client-secret',
            scope: ['email', 'profile'],
          },
        },
      };

      const config = { domain };

      const response = await CONNECTION_HANDLERS.auth0_create_connection(request, config);

      expect(response.isError).toBe(false);

      const parsedContent = JSON.parse(response.content[0].text);
      expect(parsedContent.name).toBe('my-google-connection');
      expect(parsedContent.strategy).toBe('google-oauth2');
      expect(parsedContent.id).toBeDefined();
    });

    it('should create a GitHub connection', async () => {
      const request = {
        token,
        parameters: {
          name: 'my-github-connection',
          strategy: 'github',
          options: {
            client_id: 'github-client-id',
            client_secret: 'github-client-secret',
            scope: ['user:email', 'read:user'],
          },
        },
      };

      const config = { domain };

      const response = await CONNECTION_HANDLERS.auth0_create_connection(request, config);

      expect(response.isError).toBe(false);

      const parsedContent = JSON.parse(response.content[0].text);
      expect(parsedContent.name).toBe('my-github-connection');
      expect(parsedContent.strategy).toBe('github');
    });

    it('should create a Facebook connection', async () => {
      const request = {
        token,
        parameters: {
          name: 'my-facebook-connection',
          strategy: 'facebook',
        },
      };

      const config = { domain };

      const response = await CONNECTION_HANDLERS.auth0_create_connection(request, config);

      expect(response.isError).toBe(false);

      const parsedContent = JSON.parse(response.content[0].text);
      expect(parsedContent.name).toBe('my-facebook-connection');
      expect(parsedContent.strategy).toBe('facebook');
    });

    it('should create a LinkedIn connection', async () => {
      const request = {
        token,
        parameters: {
          name: 'my-linkedin-connection',
          strategy: 'linkedin',
        },
      };

      const config = { domain };

      const response = await CONNECTION_HANDLERS.auth0_create_connection(request, config);

      expect(response.isError).toBe(false);

      const parsedContent = JSON.parse(response.content[0].text);
      expect(parsedContent.name).toBe('my-linkedin-connection');
      expect(parsedContent.strategy).toBe('linkedin');
    });

    it('should handle missing name parameter', async () => {
      const request = {
        token,
        parameters: {
          strategy: 'google-oauth2',
        },
      };

      const config = { domain };

      const response = await CONNECTION_HANDLERS.auth0_create_connection(request, config);

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('name is required');
    });

    it('should handle missing strategy parameter', async () => {
      const request = {
        token,
        parameters: {
          name: 'my-connection',
        },
      };

      const config = { domain };

      const response = await CONNECTION_HANDLERS.auth0_create_connection(request, config);

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('strategy is required');
    });

    it('should handle invalid strategy', async () => {
      const request = {
        token,
        parameters: {
          name: 'my-connection',
          strategy: 'invalid-strategy',
        },
      };

      const config = { domain };

      const response = await CONNECTION_HANDLERS.auth0_create_connection(request, config);

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('Invalid strategy');
      expect(response.content[0].text).toContain('google-oauth2');
    });

    it('should handle duplicate connection name (409)', async () => {
      server.use(
        http.post('https://*/api/v2/connections', () => {
          return new HttpResponse(
            JSON.stringify({ error: 'Conflict', message: 'Connection already exists' }),
            {
              status: 409,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        })
      );

      const request = {
        token,
        parameters: {
          name: 'existing-connection',
          strategy: 'google-oauth2',
        },
      };

      const config = { domain };

      const response = await CONNECTION_HANDLERS.auth0_create_connection(request, config);

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('already exists');
    });

    it('should handle missing token', async () => {
      const request = {
        token: '',
        parameters: {
          name: 'my-connection',
          strategy: 'google-oauth2',
        },
      };

      const config = { domain };

      const response = await CONNECTION_HANDLERS.auth0_create_connection(request, config);

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('Missing authorization token');
    });

    it('should handle missing domain', async () => {
      const request = {
        token,
        parameters: {
          name: 'my-connection',
          strategy: 'google-oauth2',
        },
      };

      const config = { domain: undefined };

      const response = await CONNECTION_HANDLERS.auth0_create_connection(request, config);

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('Auth0 domain is not configured');
    });

    it('should handle unauthorized error (401)', async () => {
      server.use(
        http.post('https://*/api/v2/connections', () => {
          return new HttpResponse(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        })
      );

      const request = {
        token: 'invalid-token',
        parameters: {
          name: 'my-connection',
          strategy: 'google-oauth2',
        },
      };

      const config = { domain };

      const response = await CONNECTION_HANDLERS.auth0_create_connection(request, config);

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('Unauthorized');
    });

    it('should include enabled_clients when provided', async () => {
      server.use(
        http.post('https://*/api/v2/connections', async ({ request }) => {
          const body = (await request.json()) as Record<string, any>;
          return HttpResponse.json({
            ...body,
            id: 'con_new123',
          });
        })
      );

      const request = {
        token,
        parameters: {
          name: 'my-connection',
          strategy: 'google-oauth2',
          enabled_clients: ['client1', 'client2'],
        },
      };

      const config = { domain };

      const response = await CONNECTION_HANDLERS.auth0_create_connection(request, config);

      expect(response.isError).toBe(false);

      const parsedContent = JSON.parse(response.content[0].text);
      expect(parsedContent.enabled_clients).toEqual(['client1', 'client2']);
    });
  });

  describe('auth0_update_connection', () => {
    it('should update a connection display_name', async () => {
      const connectionId = mockConnections[0].id;

      server.use(
        http.patch(`https://*/api/v2/connections/${connectionId}`, async ({ request }) => {
          const body = (await request.json()) as Record<string, any>;
          return HttpResponse.json({
            ...mockConnections[0],
            ...body,
          });
        })
      );

      const request = {
        token,
        parameters: {
          id: connectionId,
          display_name: 'Updated Google Login',
        },
      };

      const config = { domain };

      const response = await CONNECTION_HANDLERS.auth0_update_connection(request, config);

      expect(response.isError).toBe(false);

      const parsedContent = JSON.parse(response.content[0].text);
      expect(parsedContent.display_name).toBe('Updated Google Login');
    });

    it('should update connection options', async () => {
      const connectionId = mockConnections[0].id;

      server.use(
        http.patch(`https://*/api/v2/connections/${connectionId}`, async ({ request }) => {
          const body = (await request.json()) as Record<string, any>;
          return HttpResponse.json({
            ...mockConnections[0],
            ...body,
          });
        })
      );

      const request = {
        token,
        parameters: {
          id: connectionId,
          options: {
            client_id: 'new-google-client-id',
            client_secret: 'new-google-client-secret',
            scope: ['email', 'profile', 'openid'],
          },
        },
      };

      const config = { domain };

      const response = await CONNECTION_HANDLERS.auth0_update_connection(request, config);

      expect(response.isError).toBe(false);

      const parsedContent = JSON.parse(response.content[0].text);
      expect(parsedContent.options.client_id).toBe('new-google-client-id');
      expect(parsedContent.options.scope).toContain('openid');
    });

    it('should update multiple fields at once', async () => {
      const connectionId = mockConnections[0].id;

      server.use(
        http.patch(`https://*/api/v2/connections/${connectionId}`, async ({ request }) => {
          const body = (await request.json()) as Record<string, any>;
          return HttpResponse.json({
            ...mockConnections[0],
            ...body,
          });
        })
      );

      const request = {
        token,
        parameters: {
          id: connectionId,
          display_name: 'Multi-Update Google',
          show_as_button: false,
        },
      };

      const config = { domain };

      const response = await CONNECTION_HANDLERS.auth0_update_connection(request, config);

      expect(response.isError).toBe(false);

      const parsedContent = JSON.parse(response.content[0].text);
      expect(parsedContent.display_name).toBe('Multi-Update Google');
      expect(parsedContent.show_as_button).toBe(false);
    });

    it('should handle missing id parameter', async () => {
      const request = {
        token,
        parameters: {
          display_name: 'Updated Name',
        },
      };

      const config = { domain };

      const response = await CONNECTION_HANDLERS.auth0_update_connection(request, config);

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('id is required');
    });

    it('should handle no update fields provided', async () => {
      const request = {
        token,
        parameters: {
          id: 'con_google123',
        },
      };

      const config = { domain };

      const response = await CONNECTION_HANDLERS.auth0_update_connection(request, config);

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('No update fields provided');
    });

    it('should handle connection not found (404)', async () => {
      server.use(
        http.patch('https://*/api/v2/connections/non-existent-id', () => {
          return new HttpResponse(null, { status: 404 });
        })
      );

      const request = {
        token,
        parameters: {
          id: 'non-existent-id',
          display_name: 'Updated Name',
        },
      };

      const config = { domain };

      const response = await CONNECTION_HANDLERS.auth0_update_connection(request, config);

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('not found');
    });

    it('should handle missing token', async () => {
      const request = {
        token: '',
        parameters: {
          id: 'con_google123',
          display_name: 'Updated Name',
        },
      };

      const config = { domain };

      const response = await CONNECTION_HANDLERS.auth0_update_connection(request, config);

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('Missing authorization token');
    });

    it('should handle missing domain', async () => {
      const request = {
        token,
        parameters: {
          id: 'con_google123',
          display_name: 'Updated Name',
        },
      };

      const config = { domain: undefined };

      const response = await CONNECTION_HANDLERS.auth0_update_connection(request, config);

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('Auth0 domain is not configured');
    });

    it('should handle unauthorized error (401)', async () => {
      server.use(
        http.patch('https://*/api/v2/connections/:id', () => {
          return new HttpResponse(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        })
      );

      const request = {
        token: 'invalid-token',
        parameters: {
          id: 'con_google123',
          display_name: 'Updated Name',
        },
      };

      const config = { domain };

      const response = await CONNECTION_HANDLERS.auth0_update_connection(request, config);

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('Unauthorized');
    });

    it('should handle forbidden error (403)', async () => {
      server.use(
        http.patch('https://*/api/v2/connections/:id', () => {
          return new HttpResponse(JSON.stringify({ error: 'Forbidden' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          });
        })
      );

      const request = {
        token,
        parameters: {
          id: 'con_google123',
          display_name: 'Updated Name',
        },
      };

      const config = { domain };

      const response = await CONNECTION_HANDLERS.auth0_update_connection(request, config);

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('Forbidden');
    });
  });

  describe('auth0_delete_connection', () => {
    it('should delete a connection successfully', async () => {
      const connectionId = mockConnections[0].id;

      const request = {
        token,
        parameters: {
          id: connectionId,
        },
      };

      const config = { domain };

      const response = await CONNECTION_HANDLERS.auth0_delete_connection(request, config);

      expect(response.isError).toBe(false);

      const parsedContent = JSON.parse(response.content[0].text);
      expect(parsedContent.deleted).toBe(true);
      expect(parsedContent.id).toBe(connectionId);
      expect(parsedContent.message).toContain('successfully deleted');
    });

    it('should handle missing id parameter', async () => {
      const request = {
        token,
        parameters: {},
      };

      const config = { domain };

      const response = await CONNECTION_HANDLERS.auth0_delete_connection(request, config);

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('id is required');
    });

    it('should handle connection not found (404)', async () => {
      server.use(
        http.delete('https://*/api/v2/connections/non-existent-id', () => {
          return new HttpResponse(null, { status: 404 });
        })
      );

      const request = {
        token,
        parameters: {
          id: 'non-existent-id',
        },
      };

      const config = { domain };

      const response = await CONNECTION_HANDLERS.auth0_delete_connection(request, config);

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('not found');
    });

    it('should handle missing token', async () => {
      const request = {
        token: '',
        parameters: {
          id: 'con_google123',
        },
      };

      const config = { domain };

      const response = await CONNECTION_HANDLERS.auth0_delete_connection(request, config);

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('Missing authorization token');
    });

    it('should handle missing domain', async () => {
      const request = {
        token,
        parameters: {
          id: 'con_google123',
        },
      };

      const config = { domain: undefined };

      const response = await CONNECTION_HANDLERS.auth0_delete_connection(request, config);

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('Auth0 domain is not configured');
    });

    it('should handle unauthorized error (401)', async () => {
      server.use(
        http.delete('https://*/api/v2/connections/:id', () => {
          return new HttpResponse(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        })
      );

      const request = {
        token: 'invalid-token',
        parameters: {
          id: 'con_google123',
        },
      };

      const config = { domain };

      const response = await CONNECTION_HANDLERS.auth0_delete_connection(request, config);

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('Unauthorized');
    });

    it('should handle forbidden error (403)', async () => {
      server.use(
        http.delete('https://*/api/v2/connections/:id', () => {
          return new HttpResponse(JSON.stringify({ error: 'Forbidden' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          });
        })
      );

      const request = {
        token,
        parameters: {
          id: 'con_google123',
        },
      };

      const config = { domain };

      const response = await CONNECTION_HANDLERS.auth0_delete_connection(request, config);

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('Forbidden');
    });
  });

  describe('auth0_enable_connection_for_client', () => {
    it('should enable connection for a single client', async () => {
      const connectionId = mockConnections[0].id;
      const clientIds = ['client_abc123'];

      server.use(
        http.patch(`https://*/api/v2/connections/${connectionId}`, async ({ request }) => {
          const body = (await request.json()) as Record<string, any>;
          return HttpResponse.json({
            ...mockConnections[0],
            enabled_clients: body.enabled_clients,
          });
        })
      );

      const request = {
        token,
        parameters: {
          connection_id: connectionId,
          client_ids: clientIds,
        },
      };

      const config = { domain };

      const response = await CONNECTION_HANDLERS.auth0_enable_connection_for_client(
        request,
        config
      );

      expect(response.isError).toBe(false);

      const parsedContent = JSON.parse(response.content[0].text);
      expect(parsedContent.enabled_clients).toEqual(clientIds);
      expect(parsedContent.enabled_clients_count).toBe(1);
      expect(parsedContent.message).toContain('enabled for 1 client(s)');
    });

    it('should enable connection for multiple clients', async () => {
      const connectionId = mockConnections[0].id;
      const clientIds = ['client_abc123', 'client_def456', 'client_ghi789'];

      server.use(
        http.patch(`https://*/api/v2/connections/${connectionId}`, async ({ request }) => {
          const body = (await request.json()) as Record<string, any>;
          return HttpResponse.json({
            ...mockConnections[0],
            enabled_clients: body.enabled_clients,
          });
        })
      );

      const request = {
        token,
        parameters: {
          connection_id: connectionId,
          client_ids: clientIds,
        },
      };

      const config = { domain };

      const response = await CONNECTION_HANDLERS.auth0_enable_connection_for_client(
        request,
        config
      );

      expect(response.isError).toBe(false);

      const parsedContent = JSON.parse(response.content[0].text);
      expect(parsedContent.enabled_clients).toEqual(clientIds);
      expect(parsedContent.enabled_clients_count).toBe(3);
      expect(parsedContent.message).toContain('enabled for 3 client(s)');
    });

    it('should disable connection for all clients when empty array provided', async () => {
      const connectionId = mockConnections[0].id;
      const clientIds: string[] = [];

      server.use(
        http.patch(`https://*/api/v2/connections/${connectionId}`, async ({ request }) => {
          const body = (await request.json()) as Record<string, any>;
          return HttpResponse.json({
            ...mockConnections[0],
            enabled_clients: body.enabled_clients,
          });
        })
      );

      const request = {
        token,
        parameters: {
          connection_id: connectionId,
          client_ids: clientIds,
        },
      };

      const config = { domain };

      const response = await CONNECTION_HANDLERS.auth0_enable_connection_for_client(
        request,
        config
      );

      expect(response.isError).toBe(false);

      const parsedContent = JSON.parse(response.content[0].text);
      expect(parsedContent.enabled_clients).toEqual([]);
      expect(parsedContent.enabled_clients_count).toBe(0);
      expect(parsedContent.message).toContain('disabled for all clients');
    });

    it('should handle missing connection_id parameter', async () => {
      const request = {
        token,
        parameters: {
          client_ids: ['client_abc123'],
        },
      };

      const config = { domain };

      const response = await CONNECTION_HANDLERS.auth0_enable_connection_for_client(
        request,
        config
      );

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('connection_id is required');
    });

    it('should handle missing client_ids parameter', async () => {
      const request = {
        token,
        parameters: {
          connection_id: 'con_google123',
        },
      };

      const config = { domain };

      const response = await CONNECTION_HANDLERS.auth0_enable_connection_for_client(
        request,
        config
      );

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('client_ids is required');
    });

    it('should handle invalid client_ids type', async () => {
      const request = {
        token,
        parameters: {
          connection_id: 'con_google123',
          client_ids: 'not-an-array',
        },
      };

      const config = { domain };

      const response = await CONNECTION_HANDLERS.auth0_enable_connection_for_client(
        request,
        config
      );

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('client_ids must be an array');
    });

    it('should handle connection not found (404)', async () => {
      server.use(
        http.patch('https://*/api/v2/connections/non-existent-id', () => {
          return new HttpResponse(null, { status: 404 });
        })
      );

      const request = {
        token,
        parameters: {
          connection_id: 'non-existent-id',
          client_ids: ['client_abc123'],
        },
      };

      const config = { domain };

      const response = await CONNECTION_HANDLERS.auth0_enable_connection_for_client(
        request,
        config
      );

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('not found');
    });

    it('should handle missing token', async () => {
      const request = {
        token: '',
        parameters: {
          connection_id: 'con_google123',
          client_ids: ['client_abc123'],
        },
      };

      const config = { domain };

      const response = await CONNECTION_HANDLERS.auth0_enable_connection_for_client(
        request,
        config
      );

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('Missing authorization token');
    });

    it('should handle missing domain', async () => {
      const request = {
        token,
        parameters: {
          connection_id: 'con_google123',
          client_ids: ['client_abc123'],
        },
      };

      const config = { domain: undefined };

      const response = await CONNECTION_HANDLERS.auth0_enable_connection_for_client(
        request,
        config
      );

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('Auth0 domain is not configured');
    });

    it('should handle unauthorized error (401)', async () => {
      server.use(
        http.patch('https://*/api/v2/connections/:id', () => {
          return new HttpResponse(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        })
      );

      const request = {
        token: 'invalid-token',
        parameters: {
          connection_id: 'con_google123',
          client_ids: ['client_abc123'],
        },
      };

      const config = { domain };

      const response = await CONNECTION_HANDLERS.auth0_enable_connection_for_client(
        request,
        config
      );

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('Unauthorized');
    });

    it('should handle validation error (422)', async () => {
      server.use(
        http.patch('https://*/api/v2/connections/:id', () => {
          return new HttpResponse(JSON.stringify({ error: 'One or more clients do not exist' }), {
            status: 422,
            headers: { 'Content-Type': 'application/json' },
          });
        })
      );

      const request = {
        token,
        parameters: {
          connection_id: 'con_google123',
          client_ids: ['invalid_client_id'],
        },
      };

      const config = { domain };

      const response = await CONNECTION_HANDLERS.auth0_enable_connection_for_client(
        request,
        config
      );

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('Validation error');
    });
  });
});
