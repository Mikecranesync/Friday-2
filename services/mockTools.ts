// Simulation of external services

export const mockEmails = [
  { from: 'boss@company.com', subject: 'Q4 Report', body: 'Please review the attached Q4 report by EOD.' },
  { from: 'newsletter@tech.com', subject: 'Weekly Tech Digest', body: 'Here are the top stories in AI this week...' },
  { from: 'mom@family.com', subject: 'Sunday Dinner', body: 'Are you coming over for dinner this Sunday?' },
];

export async function searchInternet(query: string): Promise<string> {
  // Simulating a search delay
  await new Promise(resolve => setTimeout(resolve, 800));
  
  const lowerQuery = query.toLowerCase();
  if (lowerQuery.includes('weather')) {
    return `The weather in San Francisco is currently 68°F and sunny.`;
  }
  if (lowerQuery.includes('stock')) {
    return `GOOGL is currently trading at $175.50, up 1.2% today.`;
  }
  if (lowerQuery.includes('news')) {
    return `Top news: Breakthrough in fusion energy announced today. Local sports team wins championship.`;
  }
  return `I found several results for "${query}". The top result discusses the recent advancements in that field.`;
}

export async function listEmails(count: number = 3): Promise<any[]> {
  await new Promise(resolve => setTimeout(resolve, 500));
  return mockEmails.slice(0, count);
}

export async function sendEmail(to: string, subject: string, body: string): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return `Email sent to ${to} with subject "${subject}".`;
}
