/**
 * Maps Auth0 API client fields to Terraform auth0_client resource attributes
 */

/**
 * Auth0 client data from API response
 */
export interface Auth0ClientData {
  client_id: string;
  name: string;
  app_type?: 'spa' | 'native' | 'non_interactive' | 'regular_web';
  description?: string;
  callbacks?: string[];
  allowed_logout_urls?: string[];
  web_origins?: string[];
  allowed_origins?: string[];
  grant_types?: string[];
  is_first_party?: boolean;
  oidc_conformant?: boolean;
  cross_origin_authentication?: boolean;
  sso_disabled?: boolean;
  jwt_configuration?: {
    alg?: string;
    lifetime_in_seconds?: number;
    secret_encoded?: boolean;
  };
  token_endpoint_auth_method?: 'none' | 'client_secret_post' | 'client_secret_basic';
  refresh_token?: {
    rotation_type?: string;
    expiration_type?: string;
    leeway?: number;
    token_lifetime?: number;
    idle_token_lifetime?: number;
    infinite_token_lifetime?: boolean;
    infinite_idle_token_lifetime?: boolean;
  };
  organization_usage?: string;
  organization_require_behavior?: string;
  logo_uri?: string;
  initiate_login_uri?: string;
  client_metadata?: Record<string, string>;
}

/**
 * Terraform resource representation
 */
export interface TerraformClientResource {
  resourceName: string;
  resourceType: 'auth0_client';
  attributes: TerraformClientAttributes;
}

export interface TerraformClientCredentialsResource {
  resourceName: string;
  resourceType: 'auth0_client_credentials';
  attributes: {
    authentication_method: string;
    client_id_ref: string;
  };
}

export interface TerraformClientAttributes {
  name: string;
  app_type?: string;
  description?: string;
  callbacks?: string[];
  allowed_logout_urls?: string[];
  web_origins?: string[];
  allowed_origins?: string[];
  grant_types?: string[];
  is_first_party?: boolean;
  oidc_conformant?: boolean;
  cross_origin_auth?: boolean;
  sso_disabled?: boolean;
  jwt_configuration?: {
    alg?: string;
    lifetime_in_seconds?: number | string; // Can be variable reference
    secret_encoded?: boolean;
  };
  refresh_token?: {
    rotation_type?: string;
    expiration_type?: string;
    leeway?: number;
    token_lifetime?: number;
    idle_token_lifetime?: number;
    infinite_token_lifetime?: boolean;
    infinite_idle_token_lifetime?: boolean;
  };
  organization_usage?: string;
  organization_require_behavior?: string;
  logo_uri?: string;
  initiate_login_uri?: string;
}

export interface MappingOptions {
  /** Use Terraform variables for JWT lifetime (e.g., var.jwt_lifetime_seconds) */
  useVariableForJwtLifetime?: boolean;
  /** Variable name for JWT lifetime (default: jwt_lifetime_seconds) */
  jwtLifetimeVariableName?: string;
  /** Variable name for SPA JWT lifetime (default: spa_jwt_lifetime_seconds) */
  spaJwtLifetimeVariableName?: string;
  /** Prefix for resource names */
  resourceNamePrefix?: string;
}

/**
 * Convert a string to snake_case for Terraform resource names
 */
export function toSnakeCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_') // Replace non-alphanumeric with underscore
    .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
    .replace(/_+/g, '_'); // Collapse multiple underscores
}

/**
 * Generate a valid Terraform resource name from Auth0 client name
 */
export function generateResourceName(clientName: string, prefix?: string): string {
  const baseName = toSnakeCase(clientName);
  return prefix ? `${prefix}_${baseName}` : baseName;
}

/**
 * Map Auth0 client data to Terraform auth0_client resource
 */
