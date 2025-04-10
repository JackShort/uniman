import type { NextRequest } from 'next/server'
import { Issue, LinearClient } from '@linear/sdk'
import pino from 'pino'
import { exec, spawn } from 'child_process'
import * as os from 'os';
import * as path from 'path';

export const dynamic = 'force-dynamic'
export const maxDuration = 900;

const UNIMAN_LABEL = 'UNIMAN'

type LinearIssue = {
  action: string
  type: 'Issue'
  data: {
      id: string
      labels: {
        name: string
      }[]
      description: string | null
    }
} | {
  action: string
  type: 'Comment'
  data: {
    body: string
    issueId: string
  }
}

export async function GET() {
  const logger = pino({
    name: 'linear',
  })

  logger.info('Linear API called')

  return Response.json({ message: 'Success' }, { status: 200 })
}

export async function POST(req: NextRequest) {
  const logger = pino({
    name: 'linear',
  })

  const linearClient = new LinearClient({
    apiKey: process.env.LINEAR_API_KEY
  })

  const body = await req.json() as LinearIssue

  let issue: Issue
  let reroll = false
  let rerollCommand: string | undefined
  if (body.type === 'Comment') {
    if (!body.data.body.startsWith("reroll")) {
      logger.info('Not an uniman action')
      return Response.json({ message: 'Not an uniman action' }, { status: 200 })
    }

    if (body.data.body.startsWith("reroll:")) {
      rerollCommand = body.data.body.split(":")[1]
      if (rerollCommand.length === 0) {
        rerollCommand = undefined
      }
    }

    issue = await linearClient.issue(body.data.issueId)
    reroll = true
  } else {
    issue = await linearClient.issue(body.data.id)
  }

  const labels = await issue.labels()
  const label = labels.nodes.find((label) => label.name === UNIMAN_LABEL)

  if (!label) {
    logger.info('Not an uniman action')
    return Response.json({ message: 'Not an uniman action' }, { status: 200 })
  }

  if (body.action !== 'create' || !issue.description) {
    logger.info('Not an uniman action')
    return Response.json({ message: 'Not an uniman action' }, { status: 200 })
  }

  linearClient.createComment({
    issueId: issue.id,
    body: 'Uniman is coming to the rescue! \n ![alt text](https://sdmntprnorthcentralus.oaiusercontent.com/files/00000000-13cc-522f-8120-907d2b0ebf2a/raw?se=2025-04-09T20%3A54%3A51Z&sp=r&sv=2024-08-04&sr=b&scid=d876236a-2797-59a4-962e-0a3546b4aa2d&skoid=de76bc29-7017-43d4-8d90-7a49512bae0f&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2025-04-09T17%3A58%3A05Z&ske=2025-04-10T17%3A58%3A05Z&sks=b&skv=2024-08-04&sig=5BPofh6yqWMqUhMkWZdK8sHbeoL6H96we4nwqLbFH9M%3D)"'
  })

const universeDir = path.join(os.homedir(), 'Documents', 'universe');
const claudeCommand = 'claude'; // Or full path
// const logPath = path.join(universeDir, 'claudeLog.txt');

logger.info(`Spawning command in directory: ${universeDir}`);
// console.log(`Command: ${claudeCommand} [args] > ${logPath}`);

if (reroll) {
  exec(`cd ${universeDir} && gt checkout ${issue.branchName}`)
} else {
  exec(`cd ${universeDir} && gt create ${issue.branchName}`)
}

let prompt = issue.description
if (rerollCommand) {
  prompt = `Goal:${claudeCommand}\nNotes:${rerollCommand}`
}

console.log(prompt)

const claudeProcess = spawn(
  claudeCommand,
  [ // Arguments are passed as an array
    '-p',
    prompt,
    '--allowedTools',
    'Edit',
  ],
  {
    cwd: universeDir,
    stdio: ['ignore', 'pipe', 'pipe'], // stdin, stdout, stderr
    shell: false, // Use false unless you NEED shell features within spawn itself
  }
);

  // const logStream = fs.createWriteStream(logPath, { flags: 'w' });

  // claudeProcess.stdout.pipe(logStream); // Pipe stdout to log file
  claudeProcess.stderr.pipe(process.stderr); // Pipe stderr to Node's stderr

  try {
    const p = new Promise((resolve, reject) => {
      claudeProcess.on('spawn', () => {
        logger.info(`Spawned child pid: ${claudeProcess.pid}`);
      });
      
      claudeProcess.on('error', (err) => {
        logger.error('Failed to start subprocess.', err);
        // logStream.end();
        reject(err);
      });
      
      claudeProcess.on('close', (code, signal) => {
        logger.info(`child process closed with code ${code} and signal ${signal}`);
        // logStream.end();
        if (code === 0) {
          logger.info(`Adding and submitting changes for ${issue.branchName}`)
          exec(`cd ${universeDir} && gt add . && gt modify --no-verify --no-interactive -m "chore(uniman): ${issue.title}" && gt submit`)
          resolve(true);
        } else {
          reject(new Error(`Process exited with code ${code}`));
        }
      });
    });

    await p;
  } catch (error) {
    logger.error('Error executing claude process:', error);
    return Response.json({ message: 'Error executing process' }, { status: 500 });
  }

  return Response.json({ message: 'Success' }, { status: 200 }) 
}