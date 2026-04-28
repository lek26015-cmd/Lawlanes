import { repairChatDocumentsAction } from './src/app/actions/lawyer-actions';

async function run() {
  console.log("Starting repair...");
  const res = await repairChatDocumentsAction("2e81d82e-c5d2-46a1-9a23-b9b45dfb6b21");
  console.log("Repair result:", res);
}
run().catch(console.error);