export function mapClientToTerraform(
  client: Auth0ClientData,
  options: MappingOptions = {}
): TerraformClientResource {
  const {
    useVariableForJwtLifetime = true,
    jwtLifetimeVariableName = 'jwt_lifetime_seconds',
    spaJwtLifetimeVariableName = 'spa_jwt_lifetime_seconds',
    resourceNamePrefix,
  } = options;

  const resourceName = generateResourceName(client.name, resourceNamePrefix);

  const attributes: TerraformClientAttributes = {
    name: client.name,
  };

  // Basic attributes
  if (client.app_type) {
    attributes.app_type = client.app_type;
  }

  if (client.description) {
    attributes.description = client.description;
  }

  // URL arrays
  if (client.callbacks && client.callbacks.length > 0) {
    attributes.callbacks = client.callbacks;
  }

  if (client.allowed_logout_urls && client.allowed_logout_urls.length > 0) {
    attributes.allowed_logout_urls = client.allowed_logout_urls;
  }

  if (client.web_origins && client.web_origins.length > 0) {
    attributes.web_origins = client.web_origins;
  }

  if (client.allowed_origins && client.allowed_origins.length > 0) {
    attributes.allowed_origins = client.allowed_origins;
  }

  // Grant types
  if (client.grant_types && client.grant_types.length > 0) {
    attributes.grant_types = client.grant_types;
  }

  // Boolean flags
  if (client.is_first_party !== undefined) {
    attributes.is_first_party = client.is_first_party;
  }

  if (client.oidc_conformant !== undefined) {
    attributes.oidc_conformant = client.oidc_conformant;
  }

  // Note: Auth0 API uses cross_origin_authentication, Terraform uses cross_origin_auth
  if (client.cross_origin_authentication !== undefined) {
    attributes.cross_origin_auth = client.cross_origin_authentication;
  }

  if (client.sso_disabled !== undefined) {
    attributes.sso_disabled = client.sso_disabled;
  }

  // JWT configuration
  if (client.jwt_configuration) {
    const jwtConfig: TerraformClientAttributes['jwt_configuration'] = {};

    if (client.jwt_configuration.alg) {
      jwtConfig.alg = client.jwt_configuration.alg;
    }

    if (client.jwt_configuration.lifetime_in_seconds !== undefined) {
      if (useVariableForJwtLifetime) {
        // Use different variable for SPA clients
        const varName =
          client.app_type === 'spa' ? spaJwtLifetimeVariableName : jwtLifetimeVariableName;
        jwtConfig.lifetime_in_seconds = `var.${varName}`;
      } else {
        jwtConfig.lifetime_in_seconds = client.jwt_configuration.lifetime_in_seconds;
      }
    }

    if (client.jwt_configuration.secret_encoded !== undefined) {
      jwtConfig.secret_encoded = client.jwt_configuration.secret_encoded;
    }

    if (Object.keys(jwtConfig).length > 0) {
      attributes.jwt_configuration = jwtConfig;
    }
  }

  // Refresh token configuration
  if (client.refresh_token) {
    const refreshConfig: TerraformClientAttributes['refresh_token'] = {};

    if (client.refresh_token.rotation_type) {
      refreshConfig.rotation_type = client.refresh_token.rotation_type;
    }
    if (client.refresh_token.expiration_type) {
      refreshConfig.expiration_type = client.refresh_token.expiration_type;
    }
    if (client.refresh_token.leeway !== undefined) {
      refreshConfig.leeway = client.refresh_token.leeway;
    }
    if (client.refresh_token.token_lifetime !== undefined) {
      refreshConfig.token_lifetime = client.refresh_token.token_lifetime;
    }
    if (client.refresh_token.idle_token_lifetime !== undefined) {
      refreshConfig.idle_token_lifetime = client.refresh_token.idle_token_lifetime;
    }
    if (client.refresh_token.infinite_token_lifetime !== undefined) {
      refreshConfig.infinite_token_lifetime = client.refresh_token.infinite_token_lifetime;
    }
    if (client.refresh_token.infinite_idle_token_lifetime !== undefined) {
      refreshConfig.infinite_idle_token_lifetime =
        client.refresh_token.infinite_idle_token_lifetime;
    }

    if (Object.keys(refreshConfig).length > 0) {
      attributes.refresh_token = refreshConfig;
    }
  }

  // Organization settings
  if (client.organization_usage) {
    attributes.organization_usage = client.organization_usage;
  }

  if (client.organization_require_behavior) {
    attributes.organization_require_behavior = client.organization_require_behavior;
  }

  // URIs
  if (client.logo_uri) {
    attributes.logo_uri = client.logo_uri;
  }

  if (client.initiate_login_uri) {
    attributes.initiate_login_uri = client.initiate_login_uri;
  }

  return {
    resourceName,
    resourceType: 'auth0_client',
    attributes,
  };
}

/**
 * Determine if a client needs an auth0_client_credentials resource
 * M2M clients (non_interactive) typically need this
 */
export function needsCredentialsResource(client: Auth0ClientData): boolean {
  return (
    client.app_type === 'non_interactive' ||
    client.token_endpoint_auth_method === 'client_secret_post' ||
    client.token_endpoint_auth_method === 'client_secret_basic'
  );
}

/**
 * Create auth0_client_credentials resource for a client
 */
export function mapClientCredentials(
  resourceName: string,
  authMethod: string = 'client_secret_post'
): TerraformClientCredentialsResource {
  return {
    resourceName,
    resourceType: 'auth0_client_credentials',
    attributes: {
      authentication_method: authMethod,
      client_id_ref: `auth0_client.${resourceName}.id`,
    },
  };
}
