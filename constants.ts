
import { FunctionDeclaration, Type } from "@google/genai";

// TODO: Replace with your actual Google Client ID from Google Cloud Console
export const GOOGLE_CLIENT_ID = '629976964482-1d117sk11mc6i6fmbel61faujsbrs40b.apps.googleusercontent.com'; 

export const SYSTEM_INSTRUCTION = `You are "Friday", a highly intelligent, witty, and efficient AI assistant designed for an in-car experience. 
Your voice should be calm, professional, yet warm. 
Keep your responses concise and to the point, suitable for a driver who cannot read long text. 
You have access to the user's email and can search the internet for real-time information.
If the user asks to check emails, use the "listEmails" tool. 
If the user asks about specific information not in your knowledge base, use the "searchInternet" tool.
Always prioritize safety and clarity.`;

export const TOOLS: FunctionDeclaration[] = [
  {
    name: 'listEmails',
    description: 'List the latest emails from the user\'s inbox.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        count: {
          type: Type.NUMBER,
          description: 'Number of emails to fetch (default 3)',
        },
      },
    },
  },
  {
    name: 'searchInternet',
    description: 'Search the internet for real-time information.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: 'The search query',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'sendEmail',
    description: 'Send an email to a recipient.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        to: { type: Type.STRING, description: 'Recipient email address' },
        subject: { type: Type.STRING, description: 'Email subject' },
        body: { type: Type.STRING, description: 'Email body content' },
      },
      required: ['to', 'subject', 'body'],
    },
  },
];