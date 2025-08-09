import { describe, it, expect } from '@jest/globals';

describe('Basic Tests', () => {
  it('should pass basic TypeScript compilation', () => {
    expect(1 + 1).toBe(2);
  });

  it('should have environment variables loaded', () => {
    // Basic environment check
    expect(process.env).toBeDefined();
  });

  it('should import zod without issues', async () => {
    const { z } = await import('zod');
    const schema = z.string();
    expect(schema.parse('test')).toBe('test');
  });
});