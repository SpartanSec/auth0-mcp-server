import { describe, it, expect } from 'vitest';
import { TOOLS, HANDLERS } from '../../src/tools/index';
import { ACTION_TOOLS, ACTION_HANDLERS } from '../../src/tools/actions';
import { APPLICATION_TOOLS, APPLICATION_HANDLERS } from '../../src/tools/applications';
import { BACKUP_TOOLS, BACKUP_HANDLERS } from '../../src/tools/backup';
import { CONNECTION_TOOLS, CONNECTION_HANDLERS } from '../../src/tools/connections';
import { FORM_TOOLS, FORM_HANDLERS } from '../../src/tools/forms';
import { LOG_TOOLS, LOG_HANDLERS } from '../../src/tools/logs';
import { RESOURCE_SERVER_TOOLS, RESOURCE_SERVER_HANDLERS } from '../../src/tools/resource-servers';

describe('Tools Index', () => {
  describe('TOOLS', () => {
    it('should combine all tools from individual modules', () => {
      // Calculate the expected total number of tools
      const expectedToolCount =
        ACTION_TOOLS.length +
        APPLICATION_TOOLS.length +
        BACKUP_TOOLS.length +
        CONNECTION_TOOLS.length +
        FORM_TOOLS.length +
        LOG_TOOLS.length +
        RESOURCE_SERVER_TOOLS.length;

      // Verify the combined TOOLS array has the correct length
      expect(TOOLS.length).toBe(expectedToolCount);

      // Verify that each tool from individual modules is included in the combined array
      const allIndividualTools = [
        ...ACTION_TOOLS,
        ...APPLICATION_TOOLS,
        ...BACKUP_TOOLS,
        ...CONNECTION_TOOLS,
        ...FORM_TOOLS,
        ...LOG_TOOLS,
        ...RESOURCE_SERVER_TOOLS,
      ];

      allIndividualTools.forEach((tool) => {
        const foundTool = TOOLS.find((t) => t.name === tool.name);
        expect(foundTool).toBeDefined();
        expect(foundTool?.description).toBe(tool.description);
      });
    });
  });

  describe('HANDLERS', () => {
    it('should combine all handlers from individual modules', () => {
      // Get all handler keys from individual modules
      const actionHandlerKeys = Object.keys(ACTION_HANDLERS);
      const applicationHandlerKeys = Object.keys(APPLICATION_HANDLERS);
      const backupHandlerKeys = Object.keys(BACKUP_HANDLERS);
      const connectionHandlerKeys = Object.keys(CONNECTION_HANDLERS);
      const formHandlerKeys = Object.keys(FORM_HANDLERS);
      const logHandlerKeys = Object.keys(LOG_HANDLERS);
      const resourceServerHandlerKeys = Object.keys(RESOURCE_SERVER_HANDLERS);

      // Calculate the expected total number of handlers
      const expectedHandlerCount =
        actionHandlerKeys.length +
        applicationHandlerKeys.length +
        backupHandlerKeys.length +
        connectionHandlerKeys.length +
        formHandlerKeys.length +
        logHandlerKeys.length +
        resourceServerHandlerKeys.length;

      // Verify the combined HANDLERS object has the correct number of keys
      expect(Object.keys(HANDLERS).length).toBe(expectedHandlerCount);

      // Verify that each handler from individual modules is included in the combined object
      const allHandlerKeys = [
        ...actionHandlerKeys,
        ...applicationHandlerKeys,
        ...backupHandlerKeys,
        ...connectionHandlerKeys,
        ...formHandlerKeys,
        ...logHandlerKeys,
        ...resourceServerHandlerKeys,
      ];

      allHandlerKeys.forEach((key) => {
        expect(HANDLERS[key]).toBeDefined();
      });

      // Verify that all handlers are functions
      actionHandlerKeys.forEach((key) => {
        expect(typeof HANDLERS[key]).toBe('function');
      });

      applicationHandlerKeys.forEach((key) => {
        expect(typeof HANDLERS[key]).toBe('function');
      });

      backupHandlerKeys.forEach((key) => {
        expect(typeof HANDLERS[key]).toBe('function');
      });

      connectionHandlerKeys.forEach((key) => {
        expect(typeof HANDLERS[key]).toBe('function');
      });

      formHandlerKeys.forEach((key) => {
        expect(typeof HANDLERS[key]).toBe('function');
      });

      logHandlerKeys.forEach((key) => {
        expect(typeof HANDLERS[key]).toBe('function');
      });

      resourceServerHandlerKeys.forEach((key) => {
        expect(typeof HANDLERS[key]).toBe('function');
      });
    });
  });
});
