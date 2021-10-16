import puppeteer from "puppeteer"
import { Cluster } from "puppeteer-cluster"
import { writeFile, readFile } from "fs/promises"

const username = "" // Matricula
const password = "" // Senha

const args = [
  "--autoplay-policy=user-gesture-required",
  "--disable-background-networking",
  "--disable-background-timer-throttling",
  "--disable-backgrounding-occluded-windows",
  "--disable-breakpad",
  "--disable-client-side-phishing-detection",
  "--disable-component-update",
  "--disable-default-apps",
  "--disable-dev-shm-usage",
  "--disable-domain-reliability",
  "--disable-extensions",
  "--disable-features=AudioServiceOutOfProcess",
  "--disable-hang-monitor",
  "--disable-ipc-flooding-protection",
  "--disable-notifications",
  "--disable-offer-store-unmasked-wallet-cards",
  "--disable-popup-blocking",
  "--disable-print-preview",
  "--disable-prompt-on-repost",
  "--disable-renderer-backgrounding",
  "--disable-setuid-sandbox",
  "--disable-speech-api",
  "--disable-sync",
  "--hide-scrollbars",
  "--ignore-gpu-blacklist",
  "--metrics-recording-only",
  "--mute-audio",
  "--no-default-browser-check",
  "--no-first-run",
  "--no-pings",
  "--no-sandbox",
  "--no-zygote",
  "--password-store=basic",
  "--use-gl=swiftshader",
  "--use-mock-keychain",
  "--disable-accelerated-2d-canvas",
  "--disable-gpu"
]

async function click(page: puppeteer.Page, selector: string) {
  const element = await page.waitForSelector(selector)
  await element.click()
}

async function login(page: puppeteer.Page, username: string, password: string) {
  await page.setRequestInterception(true)
  await page.setJavaScriptEnabled(false)

  var login = false

  page.on("request", request => {
    if (login) {
      request.continue({
        method: "POST",
        postData: `csrfmiddlewaretoken=${csrf_token}&username=${username}&password=${password}&this_is_the_login_form=1&next=%2F`,
        headers: {
          ...request.headers(),
          "Content-Type": "application/x-www-form-urlencoded"
        }
      })
    } else if (request.resourceType() != "document") {
      request.abort()
    } else {
      request.continue()
    }
  })

  await page.goto("https://suap.ifrn.edu.br")

  var cookies = await page.cookies()
  const csrf_token = cookies[1].value

  login = true

  await page.goto("https://suap.ifrn.edu.br/accounts/login/?next=/")

  cookies = await page.cookies()
  await writeFile("./cookies.json", JSON.stringify(cookies, null, 2))
}

async function getCPF(page: puppeteer.Page) {
  await page.setRequestInterception(true)
  await page.setJavaScriptEnabled(false)

  page.on("request", (request) => {
    if (request.resourceType() != "document"){
      request.abort()
    }
    else {
      request.continue()
    }
  })

  const cookies = await readFile("./cookies.json")

  await page.setCookie(...JSON.parse(cookies.toString()))
  await page.goto("https://suap.ifrn.edu.br/edu/aluno/20211144010044/?tab=boletim")

  const element = await page.waitForSelector("#content > div.box > div > div > div:nth-child(2) > table > tbody > tr:nth-child(3) > td:nth-child(2)")
  const value = await element.evaluate(el => el.textContent)
  console.log(value)
}

async function main() {
  const cluster = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_CONTEXT,
    maxConcurrency: 25,
    puppeteerOptions: { args },
  })

  // Fazer login e salvar a sessão
  cluster.queue("https://suap.ifrn.edu.br", async ({ page }) => {
    await login(page, username, password)
  })
  // Obter o CPF
  cluster.queue("", async ({ page }) => {
    await getCPF(page)
  })

  await cluster.idle()
  await cluster.close()
}

main().then()
