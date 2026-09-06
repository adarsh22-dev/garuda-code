export const FIRST_RUN_GUIDE = `Garuda Code first-run guide

1. Install
   npm install -g garuda-code@latest
   garuda --version

2. Configure a provider
   garuda providers setup
   garuda providers

   Or use a local provider:
   garuda config set-default ollama

3. Start the TUI
   garuda chat
   Trust the workspace when prompted.

4. Useful commands
   /help              Show commands
   /provider          Open the provider manager
   /provider add      Add a provider profile
   /models            List models from the active provider
   /compact           Reduce conversation context
   /guide             Show this guide
   /exit              Quit

5. Provider keys
   Store keys with 'garuda providers setup' or use a .env file based on .env.example.
   Never commit .env, API keys, or ~/.garuda/config.json.

Docs: https://github.com/adarsh22-dev/garuda-code/tree/master/docs
`;
