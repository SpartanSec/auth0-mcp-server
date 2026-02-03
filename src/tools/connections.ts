import type { HandlerConfig, HandlerRequest, HandlerResponse, Tool } from '../utils/types.js';
import { log } from '../utils/logger.js';
import { createErrorResponse, createSuccessResponse } from '../utils/http-utility.js';
import type { Auth0Config } from '../utils/config.js';
import { getManagementClient } from '../utils/auth0-client.js';
import type { ConnectionCreate, ConnectionCreateStrategyEnum, ConnectionUpdate } from 'auth0';

// Define all available connection tools
export const CONNECTION_TOOLS: Tool[] = [
  {
    name: 'auth0_list_connections',
    description:
      'List all connections in the Auth0 tenant, optionally filtered by strategy (e.g., social providers like google-oauth2, facebook, github, linkedin)',
    inputSchema: {
      type: 'object',
      properties: {
        strategy: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['google-oauth2', 'facebook', 'github', 'linkedin', 'apple', 'twitter', 'amazon'],
          },
          description:
            'Filter connections by strategy. Common social strategies: google-oauth2, facebook, github, linkedin',
        },
        page: { type: 'number', description: 'Page number (0-based)' },
        per_page: { type: 'number', description: 'Number of connections per page' },
        include_totals: { type: 'boolean', description: 'Include total count' },
      },
    },
    _meta: {
      requiredScopes: ['read:connections'],
      readOnly: true,
    },
    annotations: {
      title: 'List Auth0 Connections',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: 'auth0_get_connection',
    description: 'Get details about a specific Auth0 connection by its ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Connection ID to retrieve (e.g., con_xxx)' },
      },
      required: ['id'],
    },
    _meta: {
      requiredScopes: ['read:connections'],
      readOnly: true,
    },
    annotations: {
      title: 'Get Auth0 Connection Details',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: 'auth0_create_connection',
    description:
      'Create a new Auth0 connection for social identity providers (Google, Facebook, GitHub, LinkedIn). You must provide OAuth credentials from the identity provider.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description:
            'Connection name. Must start and end with alphanumeric, can contain alphanumeric and hyphens. Max 128 chars. Required.',
        },
        strategy: {
          type: 'string',
          enum: ['google-oauth2', 'facebook', 'github', 'linkedin'],
          description:
            'Identity provider strategy. Required. Use: google-oauth2 for Google, facebook for Facebook, github for GitHub, linkedin for LinkedIn.',
        },
        display_name: {
          type: 'string',
          description: 'Display name shown in the login UI.',
        },
        options: {
          type: 'object',
          description: 'Provider-specific options including OAuth credentials.',
          properties: {
            client_id: {
              type: 'string',
              description:
                'OAuth client ID from the identity provider. Required for social connections.',
            },
            client_secret: {
              type: 'string',
              description:
                'OAuth client secret from the identity provider. Required for social connections.',
            },
            scope: {
              type: 'array',
              items: { type: 'string' },
              description:
                'OAuth scopes to request. Examples: ["email", "profile"] for Google, ["email", "public_profile"] for Facebook.',
            },
          },
        },
        enabled_clients: {
          type: 'array',
          items: { type: 'string' },
          description: 'Client IDs (application IDs) to enable this connection for.',
        },
        show_as_button: {
          type: 'boolean',
          description: 'Show as a button in the login page (Universal Login). Defaults to true.',
        },
      },
      required: ['name', 'strategy'],
    },
    _meta: {
      requiredScopes: ['create:connections'],
    },
    annotations: {
      title: 'Create Auth0 Connection',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: 'auth0_update_connection',
    description:
      'Update an existing Auth0 connection. Only the fields you specify will be updated. Note: The options object is replaced entirely, not merged - include all options you want to keep.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Connection ID to update (e.g., con_xxx). Required.',
        },
        display_name: {
          type: 'string',
          description: 'Display name shown in the login UI.',
        },
        options: {
          type: 'object',
          description:
            'Provider-specific options. WARNING: This replaces the entire options object. Include all options you want to keep.',
          properties: {
            client_id: {
              type: 'string',
              description: 'OAuth client ID from the identity provider.',
            },
            client_secret: {
              type: 'string',
              description: 'OAuth client secret from the identity provider.',
            },
            scope: {
              type: 'array',
              items: { type: 'string' },
              description: 'OAuth scopes to request.',
            },
          },
        },
        enabled_clients: {
          type: 'array',
          items: { type: 'string' },
          description: 'Client IDs (application IDs) to enable this connection for.',
        },
        show_as_button: {
          type: 'boolean',
          description: 'Show as a button in the login page (Universal Login).',
        },
        is_domain_connection: {
          type: 'boolean',
          description: 'Whether this is a domain connection.',
        },
        metadata: {
          type: 'object',
          description: 'Metadata associated with the connection.',
        },
      },
      required: ['id'],
    },
    _meta: {
      requiredScopes: ['update:connections'],
    },
    annotations: {
      title: 'Update Auth0 Connection',
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: 'auth0_delete_connection',
    description:
      'Delete an Auth0 connection. WARNING: This will permanently delete the connection AND all users associated with it. This action cannot be undone. Use with caution.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Connection ID to delete (e.g., con_xxx). Required.',
        },
      },
      required: ['id'],
    },
    _meta: {
      requiredScopes: ['delete:connections'],
    },
    annotations: {
      title: 'Delete Auth0 Connection',
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: 'auth0_enable_connection_for_client',
    description:
      'Enable a connection for specific Auth0 applications (clients). This sets which applications can use this connection for login. Pass an array of client IDs to enable. To disable for all clients, pass an empty array.',
    inputSchema: {
      type: 'object',
      properties: {
        connection_id: {
          type: 'string',
          description: 'Connection ID to update (e.g., con_xxx). Required.',
        },
        client_ids: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Array of client (application) IDs to enable this connection for. Pass an empty array [] to disable the connection for all clients. Required.',
        },
      },
      required: ['connection_id', 'client_ids'],
    },
    _meta: {
      requiredScopes: ['update:connections'],
    },
    annotations: {
      title: 'Enable Connection for Applications',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
];

