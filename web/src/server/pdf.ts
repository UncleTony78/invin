import "server-only";
import puppeteer, { type Browser } from "puppeteer-core";
import { appUrl } from "@/server/email";

/* PDF = headless Chrome printing /i/[token]/print to A4. Used by the download link and email attachments.
   Development uses the local Chrome (CHROME_PATH). On a host without Chrome,
   swap in @sparticuz/chromium's executablePath; nothing else changes. */
const g = globalThis as unknown as { __invinBrowser?: Promise<Browser> };
function browser() {
  return (g.__invinBrowser ??= puppeteer
    .launch({ executablePath: process.env.CHROME_PATH, headless: true, args: ["--no-sandbox", "--font-render-hinting=none"] })
    .catch((e) => {
      g.__invinBrowser = undefined;
      throw e;
    }));
}

export const pdfReady = () => !!process.env.CHROME_PATH;

export const pdfName = (business: string, number: string) => `${business} ${number}.pdf`.replace(/[^\w .-]/g, "");

/** Render a customer-visible invoice to PDF bytes. Throws if Chrome isn't available. */
export async function renderInvoicePdf(token: string): Promise<Buffer> {
  const page = await (await browser()).newPage();
  try {
    await page.goto(`${appUrl()}/i/${token}/print`, { waitUntil: "networkidle0", timeout: 30_000 });
    await page.evaluateHandle("document.fonts.ready");
    // Page margins come from the print CSS (@page), so continuation pages get breathing room
    const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}
