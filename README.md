<div align="center">
  <img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Lukas: The AI Orchestrator

Lukas is an experimental web application that showcases the power of a multi-agent AI system built with the Gemini API. It provides a conversational interface where users can make complex requests, and an AI orchestrator breaks them down into a step-by-step plan and executes it using a variety of specialized agents.

## ✨ Features

- **Dynamic Task Planning:** Automatically generates multi-step plans based on user requests.
- **Multi-Agent System:** Utilizes specialized agents for tasks like web search, map lookups, image analysis, and more.
- **Interactive UI:** Watch the plan unfold in real-time, view the output of each agent, and interact with the results.
- **Conversational:** Can ask clarifying questions to ensure the goal is understood correctly.
- **Multi-language Support:** Available in both English and Arabic.
- **Dark and Light Theme:** Switch between themes to suit your preference.

## 🚀 Getting Started

Follow these instructions to get the project up and running on your local machine.

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later recommended)
- [Gemini API Key](https://ai.google.dev/)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/lukas-ai-orchestrator.git
   cd lukas-ai-orchestrator
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   - Create a new file in the project root called `.env`.
   - Add your `GEMINI_API_KEY` to the file:
     ```
     GEMINI_API_KEY=YOUR_API_KEY_HERE
     ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

## 📜 Available Scripts

- `npm run dev`: Runs the app in development mode.
- `npm run build`: Builds the app for production to the `dist` folder.
- `npm run preview`: Previews the production build locally.

