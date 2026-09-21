import { readFileSync } from 'fs';
import { parse as parseJSON5 } from 'json5';

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
  attachments: string[];
}

export async function parseEmailFile(filePath: string): Promise<ParsedEmail> {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const emailData = parseJSON5(content);
    
    const attachments: string[] = [];
    
    if (emailData.attachments && Array.isArray(emailData.attachments)) {
      attachments.push(...emailData.attachments);
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
  content: string
): Record<string, unknown> {
  try {
    // Try JSON first
    try {
      return JSON.parse(content);
    } catch {
      // Try JSON5
      try {
        return parseJSON5(content);
      } catch {
        // Try text parsing
        const lines = content.split('\n').filter(line => line.trim());
        const data: Record<string, unknown> = {};
        
        lines.forEach(line => {
          if (line.includes(':')) {
            const [key, ...valueParts] = line.split(':');
            data[key.trim()] = valueParts.join(':').trim();
          }
        });
        
        return data;
      }
    }
  } catch (error) {
    return {};
  }
}

export function extractFieldFromAttachment(
  content: string,
  fieldName: string
): string | null {
  const parsedData = parseAttachmentContent(content);
  
  if (parsedData[fieldName]) {
    return String(parsedData[fieldName]).trim();
  }
  
  return null;
}
