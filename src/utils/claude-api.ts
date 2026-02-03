import { keychain } from './keychain.js';
import { log } from './logger.js';
import { createErrorResponse } from './http-utility.js';

/**
 * Claude API client for making requests to Anthropic's Claude API
 */
export class ClaudeApiClient {
  private apiKey: string | null = null;
  private baseUrl = 'https://api.anthropic.com/v1';

  /**
   * Initialize the Claude API client by loading the API key from keychain
   */
  async initialize(): Promise<void> {
    this.apiKey = await keychain.getClaudeApiKey();
    if (!this.apiKey) {
      log('Claude API key not found in keychain');
    }
  }

  /**
   * Check if the API key is configured
   */
  isConfigured(): boolean {
    return this.apiKey !== null && this.apiKey.length > 0;
  }

  /**
   * Make a request to Claude API
   * @param messages - Array of messages for the conversation
   * @param options - Additional options for the API request
   * @returns The response from Claude API
   */
  async chat(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    options: {
      model?: string;
      max_tokens?: number;
      temperature?: number;
      system?: string;
    } = {}
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Claude API key is not configured. Please set it using the config command.');
    }

    const {
      model = 'claude-3-opus-20240229',
      max_tokens = 1024,
      temperature = 0.7,
      system,
    } = options;

    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens,
          temperature,
          messages,
          ...(system && { system }),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Claude API error: ${response.status} ${response.statusText}. ${JSON.stringify(errorData)}`
        );
      }

      const data = await response.json();
      return data.content[0]?.text || '';
    } catch (error) {
      log(`Claude API request failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Generate a summary or description using Claude
   * @param text - The text to summarize or describe
   * @param prompt - Optional custom prompt
   * @returns Generated summary or description
   */
  async generateSummary(
    text: string,
    prompt: string = 'Please provide a concise summary of the following:'
  ): Promise<string> {
    return this.chat([
      {
        role: 'user',
        content: `${prompt}\n\n${text}`,
      },
    ]);
  }

  /**
   * Analyze Auth0 data using Claude
   * @param data - The Auth0 data to analyze
   * @param analysisType - Type of analysis to perform
   * @returns Analysis result
   */
  async analyzeAuth0Data(
    data: any,
    analysisType: 'security' | 'performance' | 'configuration' | 'general' = 'general'
  ): Promise<string> {
    const systemPrompts = {
      security: 'You are a security expert analyzing Auth0 configurations. Focus on security best practices, vulnerabilities, and recommendations.',
      performance: 'You are a performance expert analyzing Auth0 configurations. Focus on optimization opportunities and performance improvements.',
      configuration: 'You are an Auth0 expert analyzing configurations. Provide insights and best practice recommendations.',
      general: 'You are an expert analyzing Auth0 data. Provide helpful insights and recommendations.',
    };

    return this.chat(
      [
        {
          role: 'user',
          content: `Please analyze the following Auth0 data and provide insights:\n\n${JSON.stringify(data, null, 2)}`,
        },
      ],
      {
        system: systemPrompts[analysisType],
        max_tokens: 2048,
      }
    );
  }
}

// Export a singleton instance
export const claudeApi = new ClaudeApiClient();
