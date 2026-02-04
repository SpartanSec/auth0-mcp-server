/**
 * Generates Terraform HCL strings for Auth0 resources
 */

import type {
  TerraformClientResource,
  TerraformClientCredentialsResource,
  TerraformClientAttributes,
  Auth0ClientData,
  MappingOptions,
} from './terraform-field-mapper.js';
import {
  mapClientToTerraform,
  mapClientCredentials,
  needsCredentialsResource,
  generateResourceName,
} from './terraform-field-mapper.js';

export interface HclGeneratorOptions extends MappingOptions {
  /** Include comments in generated HCL */
  includeComments?: boolean;
  /** Indent string (default: 2 spaces) */
  indent?: string;
}

/**
 * Escape a string value for HCL
 */
function escapeHclString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Format a value for HCL output
 */
function formatHclValue(value: unknown, indent: string, currentIndent: string): string {
  if (value === null || value === undefined) {
    return 'null';
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (typeof value === 'number') {
    return value.toString();
  }

  if (typeof value === 'string') {
    // Check if it's a variable reference (e.g., var.jwt_lifetime_seconds)
    if (value.startsWith('var.') || value.startsWith('local.') || value.startsWith('data.')) {
      return value;
    }
    // Check if it contains interpolation
    if (value.includes('${')) {
      return `"${escapeHclString(value)}"`;
    }
    return `"${escapeHclString(value)}"`;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }
    const items = value.map(
      (item) => `${currentIndent}${indent}${formatHclValue(item, indent, currentIndent + indent)},`
    );
    return `[\n${items.join('\n')}\n${currentIndent}]`;
  }

  // Objects are handled separately as HCL blocks
  return '';
}

/**
 * Generate HCL for a single attribute
 */
function generateAttribute(
  name: string,
  value: unknown,
  indent: string,
  currentIndent: string
): string {
  const formattedValue = formatHclValue(value, indent, currentIndent);
  if (!formattedValue) {
    return '';
  }
  // Align = sign for readability (common HCL style)
  return `${currentIndent}${name} = ${formattedValue}`;
}

/**
 * Generate HCL for a nested block (like jwt_configuration)
 */
function generateBlock(
  name: string,
  content: Record<string, unknown>,
  indent: string,
  currentIndent: string
): string {
  const lines: string[] = [];
  lines.push(`${currentIndent}${name} {`);

  const nestedIndent = currentIndent + indent;
  for (const [key, value] of Object.entries(content)) {
    if (value !== undefined && value !== null) {
      const attr = generateAttribute(key, value, indent, nestedIndent);
      if (attr) {
        lines.push(attr);
      }
    }
  }

  lines.push(`${currentIndent}}`);
  return lines.join('\n');
}

/**
 * Generate HCL for auth0_client resource
 */