interface ConnectionsResponse {
  connections?: {
    id: string;
    name: string;
    strategy: string;
    display_name?: string;
    enabled_clients?: string[];
  }[];
  total?: number;
  limit?: number;
  start?: number;
}

// Define handlers for each connection tool
export const CONNECTION_HANDLERS: Record<
  string,
  (request: HandlerRequest, config: HandlerConfig) => Promise<HandlerResponse>
> = {
  auth0_list_connections: async (
    request: HandlerRequest,
    config: HandlerConfig
  ): Promise<HandlerResponse> => {
    try {
      if (!request.token) {
        log('Warning: Token is missing');
        return createErrorResponse('Error: Missing authorization token');
      }

      if (!config.domain) {
        log('Error: Auth0 domain is not configured');
        return createErrorResponse('Error: Auth0 domain is not configured');
      }

      // Build query parameters
      const options: Record<string, any> = {};
      if (request.parameters.strategy !== undefined) {
        options.strategy = request.parameters.strategy;
      }
      if (request.parameters.page !== undefined) {
        options.page = request.parameters.page;
      }
      if (request.parameters.per_page !== undefined) {
        options.per_page = request.parameters.per_page;
      } else {
        // Default to 10 items per page if not specified
        options.per_page = 10;
      }
      if (request.parameters.include_totals !== undefined) {
        options.include_totals = request.parameters.include_totals;
      } else {
        // Default to include totals
        options.include_totals = true;
      }

      try {
        const managementClientConfig: Auth0Config = {
          domain: config.domain,
          token: request.token,
        };
        const managementClient = await getManagementClient(managementClientConfig);

        // Use the Auth0 SDK to get all connections
        const { data: responseData } = await managementClient.connections.getAll(options);

        let connections = [];
        let total = 0;
        let page = 0;
        let perPage = options.per_page || 10;
        let totalPages = 1;

        // Handle different response formats based on include_totals option
        if (responseData && Array.isArray(responseData)) {
          // When include_totals is false, response is an array of connections
          connections = responseData;
          total = connections.length;
        } else if (
          responseData &&
          typeof responseData === 'object' &&
          'connections' in responseData
        ) {
          // When include_totals is true, response has pagination info
          const typedResponse = responseData as ConnectionsResponse;
          connections = typedResponse.connections || [];

          // Access pagination metadata if available
          total = typedResponse.total || connections.length;
          page = typedResponse.start || 0;
          perPage = typedResponse.limit || connections.length;

          totalPages = Math.ceil(total / perPage);
        } else {
          log('Invalid response format from Auth0 SDK');
          return createErrorResponse('Error: Received invalid response format from Auth0 API.');
        }

        // Format connections list
        const formattedConnections = connections.map((conn: any) => ({
          id: conn.id,
          name: conn.name,
          strategy: conn.strategy,
          display_name: conn.display_name || conn.name,
          enabled_clients_count: conn.enabled_clients?.length || 0,
        }));

        log(
          `Successfully retrieved ${formattedConnections.length} connections (page ${page + 1} of ${totalPages}, total: ${total})`
        );

        return createSuccessResponse(formattedConnections);
      } catch (sdkError: any) {
        log('Auth0 SDK error');

        let errorMessage = `Failed to list connections: ${sdkError.message || 'Unknown error'}`;

        if (sdkError.statusCode === 401) {
          errorMessage +=
            '\nError: Unauthorized. Your token might be expired or invalid. Try running "npx @auth0/auth0-mcp-server init" to refresh your token.';
        } else if (sdkError.statusCode === 403) {
          errorMessage +=
            '\nError: Forbidden. Your token might not have the required scopes (read:connections). Try running "npx @auth0/auth0-mcp-server init" to check the proper permissions.';
        } else if (sdkError.statusCode === 429) {
          errorMessage +=
            '\nError: Rate limited. You have made too many requests to the Auth0 API. Please try again later.';
        } else if (sdkError.statusCode >= 500) {
          errorMessage +=
            '\nError: Auth0 server error. The Auth0 API might be experiencing issues. Please try again later.';
        }

        return createErrorResponse(errorMessage);
      }
    } catch (error: any) {
      log('Error processing request');

      return createErrorResponse(
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },

  auth0_get_connection: async (
    request: HandlerRequest,
    config: HandlerConfig
  ): Promise<HandlerResponse> => {
    try {
      const connectionId = request.parameters.id;
      if (!connectionId) {
        return createErrorResponse('Error: id is required');
      }

      if (!request.token) {
        log('Warning: Token is empty or undefined');
        return createErrorResponse('Error: Missing authorization token');
      }

      if (!config.domain) {
        log('Error: Auth0 domain is not configured');
        return createErrorResponse('Error: Auth0 domain is not configured');
      }

      try {
        const managementClientConfig: Auth0Config = {
          domain: config.domain,
          token: request.token,
        };
        const managementClient = await getManagementClient(managementClientConfig);

        log(`Fetching connection with ID: ${connectionId}`);

        // Use the Auth0 SDK to get a specific connection
        const { data: connection } = await managementClient.connections.get({ id: connectionId });

        // Ensure we have the required properties
        if (!connection || typeof connection !== 'object') {
          log('Invalid response from Auth0 SDK');
          return createErrorResponse('Error: Received invalid response from Auth0 API');
        }

        log(
          `Successfully retrieved connection: ${connection.name || 'Unknown'} (${connection.id || connectionId})`
        );

        return createSuccessResponse(connection);
      } catch (sdkError: any) {
        log('Auth0 SDK error');

        let errorMessage = `Failed to get connection: ${sdkError.message || 'Unknown error'}`;

        if (sdkError.statusCode === 404) {
          errorMessage = `Connection with id '${connectionId}' not found.`;
        } else if (sdkError.statusCode === 401) {
          errorMessage +=
            '\nError: Unauthorized. Your token might be expired or invalid or missing read:connections scope.';
        } else if (sdkError.statusCode === 403) {
          errorMessage +=
            '\nError: Forbidden. Your token might not have the required scopes (read:connections).';
        }

        return createErrorResponse(errorMessage);
      }
    } catch (error: any) {
      log('Error processing request');

      return createErrorResponse(
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },

  auth0_create_connection: async (
    request: HandlerRequest,
    config: HandlerConfig
  ): Promise<HandlerResponse> => {
    try {
      const { name, strategy, display_name, options, enabled_clients, show_as_button } =
        request.parameters;

      // Validate required fields
      if (!name) {
        return createErrorResponse('Error: name is required');
      }

      if (!strategy) {
        return createErrorResponse('Error: strategy is required');
      }

      // Validate strategy is one of the supported social providers
      const supportedStrategies = ['google-oauth2', 'facebook', 'github', 'linkedin'];
      if (!supportedStrategies.includes(strategy)) {
        return createErrorResponse(
          `Error: Invalid strategy '${strategy}'. Supported strategies are: ${supportedStrategies.join(', ')}`
        );
      }

      if (!request.token) {
        log('Warning: Token is empty or undefined');
        return createErrorResponse('Error: Missing authorization token');
      }

      if (!config.domain) {
        log('Error: Auth0 domain is not configured');
        return createErrorResponse('Error: Auth0 domain is not configured');
      }

      // Build connection data
      const connectionData: ConnectionCreate = {
        name,
        strategy: strategy as ConnectionCreateStrategyEnum,
      };

      if (display_name !== undefined) {
        connectionData.display_name = display_name;
      }

      if (options !== undefined) {
        connectionData.options = options;
      }

      if (enabled_clients !== undefined) {
        connectionData.enabled_clients = enabled_clients;
      }

      if (show_as_button !== undefined) {
        connectionData.show_as_button = show_as_button;
      }

      try {
        const managementClientConfig: Auth0Config = {
          domain: config.domain,
          token: request.token,
        };
        const managementClient = await getManagementClient(managementClientConfig);

        log(`Creating connection with name: ${name}, strategy: ${strategy}`);

        // Use the Auth0 SDK to create a connection
        const { data: newConnection } = await managementClient.connections.create(connectionData);

        log(
          `Successfully created connection: ${newConnection.name || name} (${newConnection.id || 'new connection'})`
        );

        return createSuccessResponse(newConnection);
      } catch (sdkError: any) {
        log('Auth0 SDK error');

        let errorMessage = `Failed to create connection: ${sdkError.message || 'Unknown error'}`;

        if (sdkError.statusCode === 401) {
          errorMessage +=
            '\nError: Unauthorized. Your token might be expired or invalid or missing create:connections scope.';
        } else if (sdkError.statusCode === 403) {
          errorMessage +=
            '\nError: Forbidden. Your token might not have the required scopes (create:connections).';
        } else if (sdkError.statusCode === 409) {
          errorMessage = `Connection with name '${name}' already exists. Please use a different name.`;
        } else if (sdkError.statusCode === 400) {
          errorMessage +=
            '\nError: Bad request. Check that your connection name and options are valid.';
        } else if (sdkError.statusCode === 422) {
          errorMessage +=
            '\nError: Validation error. Check that all required fields are provided and valid.';
        }

        return createErrorResponse(errorMessage);
      }
    } catch (error: any) {
      log('Error processing request');

      return createErrorResponse(
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },

  auth0_update_connection: async (
    request: HandlerRequest,
    config: HandlerConfig
  ): Promise<HandlerResponse> => {
    try {
      const connectionId = request.parameters.id;
      if (!connectionId) {
        return createErrorResponse('Error: id is required');
      }

      if (!request.token) {
        log('Warning: Token is empty or undefined');
        return createErrorResponse('Error: Missing authorization token');
      }

      if (!config.domain) {
        log('Error: Auth0 domain is not configured');
        return createErrorResponse('Error: Auth0 domain is not configured');
      }

      // Extract all possible update parameters
      const {
        display_name,
        options,
        enabled_clients,
        show_as_button,
        is_domain_connection,
        metadata,
      } = request.parameters;

      // Build update data, only including fields that are present
      const updateData: ConnectionUpdate = {};

      if (display_name !== undefined) {
        updateData.display_name = display_name;
      }

      if (options !== undefined) {
        updateData.options = options;
      }

      if (enabled_clients !== undefined) {
        updateData.enabled_clients = enabled_clients;
      }

      if (show_as_button !== undefined) {
        updateData.show_as_button = show_as_button;
      }

      if (is_domain_connection !== undefined) {
        updateData.is_domain_connection = is_domain_connection;
      }

      if (metadata !== undefined) {
        updateData.metadata = metadata;
      }

      // Check if there's anything to update
      if (Object.keys(updateData).length === 0) {
        return createErrorResponse(
          'Error: No update fields provided. Specify at least one field to update (display_name, options, enabled_clients, show_as_button, is_domain_connection, or metadata).'
        );
      }

      try {
        const managementClientConfig: Auth0Config = {
          domain: config.domain,
          token: request.token,
        };
        const managementClient = await getManagementClient(managementClientConfig);

        log(`Updating connection with ID: ${connectionId}`);

        // Use the Auth0 SDK to update the connection
        const { data: updatedConnection } = await managementClient.connections.update(
          { id: connectionId },
          updateData
        );

        log(
          `Successfully updated connection: ${updatedConnection.name || 'Unknown'} (${updatedConnection.id || connectionId})`
        );

        return createSuccessResponse(updatedConnection);
      } catch (sdkError: any) {
        log('Auth0 SDK error');

        let errorMessage = `Failed to update connection: ${sdkError.message || 'Unknown error'}`;

        if (sdkError.statusCode === 404) {
          errorMessage = `Connection with id '${connectionId}' not found.`;
        } else if (sdkError.statusCode === 401) {
          errorMessage +=
            '\nError: Unauthorized. Your token might be expired or invalid or missing update:connections scope.';
        } else if (sdkError.statusCode === 403) {
          errorMessage +=
            '\nError: Forbidden. Your token might not have the required scopes (update:connections).';
        } else if (sdkError.statusCode === 400) {
          errorMessage += '\nError: Bad request. Check that your update data is valid.';
        } else if (sdkError.statusCode === 422) {
          errorMessage += '\nError: Validation error. Check that all provided fields are valid.';
        }

        return createErrorResponse(errorMessage);
      }
    } catch (error: any) {
      log('Error processing request');

      return createErrorResponse(
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },

  auth0_delete_connection: async (
    request: HandlerRequest,
    config: HandlerConfig
  ): Promise<HandlerResponse> => {
    try {
      const connectionId = request.parameters.id;
      if (!connectionId) {
        return createErrorResponse('Error: id is required');
      }

      if (!request.token) {
        log('Warning: Token is empty or undefined');
        return createErrorResponse('Error: Missing authorization token');
      }

      if (!config.domain) {
        log('Error: Auth0 domain is not configured');
        return createErrorResponse('Error: Auth0 domain is not configured');
      }

      try {
        const managementClientConfig: Auth0Config = {
          domain: config.domain,
          token: request.token,
        };
        const managementClient = await getManagementClient(managementClientConfig);

        log(`Deleting connection with ID: ${connectionId}`);

        // Use the Auth0 SDK to delete the connection
        await managementClient.connections.delete({ id: connectionId });

        log(`Successfully deleted connection: ${connectionId}`);

        return createSuccessResponse({
          message: `Connection '${connectionId}' has been successfully deleted.`,
          deleted: true,
          id: connectionId,
        });
      } catch (sdkError: any) {
        log('Auth0 SDK error');

        let errorMessage = `Failed to delete connection: ${sdkError.message || 'Unknown error'}`;

        if (sdkError.statusCode === 404) {
          errorMessage = `Connection with id '${connectionId}' not found.`;
        } else if (sdkError.statusCode === 401) {
          errorMessage +=
            '\nError: Unauthorized. Your token might be expired or invalid or missing delete:connections scope.';
        } else if (sdkError.statusCode === 403) {
          errorMessage +=
            '\nError: Forbidden. Your token might not have the required scopes (delete:connections).';
        }

        return createErrorResponse(errorMessage);
      }
    } catch (error: any) {
      log('Error processing request');

      return createErrorResponse(
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },

  auth0_enable_connection_for_client: async (
    request: HandlerRequest,
    config: HandlerConfig
  ): Promise<HandlerResponse> => {
    try {
      const connectionId = request.parameters.connection_id;
      const clientIds = request.parameters.client_ids;

      if (!connectionId) {
        return createErrorResponse('Error: connection_id is required');
      }

      if (clientIds === undefined) {
        return createErrorResponse('Error: client_ids is required');
      }

      if (!Array.isArray(clientIds)) {
        return createErrorResponse('Error: client_ids must be an array of client IDs');
      }

      if (!request.token) {
        log('Warning: Token is empty or undefined');
        return createErrorResponse('Error: Missing authorization token');
      }

      if (!config.domain) {
        log('Error: Auth0 domain is not configured');
        return createErrorResponse('Error: Auth0 domain is not configured');
      }

      try {
        const managementClientConfig: Auth0Config = {
          domain: config.domain,
          token: request.token,
        };
        const managementClient = await getManagementClient(managementClientConfig);

        log(
          `Enabling connection ${connectionId} for ${clientIds.length} client(s): ${clientIds.join(', ') || '(none)'}`
        );

        // Use the Auth0 SDK to update the connection's enabled_clients
        const { data: updatedConnection } = await managementClient.connections.update(
          { id: connectionId },
          { enabled_clients: clientIds }
        );

        const action =
          clientIds.length === 0
            ? 'disabled for all clients'
            : `enabled for ${clientIds.length} client(s)`;
        log(
          `Successfully ${action}: ${updatedConnection.name || 'Unknown'} (${updatedConnection.id || connectionId})`
        );

        return createSuccessResponse({
          message: `Connection '${updatedConnection.name || connectionId}' has been ${action}.`,
          connection_id: updatedConnection.id,
          connection_name: updatedConnection.name,
          enabled_clients: updatedConnection.enabled_clients || [],
          enabled_clients_count: updatedConnection.enabled_clients?.length || 0,
        });
      } catch (sdkError: any) {
        log('Auth0 SDK error');

        let errorMessage = `Failed to update connection clients: ${sdkError.message || 'Unknown error'}`;

        if (sdkError.statusCode === 404) {
          errorMessage = `Connection with id '${connectionId}' not found.`;
        } else if (sdkError.statusCode === 401) {
          errorMessage +=
            '\nError: Unauthorized. Your token might be expired or invalid or missing update:connections scope.';
        } else if (sdkError.statusCode === 403) {
          errorMessage +=
            '\nError: Forbidden. Your token might not have the required scopes (update:connections).';
        } else if (sdkError.statusCode === 400) {
          errorMessage += '\nError: Bad request. Check that the client IDs are valid.';
        } else if (sdkError.statusCode === 422) {
          errorMessage += '\nError: Validation error. One or more client IDs might not exist.';
        }

        return createErrorResponse(errorMessage);
      }
    } catch (error: any) {
      log('Error processing request');

      return createErrorResponse(
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },
};
