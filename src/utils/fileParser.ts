import { Readable } from 'stream';
import { readFileSync } from 'fs';
import { parse as parseJSON } from 'json5';

export interface ParsedAttachment {
  name: string;
  content: string;
  buffer?: Buffer;
}

export interface ParsedEmail {
  emailId: string;
  from: string;
  subject: string;
  body: string;
  attachments: ParsedAttachment[];
}

export async function parseEmailFile(filePath: string): Promise<ParsedEmail> {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const emailData = parseJSON(content);
    
    const attachments: ParsedAttachment[] = [];
    
    if (emailData.attachments && Array.isArray(emailData.attachments)) {
      for (const attachmentPath of emailData.attachments) {
        try {
          const attachmentContent = readFileSync(attachmentPath, 'utf-8');
          attachments.push({
            name: attachmentPath,
            content: attachmentContent,
            buffer: Buffer.from(attachmentContent)
          });
        } catch (err) {
          attachments.push({
            name: attachmentPath,
            content: '',
            buffer: undefined
          });
        }
      }
    }
    
    return {
      emailId: emailData.email_id || emailData.id || `email_${Date.now()}`,
      from: emailData.from || '',
      subject: emailData.subject || '',
      body: emailData.body || '',
      attachments
    };
  } catch (error) {
    throw new Error(`Failed to parse email file: ${error}`);
  }
}

export function parseAttachmentContent(
  content: string,
  attachmentType: string = 'text'
): Record<string, unknown> {
  try {
    if (attachmentType === 'json') {
      return JSON.parse(content);
    }
    
    // For text files, try to detect structure
    const lines = content.split('\n').map(line => line.trim()).filter(line => line);
    
    const result: Record<string, unknown> = {};
    
    // Simple key-value parsing
    lines.forEach(line => {
      if (line.includes(':')) {
        const [key, ...valueParts] = line.split(':');
        const value = valueParts.join(':').trim();
        result[key.trim()] = value;
      }
    });
    
    return result;
  } catch (error) {
    return {};
  }
}

export function extractFieldFromAttachment(
  attachments: ParsedAttachment[],
  fieldName: string,
  fieldMappings: Record<string, string>
): string | null {
  for (const attachment of attachments) {
    const parsedData = parseAttachmentContent(attachment.content);
    
    // Check direct field name
    if (parsedData[fieldName]) {
      return String(parsedData[fieldName]).trim();
    }
    
    // Check mapped field names
    const mappedName = fieldMappings[fieldName];
    if (mappedName && parsedData[mappedName]) {
      return String(parsedData[mappedName]).trim();
    }
  }
  
  return null;
}