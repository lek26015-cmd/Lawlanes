
import { chat, fallbackChat } from '../src/ai/flows/chat-flow';

async function testRelevance() {
  console.log("--- Testing Relevance: 'คดีมรดก' ---");
  const start = Date.now();
  const response = await fallbackChat("คดีมรดก", "th");
  const end = Date.now();
  
  console.log(`Response Time: ${end - start}ms`);
  console.log("Titles found:");
  response.sections.forEach(s => console.log(` - ${s.title}`));
  
  const hasDivorce = response.sections.some(s => s.title.includes("หย่า"));
  if (hasDivorce) {
    console.log("❌ FAIL: Still finding 'หย่า' (Divorce) for 'มรดก' (Inheritance)");
  } else {
    console.log("✅ PASS: Relevance improved.");
  }
}

// Note: This script is intended to be run with ts-node or similar in a mock environment
// But since the actual flows are 'use server', we might need to mock some globals if they aren't available.
console.log("Verification script prepared.");
