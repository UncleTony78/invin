import "server-only";
import puppeteer, { type Browser } from "puppeteer-core";
import { appUrl } from "@/server/email";

/* PDF = headless Chrome printing /i/[token]/print to A4. Used by the download link and email attachments.
   Development uses the local Chrome (CHROME_PATH). On a serverless host (Vercel) without CHROME_PATH,
   @sparticuz/chromium supplies a Chrome built for that environment. */
const serverless = () => !process.env.CHROME_PATH && !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

async function launch() {
  if (serverless()) {
    const { default: chromium } = await import("@sparticuz/chromium");
    return puppeteer.launch({ executablePath: await chromium.executablePath(), headless: true, args: [...chromium.args, "--font-render-hinting=none"] });
  }
  return puppeteer.launch({ executablePath: process.env.CHROME_PATH, headless: true, args: ["--no-sandbox", "--font-render-hinting=none"] });
}

const g = globalThis as unknown as { __invinBrowser?: Promise<Browser> };
function browser() {
  return (g.__invinBrowser ??= launch()
    .then((b) => {
      // A frozen serverless instance can lose its browser; start a fresh one next time
      b.on("disconnected", () => (g.__invinBrowser = undefined));
      return b;
    })
    .catch((e) => {
      g.__invinBrowser = undefined;
      throw e;
    }));
}

export const pdfReady = () => !!process.env.CHROME_PATH || serverless();

export const pdfName = (business: string, number: string) => `${business} ${number}.pdf`.replace(/[^\w .-]/g, "");

/** Render a customer-visible invoice to PDF bytes. Throws if Chrome isn't available. */
export async function renderInvoicePdf(token: string): Promise<Buffer> {
  return renderPathPdf(`/i/${token}/print`);
}

/** Print one of the app's public print pages (invoices, estimates) to PDF. */
export async function renderPathPdf(path: string): Promise<Buffer> {
  const page = await (await browser()).newPage();
  try {
    await page.goto(`${appUrl()}${path}`, { waitUntil: "networkidle0", timeout: 30_000 });
    await page.evaluateHandle("document.fonts.ready");
    // Page margins come from the print CSS (@page), so continuation pages get breathing room
    const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}

/** Render a self-contained HTML document (statements) to PDF bytes. */
export async function renderHtmlPdf(html: string): Promise<Buffer> {
  const page = await (await browser()).newPage();
  try {
    await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
    const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}
