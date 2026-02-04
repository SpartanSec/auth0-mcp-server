import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  toSnakeCase,
  generateResourceName,
  mapClientToTerraform,
  mapClientCredentials,
  needsCredentialsResource,
} from '../../src/utils/terraform-field-mapper';
import {
  generateAuth0ClientHcl,
  generateAuth0ClientCredentialsHcl,
  generateCompleteClientHcl,
  generateClientHclWithHeader,
} from '../../src/utils/hcl-generator';
import {
  TERRAFORM_EXPORT_TOOLS,
  TERRAFORM_EXPORT_HANDLERS,
} from '../../src/tools/terraform-export';

// Mock dependencies
vi.mock('../../src/utils/logger', () => ({
  log: vi.fn(),
}));

vi.mock('../../src/utils/auth0-client', () => ({
  getManagementClient: vi.fn(),
}));

vi.mock('../../src/utils/claude-api', () => ({
  claudeApi: {
    isConfigured: vi.fn(() => false),
    chat: vi.fn(),
  },
}));

vi.mock('../../src/utils/git-operations', () => ({
  validateGitRepo: vi.fn(() => ({ valid: true })),
  checkGhCli: vi.fn(() => ({ available: true })),
  createPRWithChanges: vi.fn(() => ({
    prUrl: 'https://github.com/test/repo/pull/1',
    branchName: 'auth0/export-client-test-app',
    filesChanged: ['modules/auth0/applications/clients/main.tf'],
  })),
  generateBranchName: vi.fn(() => 'auth0/export-client-test-app'),
}));

// Sample client data
const sampleSpaClient = {
  client_id: 'spa_client_123',
  name: 'Test SPA App',
  app_type: 'spa' as const,
  description: 'A test SPA application',
  callbacks: ['https://example.com/callback'],
  web_origins: ['https://example.com'],
  allowed_logout_urls: ['https://example.com/logout'],
  grant_types: ['authorization_code', 'implicit'],
  is_first_party: true,
  oidc_conformant: true,
  cross_origin_authentication: true,
  jwt_configuration: {
    alg: 'RS256',
    lifetime_in_seconds: 36000,
    secret_encoded: false,
  },
};

const sampleM2MClient = {
  client_id: 'm2m_client_456',
  name: 'Test M2M Service',
  app_type: 'non_interactive' as const,
  description: 'A test M2M client for service communication',
  grant_types: ['client_credentials'],
  jwt_configuration: {
    lifetime_in_seconds: 86400,
  },
  token_endpoint_auth_method: 'client_secret_post' as const,
};

