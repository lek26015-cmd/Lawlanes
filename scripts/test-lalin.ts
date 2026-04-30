import { chat } from '../src/ai/flows/chat-flow';
async function run() {
  try {
    const result = await chat({
      prompt: "สวัสดี",
      history: [],
      locale: "th"
    });
    console.log("Success:", JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("Error:", err);
  }
}
run();
