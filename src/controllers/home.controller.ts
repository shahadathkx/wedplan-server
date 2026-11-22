import type { RequestHandler } from "express";

const homePage = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#111827">
    <meta name="description" content="WedPlan Server API">
    <title>WEDPLAN-SERVER</title>
    <style>
      :root {
        color-scheme: dark;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-synthesis: none;
        text-rendering: optimizeLegibility;
        -webkit-font-smoothing: antialiased;
        --ink: #f8fafc;
        --muted: #aab4c6;
        --accent: #f2a6a0;
        --gold: #f5d6a0;
      }

      * { box-sizing: border-box; }

      body {
        min-height: 100vh;
        margin: 0;
        display: grid;
        place-items: center;
        overflow-x: hidden;
        padding: 32px 20px;
        color: var(--ink);
        background:
          radial-gradient(ellipse at 12% 18%, rgb(181 89 111 / 20%), transparent 34rem),
          radial-gradient(ellipse at 88% 84%, rgb(217 169 111 / 14%), transparent 32rem),
          #111827;
      }

      main {
        width: min(100%, 980px);
        position: relative;
        isolation: isolate;
        overflow: hidden;
        padding: clamp(32px, 8vw, 82px);
        border: 1px solid rgb(255 255 255 / 12%);
        border-radius: 30px;
        background: linear-gradient(135deg, rgb(255 255 255 / 9%), rgb(255 255 255 / 3%));
        box-shadow: 0 32px 100px rgb(0 0 0 / 35%);
        backdrop-filter: blur(16px);
      }

      main::after {
        position: absolute;
        z-index: -1;
        top: -180px;
        right: -100px;
        width: 380px;
        height: 380px;
        border: 1px solid rgb(245 214 160 / 22%);
        border-radius: 50%;
        box-shadow: 0 0 0 36px rgb(245 214 160 / 3%), 0 0 0 72px rgb(245 214 160 / 2%);
        content: "";
      }

      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        margin: 0 0 26px;
        color: var(--gold);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: .2em;
        text-transform: uppercase;
      }

      .eyebrow::before {
        width: 26px;
        height: 1px;
        background: var(--gold);
        content: "";
      }

      h1 {
        max-width: 760px;
        margin: 0;
        font-size: clamp(42px, 9vw, 88px);
        font-weight: 750;
        letter-spacing: -.075em;
        line-height: .98;
        overflow-wrap: anywhere;
      }

      h1 span {
        display: block;
        color: transparent;
        background: linear-gradient(100deg, #fff 12%, var(--accent) 58%, var(--gold));
        background-clip: text;
        -webkit-background-clip: text;
      }

      .intro {
        max-width: 570px;
        margin: 26px 0 0;
        color: var(--muted);
        font-size: clamp(16px, 2.2vw, 19px);
        line-height: 1.75;
      }

      .divider {
        width: 100%;
        height: 1px;
        margin: 42px 0 28px;
        background: linear-gradient(90deg, rgb(255 255 255 / 18%), transparent);
      }

      .links {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
      }

      .links a {
        display: inline-flex;
        min-height: 46px;
        align-items: center;
        justify-content: center;
        gap: 9px;
        padding: 0 17px;
        border: 1px solid rgb(255 255 255 / 15%);
        border-radius: 999px;
        color: var(--ink);
        background: rgb(255 255 255 / 5%);
        font-size: 14px;
        font-weight: 650;
        text-decoration: none;
        transition: border-color 160ms ease, background 160ms ease, transform 160ms ease;
      }

      .links a:hover {
        transform: translateY(-2px);
        border-color: rgb(242 166 160 / 60%);
        background: rgb(255 255 255 / 10%);
      }

      .links a:focus-visible {
        outline: 2px solid var(--gold);
        outline-offset: 3px;
      }

      .links a.primary {
        border-color: transparent;
        color: #271a20;
        background: linear-gradient(110deg, #f3b1a7, #f5d6a0);
      }

      .links a.primary:hover { background: linear-gradient(110deg, #ffd0c6, #ffe3b4); }

      footer {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: 12px;
        margin-top: 40px;
        color: #8490a4;
        font-size: 12px;
        letter-spacing: .04em;
      }

      @media (max-width: 520px) {
        main { border-radius: 22px; }
        .links { align-items: stretch; flex-direction: column; }
        .links a { width: 100%; }
        footer { flex-direction: column; }
      }

      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; }
      }
    </style>
  </head>
  <body>
    <main>
      <p class="eyebrow">The wedding planning platform ? API</p>
      <h1><span>WEDPLAN-SERVER</span></h1>
      <p class="intro">The service behind WedPlan?bringing couples, trusted wedding professionals, and the tools to plan a beautiful day together.</p>
      <div class="divider"></div>
      <nav class="links" aria-label="Server links">
        <a class="primary" href="/health">Check API health <span aria-hidden="true">?</span></a>
        <a href="/api/services/featured">Explore featured services <span aria-hidden="true">?</span></a>
      </nav>
      <footer>
        <span>WedPlan Server</span>
        <span>Thoughtfully planned. Beautifully connected.</span>
      </footer>
    </main>
  </body>
</html>`;

export const getHomePage: RequestHandler = (_request, response) => {
  response.status(200).type("html").send(homePage);
};