describe('Terraform Field Mapper', () => {
  describe('toSnakeCase', () => {
    it('converts simple strings to snake_case', () => {
      expect(toSnakeCase('Hello World')).toBe('hello_world');
    });

    it('handles special characters', () => {
      expect(toSnakeCase('Test-App (v2)')).toBe('test_app_v2');
    });

    it('handles multiple spaces and dashes', () => {
      expect(toSnakeCase('My   App--Name')).toBe('my_app_name');
    });

    it('removes leading and trailing underscores', () => {
      expect(toSnakeCase('  Test App  ')).toBe('test_app');
    });
  });

  describe('generateResourceName', () => {
    it('generates resource name from client name', () => {
      expect(generateResourceName('Merchant Portal frontend')).toBe('merchant_portal_frontend');
    });

    it('applies prefix when provided', () => {
      expect(generateResourceName('Test App', 'prod')).toBe('prod_test_app');
    });
  });

  describe('mapClientToTerraform', () => {
    it('maps SPA client correctly', () => {
      const result = mapClientToTerraform(sampleSpaClient);

      expect(result.resourceName).toBe('test_spa_app');
      expect(result.resourceType).toBe('auth0_client');
      expect(result.attributes.name).toBe('Test SPA App');
      expect(result.attributes.app_type).toBe('spa');
      expect(result.attributes.is_first_party).toBe(true);
      expect(result.attributes.oidc_conformant).toBe(true);
      expect(result.attributes.cross_origin_auth).toBe(true);
      expect(result.attributes.callbacks).toEqual(['https://example.com/callback']);
    });

    it('maps M2M client correctly', () => {
      const result = mapClientToTerraform(sampleM2MClient);

      expect(result.resourceName).toBe('test_m2m_service');
      expect(result.attributes.app_type).toBe('non_interactive');
      expect(result.attributes.grant_types).toEqual(['client_credentials']);
    });

    it('uses variable for JWT lifetime when configured', () => {
      const result = mapClientToTerraform(sampleSpaClient, {
        useVariableForJwtLifetime: true,
        spaJwtLifetimeVariableName: 'spa_jwt_lifetime_seconds',
      });

      expect(result.attributes.jwt_configuration?.lifetime_in_seconds).toBe(
        'var.spa_jwt_lifetime_seconds'
      );
    });

    it('uses literal JWT lifetime when variables disabled', () => {
      const result = mapClientToTerraform(sampleSpaClient, {
        useVariableForJwtLifetime: false,
      });

      expect(result.attributes.jwt_configuration?.lifetime_in_seconds).toBe(36000);
    });
  });

  describe('needsCredentialsResource', () => {
    it('returns true for M2M clients', () => {
      expect(needsCredentialsResource(sampleM2MClient)).toBe(true);
    });

    it('returns false for SPA clients without auth method', () => {
      expect(needsCredentialsResource(sampleSpaClient)).toBe(false);
    });

    it('returns true for clients with client_secret_post', () => {
      expect(
        needsCredentialsResource({
          ...sampleSpaClient,
          token_endpoint_auth_method: 'client_secret_post',
        })
      ).toBe(true);
    });
  });

  describe('mapClientCredentials', () => {
    it('creates credentials resource with correct references', () => {
      const result = mapClientCredentials('test_app', 'client_secret_post');

      expect(result.resourceName).toBe('test_app');
      expect(result.resourceType).toBe('auth0_client_credentials');
      expect(result.attributes.authentication_method).toBe('client_secret_post');
      expect(result.attributes.client_id_ref).toBe('auth0_client.test_app.id');
    });
  });
});

describe('HCL Generator', () => {
  describe('generateAuth0ClientHcl', () => {
    it('generates valid HCL for SPA client', () => {
      const resource = mapClientToTerraform(sampleSpaClient);
      const hcl = generateAuth0ClientHcl(resource);

      expect(hcl).toContain('resource "auth0_client" "test_spa_app"');
      expect(hcl).toContain('name = "Test SPA App"');
      expect(hcl).toContain('app_type = "spa"');
      expect(hcl).toContain('is_first_party = true');
      expect(hcl).toContain('oidc_conformant = true');
      expect(hcl).toContain('callbacks = [');
      expect(hcl).toContain('"https://example.com/callback"');
      expect(hcl).toContain('jwt_configuration {');
      expect(hcl).toContain('alg = "RS256"');
    });

    it('generates valid HCL for M2M client', () => {
      const resource = mapClientToTerraform(sampleM2MClient);
      const hcl = generateAuth0ClientHcl(resource);

      expect(hcl).toContain('resource "auth0_client" "test_m2m_service"');
      expect(hcl).toContain('app_type = "non_interactive"');
      expect(hcl).toContain('grant_types = [');
      expect(hcl).toContain('"client_credentials"');
    });

    it('uses variable references when configured', () => {
      const resource = mapClientToTerraform(sampleM2MClient, {
        useVariableForJwtLifetime: true,
      });
      const hcl = generateAuth0ClientHcl(resource);

      expect(hcl).toContain('lifetime_in_seconds = var.jwt_lifetime_seconds');
    });
  });

  describe('generateAuth0ClientCredentialsHcl', () => {
    it('generates valid credentials HCL', () => {
      const resource = mapClientCredentials('test_app', 'client_secret_post');
      const hcl = generateAuth0ClientCredentialsHcl(resource);

      expect(hcl).toContain('resource "auth0_client_credentials" "test_app"');
      expect(hcl).toContain('authentication_method = "client_secret_post"');
      expect(hcl).toContain('client_id             = auth0_client.test_app.id');
    });
  });

  describe('generateCompleteClientHcl', () => {
    it('includes credentials resource for M2M client', () => {
      const hcl = generateCompleteClientHcl(sampleM2MClient);

      expect(hcl).toContain('resource "auth0_client" "test_m2m_service"');
      expect(hcl).toContain('resource "auth0_client_credentials" "test_m2m_service"');
    });

    it('does not include credentials for SPA client', () => {
      const hcl = generateCompleteClientHcl(sampleSpaClient);

      expect(hcl).toContain('resource "auth0_client" "test_spa_app"');
      expect(hcl).not.toContain('auth0_client_credentials');
    });
  });

  describe('generateClientHclWithHeader', () => {
    it('includes header comment with metadata', () => {
      const hcl = generateClientHclWithHeader(sampleSpaClient);

      expect(hcl).toContain('# Test SPA App');
      expect(hcl).toContain('# Generated by Auth0 MCP Server');
      expect(hcl).toContain('# Client ID: spa_client_123');
    });
  });
});

