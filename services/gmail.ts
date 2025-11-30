
// Service for interacting with the Gmail API
import { GOOGLE_CLIENT_ID } from "../constants";

declare var google: any;

export class GmailService {
  private static instance: GmailService;
  private tokenClient: any;
  private accessToken: string | null = null;

  private constructor() {}

  public static getInstance(): GmailService {
    if (!GmailService.instance) {
      GmailService.instance = new GmailService();
    }
    return GmailService.instance;
  }

  public init(onTokenReceived: (token: string) => void): void {
    if (typeof google === 'undefined' || !GOOGLE_CLIENT_ID) {
      console.warn("Google Identity Services not loaded or Client ID missing.");
      return;
    }

    this.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send',
      callback: (tokenResponse: any) => {
        if (tokenResponse && tokenResponse.access_token) {
          this.accessToken = tokenResponse.access_token;
          onTokenReceived(tokenResponse.access_token);
          console.log("Gmail access token received");
        }
      },
    });
  }

  public login(): void {
    if (!this.tokenClient) {
        // Retry init if it wasn't ready before
        this.init((t) => { this.accessToken = t; });
    }
    if (this.tokenClient) {
        this.tokenClient.requestAccessToken();
    } else {
        alert("Google Client ID is not configured in constants.ts");
    }
  }

  public isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  public async listEmails(count: number = 3): Promise<any[]> {
    if (!this.accessToken) throw new Error("Not authenticated with Gmail");

    try {
      // 1. List messages
      const listResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${count}`, 
        { headers: { Authorization: `Bearer ${this.accessToken}` } }
      );
      const listData = await listResponse.json();
      
      if (!listData.messages) return [];

      // 2. Get details for each message
      const emails = await Promise.all(listData.messages.map(async (msg: any) => {
        const msgResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`,
          { headers: { Authorization: `Bearer ${this.accessToken}` } }
        );
        const msgData = await msgResponse.json();
        
        const headers = msgData.payload.headers;
        const subject = headers.find((h: any) => h.name === 'Subject')?.value || '(No Subject)';
        const from = headers.find((h: any) => h.name === 'From')?.value || 'Unknown';
        const snippet = msgData.snippet;

        return { from, subject, body: snippet };
      }));

      return emails;

    } catch (error) {
      console.error("Gmail List Error", error);
      throw error;
    }
  }

  public async sendEmail(to: string, subject: string, body: string): Promise<string> {
    if (!this.accessToken) throw new Error("Not authenticated with Gmail");

    // Construct MIME message
    const emailLines = [
        `To: ${to}`,
        `Subject: ${subject}`,
        'Content-Type: text/plain; charset="UTF-8"',
        'MIME-Version: 1.0',
        '',
        body
    ];
    const email = emailLines.join('\r\n');

    // Base64Url encode
    const base64EncodedEmail = btoa(email)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    try {
        const response = await fetch(
            'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ raw: base64EncodedEmail })
            }
        );
        
        if (!response.ok) {
            throw new Error(`Gmail API Error: ${response.statusText}`);
        }
        
        return `Email sent successfully to ${to}`;

    } catch (error) {
        console.error("Gmail Send Error", error);
        throw error;
    }
  }
}