export function generateAuth0ClientHcl(
  resource: TerraformClientResource,
  options: HclGeneratorOptions = {}
): string {
  const { includeComments = true, indent = '  ' } = options;

  const lines: string[] = [];

  // Add comment header
  if (includeComments && resource.attributes.description) {
    lines.push(`# ${resource.attributes.name}`);
  }

  // Resource declaration
  lines.push(`resource "auth0_client" "${resource.resourceName}" {`);

  const attrs = resource.attributes;
  const currentIndent = indent;

  // Order attributes to match existing terraffirm patterns
  // 1. name (or app_type first for M2M)
  if (attrs.app_type === 'non_interactive') {
    // M2M pattern: app_type, description, grant_types, name
    if (attrs.app_type) {
      lines.push(generateAttribute('app_type', attrs.app_type, indent, currentIndent));
    }
    if (attrs.description) {
      lines.push(generateAttribute('description', attrs.description, indent, currentIndent));
    }
    if (attrs.grant_types) {
      lines.push(generateAttribute('grant_types', attrs.grant_types, indent, currentIndent));
    }
    lines.push(generateAttribute('name', attrs.name, indent, currentIndent));
  } else {
    // SPA/Web pattern: name, description, then other attributes
    lines.push(generateAttribute('name', attrs.name, indent, currentIndent));
    if (attrs.description) {
      lines.push(generateAttribute('description', attrs.description, indent, currentIndent));
    }
    lines.push(''); // Empty line before app_type block

    if (attrs.app_type) {
      lines.push(generateAttribute('app_type', attrs.app_type, indent, currentIndent));
    }
    if (attrs.is_first_party !== undefined) {
      lines.push(generateAttribute('is_first_party', attrs.is_first_party, indent, currentIndent));
    }
    if (attrs.oidc_conformant !== undefined) {
      lines.push(
        generateAttribute('oidc_conformant', attrs.oidc_conformant, indent, currentIndent)
      );
    }
  }

  // URL arrays (with empty line before)
  const hasUrlArrays =
    attrs.callbacks || attrs.web_origins || attrs.allowed_logout_urls || attrs.allowed_origins;
  if (hasUrlArrays && attrs.app_type !== 'non_interactive') {
    lines.push('');
    if (attrs.callbacks) {
      lines.push(generateAttribute('callbacks', attrs.callbacks, indent, currentIndent));
    }
    if (attrs.web_origins) {
      lines.push(generateAttribute('web_origins', attrs.web_origins, indent, currentIndent));
    }
    if (attrs.allowed_logout_urls) {
      lines.push(
        generateAttribute('allowed_logout_urls', attrs.allowed_logout_urls, indent, currentIndent)
      );
    }
    if (attrs.allowed_origins) {
      lines.push(
        generateAttribute('allowed_origins', attrs.allowed_origins, indent, currentIndent)
      );
    }
  }

  // Grant types (for non-M2M, since M2M already handled above)
  if (attrs.grant_types && attrs.app_type !== 'non_interactive') {
    lines.push('');
    lines.push(generateAttribute('grant_types', attrs.grant_types, indent, currentIndent));
  }

  // Boolean flags
  if (attrs.cross_origin_auth !== undefined) {
    lines.push('');
    lines.push(
      generateAttribute('cross_origin_auth', attrs.cross_origin_auth, indent, currentIndent)
    );
  }

  if (attrs.sso_disabled !== undefined) {
    lines.push(generateAttribute('sso_disabled', attrs.sso_disabled, indent, currentIndent));
  }

  // JWT configuration block
  if (attrs.jwt_configuration) {
    lines.push('');
    lines.push(generateBlock('jwt_configuration', attrs.jwt_configuration, indent, currentIndent));
  }

  // Refresh token configuration block
  if (attrs.refresh_token) {
    lines.push('');
    lines.push(generateBlock('refresh_token', attrs.refresh_token, indent, currentIndent));
  }

  // Organization settings
  if (attrs.organization_usage) {
    lines.push('');
    lines.push(
      generateAttribute('organization_usage', attrs.organization_usage, indent, currentIndent)
    );
  }
  if (attrs.organization_require_behavior) {
    lines.push(
      generateAttribute(
        'organization_require_behavior',
        attrs.organization_require_behavior,
        indent,
        currentIndent
      )
    );
  }

  // URIs
  if (attrs.logo_uri) {
    lines.push('');
    lines.push(generateAttribute('logo_uri', attrs.logo_uri, indent, currentIndent));
  }
  if (attrs.initiate_login_uri) {
    lines.push(
      generateAttribute('initiate_login_uri', attrs.initiate_login_uri, indent, currentIndent)
    );
  }

  lines.push('}');

  // Filter out empty lines at the end before closing brace and clean up double empty lines
  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n') // Collapse multiple empty lines
    .replace(/\n\n}/g, '\n}'); // Remove empty line before closing brace
}

/**
 * Generate HCL for auth0_client_credentials resource
 */
export function generateAuth0ClientCredentialsHcl(
  resource: TerraformClientCredentialsResource,
  options: HclGeneratorOptions = {}
): string {
  const { indent = '  ' } = options;

  const lines: string[] = [];
  lines.push(`resource "auth0_client_credentials" "${resource.resourceName}" {`);
  lines.push(`${indent}authentication_method = "${resource.attributes.authentication_method}"`);
  lines.push(`${indent}client_id             = ${resource.attributes.client_id_ref}`);
  lines.push('}');

  return lines.join('\n');
}

/**
 * Generate complete HCL for an Auth0 client (including credentials if needed)
 */
export function generateCompleteClientHcl(
  client: Auth0ClientData,
  options: HclGeneratorOptions = {}
): string {
  const clientResource = mapClientToTerraform(client, options);
  const parts: string[] = [];

  // Generate auth0_client resource
  parts.push(generateAuth0ClientHcl(clientResource, options));

  // Generate auth0_client_credentials if needed
  if (needsCredentialsResource(client)) {
    const authMethod = client.token_endpoint_auth_method || 'client_secret_post';
    const credentialsResource = mapClientCredentials(clientResource.resourceName, authMethod);
    parts.push('');
    parts.push(generateAuth0ClientCredentialsHcl(credentialsResource, options));
  }

  return parts.join('\n');
}

/**
 * Generate HCL with a header comment for appending to existing files
 */
export function generateClientHclWithHeader(
  client: Auth0ClientData,
  options: HclGeneratorOptions = {}
): string {
  const timestamp = new Date().toISOString();
  const header = `
# ============================================================================
# ${client.name}
# Generated by Auth0 MCP Server on ${timestamp}
# Client ID: ${client.client_id}
# ============================================================================
`;

  return header + generateCompleteClientHcl(client, options);
}