describe('Terraform Export Tool', () => {
  describe('Tool Definition', () => {
    it('has correct tool name', () => {
      expect(TERRAFORM_EXPORT_TOOLS[0].name).toBe('auth0_export_to_terraform_pr');
    });

    it('requires terraform_repo_path', () => {
      expect(TERRAFORM_EXPORT_TOOLS[0].inputSchema.required).toContain('terraform_repo_path');
    });

    it('has required scopes for reading clients', () => {
      expect(TERRAFORM_EXPORT_TOOLS[0]._meta?.requiredScopes).toContain('read:clients');
    });

    it('is marked as non-read-only', () => {
      expect(TERRAFORM_EXPORT_TOOLS[0].annotations?.readOnlyHint).toBe(false);
    });
  });

  describe('Handler', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('returns error when terraform_repo_path is missing', async () => {
      const result = await TERRAFORM_EXPORT_HANDLERS.auth0_export_to_terraform_pr(
        {
          token: 'test-token',
          parameters: {},
        },
        { domain: 'test.auth0.com' }
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('terraform_repo_path is required');
    });

    it('returns error when neither client_id nor client_data provided', async () => {
      const result = await TERRAFORM_EXPORT_HANDLERS.auth0_export_to_terraform_pr(
        {
          token: 'test-token',
          parameters: {
            terraform_repo_path: '/path/to/repo',
          },
        },
        { domain: 'test.auth0.com' }
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Either client_id or client_data is required');
    });

    it('returns error when both client_id and client_data provided', async () => {
      const result = await TERRAFORM_EXPORT_HANDLERS.auth0_export_to_terraform_pr(
        {
          token: 'test-token',
          parameters: {
            terraform_repo_path: '/path/to/repo',
            client_id: 'test_id',
            client_data: sampleSpaClient,
          },
        },
        { domain: 'test.auth0.com' }
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Provide either client_id or client_data');
    });

    it('handles dry_run mode correctly', async () => {
      const result = await TERRAFORM_EXPORT_HANDLERS.auth0_export_to_terraform_pr(
        {
          token: 'test-token',
          parameters: {
            terraform_repo_path: '/path/to/repo',
            client_data: sampleSpaClient,
            dry_run: true,
          },
        },
        { domain: 'test.auth0.com' }
      );

      expect(result.isError).toBe(false);
      const response = JSON.parse(result.content[0].text);
      expect(response.status).toBe('dry_run');
      expect(response.generated_hcl).toContain('resource "auth0_client"');
      expect(response.client_name).toBe('Test SPA App');
    });

    it('creates PR successfully with client_data', async () => {
      const result = await TERRAFORM_EXPORT_HANDLERS.auth0_export_to_terraform_pr(
        {
          token: 'test-token',
          parameters: {
            terraform_repo_path: '/path/to/repo',
            client_data: sampleSpaClient,
          },
        },
        { domain: 'test.auth0.com' }
      );

      expect(result.isError).toBe(false);
      const response = JSON.parse(result.content[0].text);
      expect(response.status).toBe('success');
      expect(response.pr_url).toBe('https://github.com/test/repo/pull/1');
      expect(response.client_name).toBe('Test SPA App');
    });

    it('validates client_data has required fields', async () => {
      const result = await TERRAFORM_EXPORT_HANDLERS.auth0_export_to_terraform_pr(
        {
          token: 'test-token',
          parameters: {
            terraform_repo_path: '/path/to/repo',
            client_data: { name: 'Missing client_id' },
          },
        },
        { domain: 'test.auth0.com' }
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(
        'client_data must include at least client_id and name'
      );
    });
  });
});
