import type { NextRequest } from 'next/server'
import { ScrapybaraClient } from 'scrapybara'
import pino from 'pino'

const SCRAPY_TOKEN = process.env.SCRAPY_TOKEN

const GH_CLI_INSTALL_SCRIPT = `(type -p wget >/dev/null || (sudo apt update && sudo apt-get install wget -y)) \
	&& sudo mkdir -p -m 755 /etc/apt/keyrings \
        && out=$(mktemp) && wget -nv -O$out https://cli.github.com/packages/githubcli-archive-keyring.gpg \
        && cat $out | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null \
	&& sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
	&& echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
	&& sudo apt update \
	&& sudo apt install gh -y`
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN

  const NODE_INSTALL_SCRIPT = `# Download and install nvm:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.2/install.sh | bash

# in lieu of restarting the shell
\. "$HOME/.nvm/nvm.sh"

# Download and install Node.js:
nvm install 22

# Verify the Node.js version:
node -v # Should print "v22.14.0".
nvm current # Should print "v22.14.0".

# Verify npm version:
npm -v # Should print "10.9.2".
`

export async function GET(req: NextRequest) {
  const logger = pino({
    name: 'create',
  })

  const client = new ScrapybaraClient({
    apiKey: SCRAPY_TOKEN,
  })

  const instance = await client.startUbuntu({
    timeoutHours: 10
  })

  const streamUrl = await instance.getStreamUrl()
  logger.info(`Stream URL: ${streamUrl.streamUrl}`)

  // install github auth
  await instance.bash({
    command: GH_CLI_INSTALL_SCRIPT,
  })

  const ghAuth = await instance.bash({
    command: `echo "${GITHUB_TOKEN}" | gh auth login --with-token`
  })

  if (ghAuth.error) {
    logger.error(ghAuth.error)
    return Response.json({ message: 'Failed to login to github', error: ghAuth.error }, { status: 500 })
  }

  logger.info('Successfully logged in to github')

  await instance.bash({
    command: NODE_INSTALL_SCRIPT,
  })

  await instance.bash({
    command: 'npm install --global yarn'
  })

  logger.info('Successfully installed node')

  await instance.bash({
    command: 'npm install -g @anthropic-ai/claude-code'
  })

  logger.info('Successfully installed claude')

  await instance.bash({
    command: 'gh repo clone https://github.com/Uniswap/universe.git'
  })

  logger.info('Successfully cloned universe repo')

  await instance.bash({
    command: 'sudo apt-get install ripgrep'
  })

  logger.info('Successfully installed ripgrep')

  // await instance.bash({
  //   command: 'cd universe && yarn'
  // })

  // logger.info('Successfully installed universe dependencies')

  // await instance.pause();
  logger.info('Successfully created instance')
  return Response.json({ message: 'Success' }, { status: 200 })
}