# **App Name**: Lawlane AI Legal Advisor

## Core Features:

- AI Legal Advisor Chatbot: A floating chat bubble offering preliminary legal assessments using a simulated RAG approach focused on civil and commercial law. Generates a tool which assesses case complexity to determine if a lawyer is needed.
- Lawyer Marketplace: Displays a curated list of approved lawyers specializing in SMEs civil and fraud cases, pulled from Firestore. Each lawyer's specialty is clearly indicated, with links to contact them or view their profile.
- Case Hand-off Flow: Implements a user flow where the AI Advisor, after determining the need for a lawyer, presents a call-to-action button within the chat modal, navigating the user to the /lawyers page.
- Lawyer Profile Management: Lawyers are added via a manual onboarding process handled by the app team using a dedicated tool.
- User Authentication: Clients (SMEs) and Lawyers register/login using email/password. Lawyer approval is managed in Firestore.
- Firestore Integration: Utilizes Firestore for storing lawyer profiles and managing approval status.

## Style Guidelines:

- Primary color: Deep Navy Blue (#003655) for a modern and professional look, as requested by the user.
- Background color: Very light desaturated blue (#E0EBF5), brightness adjusted for a light color scheme, echoing the primary blue tone.
- Accent color: Analogous light purple (#550036), creating a contrast for emphasis and calls to action.
- Body and headline font: 'Inter' (sans-serif) for a modern, objective feel that is appropriate for legal topics.
- Professional and trustworthy icon set, focused on simplicity.
- Clean and responsive layout using Tailwind CSS, ensuring readability and ease of use across devices.
- Subtle transitions and animations to enhance user experience without being distracting.