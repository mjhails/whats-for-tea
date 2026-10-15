# Claude helper for What's for Tea?

This small Cloudflare Worker powers the **Ideas** and **Import** buttons. It keeps your Anthropic API key private and only answers people signed in to the app. Cloudflare's free plan is plenty.

## Set it up (about 10 minutes, all in the browser)

1. **Get an Anthropic API key.** Go to [console.anthropic.com](https://console.anthropic.com), add some credit (a few dollars lasts a long time for this), then create a key under *API keys*. Copy it somewhere safe.
2. **Create the worker.** Sign up or log in at [dash.cloudflare.com](https://dash.cloudflare.com). Go to *Workers & Pages → Create → Create Worker*, name it `whats-for-tea-ai`, and click *Deploy*.
3. **Paste in the code.** Click *Edit code*, delete what's there, paste in the whole of `worker.js` from this folder, then click *Deploy*.
4. **Add your key.** Go to the worker's *Settings → Variables and secrets → Add*. Choose type *Secret*, name `ANTHROPIC_API_KEY`, paste the key, and save.
5. **Optional: lock it to your family.** Add a *Text* variable called `ALLOWED_EMAILS` with your and Steph's sign-in emails, separated by a comma.
6. **Connect the app.** Copy the worker's address (it looks like `https://whats-for-tea-ai.yourname.workers.dev`) and put it in `src/config.js` as `AI_URL`. Once that's pushed, the Ideas and Import buttons appear.

## Costs

Each card or screenshot import is one request to Claude Sonnet 5.5, typically a penny or two. Ideas requests are less. You can set a monthly spend limit in the Anthropic console under *Limits*.
