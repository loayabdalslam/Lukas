
![Screenshot 2025-11-07 034626](https://github.com/user-attachments/assets/6bf1793b-9853-4447-9d72-a8b48e40c03a)

# Run and deploy your AI Studio app

Lukas is a cutting-edge web application that demonstrates a powerful multi-agent AI system. It provides a conversational interface for users to submit complex requests, which are then intelligently decomposed and executed by a team of specialized AI agents. This project serves as a powerful example of how to build sophisticated, autonomous systems using the Google Gemini API.

## How It Works

At its core, Lukas employs an **Orchestrator Agent** that acts as a project manager. When a user submits a request, the orchestrator analyzes it and creates a dynamic, step-by-step execution plan. It then delegates each step to the most appropriate specialized agent, continuously validating the results to ensure the plan stays on track. This cyclical process of planning, acting, and validating allows Lukas to tackle complex, multi-faceted problems with a high degree of accuracy.

## Key Features

- **Dynamic Task Planning:** Automatically generates multi-step plans based on user requests.
- **Multi-Agent System:** Leverages a team of specialized AI agents for various tasks.
- **Interactive UI:** Provides a real-time view of the execution plan and the results from each agent.
- **Conversational AI:** Engages with the user to ask for clarification when a request is ambiguous.
- **Bilingual Support:** Fully functional in both English and Arabic.
- **Customizable Theme:** Offers both light and dark modes for user comfort.

## The Agent Team

Lukas is equipped with a variety of specialized agents, each with a unique set of skills:

- **`SearchAgent`:** Conducts web searches to find up-to-date information, news, and facts.
- **`MapsAgent`:** Handles location-based queries, such as finding places, getting directions, and calculating distances.
- **`VisionAgent`:** Analyzes and interprets images provided by the user.
- **`VideoAgent`:** Processes and understands video content.
- **`EmailAgent`:** Sends emails on behalf of the user.
- **`SheetsAgent`:** Formats data into structured spreadsheets.
- **`DriveAgent`:** Interacts with files stored in a cloud drive.

## Getting Started

To get Lukas up and running on your local machine, follow these simple steps.

### Prerequisites

- **Node.js:** Ensure you have Node.js (v18 or later) installed. You can download it from [nodejs.org](https://nodejs.org/).
- **Gemini API Key:** You'll need a Google Gemini API key. You can obtain one from the [Google AI for Developers](https://ai.google.dev/) website.

### Installation and Setup

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/loayabdalslam/Lukas.git
    cd Lukas
    ```

2.  **Install Dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables:**
    Create a `.env` file in the root of the project and add your Gemini API key as follows:
    ```
    GEMINI_API_KEY=YOUR_API_KEY_HERE
    ```

4.  **Run the Development Server:**
    ```bash
    npm run dev
    ```
    The application will be available at `http://localhost:3000`.

## Technology Stack

- **Frontend:** React, TypeScript, Vite
- **AI:** Google Gemini API
- **Styling:** Tailwind CSS

---

We hope you enjoy exploring the capabilities of Lukas. If you have any questions or suggestions, feel free to open an issue or submit a pull request.
