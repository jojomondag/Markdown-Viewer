/**
 * Mock implementation of @lezer/html module
 * This prevents errors related to the deserialize method
 */

export const htmlLanguage = {
  parser: {
    configure: () => htmlLanguage.parser
  }
};

// Create a mock parser with all required methods
export class HTMLParser {
  constructor() {
    this.mockParser = true;
  }
  
  parse() {
    return { type: "document" };
  }
  
  configure() {
    return this;
  }
  
  static deserialize() {
    return new HTMLParser();
  }
}

// Create dummy exports to match the real module
export const tags = {};
export const parser = new HTMLParser();
export const baseParser = new HTMLParser(); 