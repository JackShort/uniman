import type { NextRequest } from 'next/server'
import { LinearClient } from '@linear/sdk'
import pino from 'pino'
import { exec, spawn } from 'child_process'
import * as os from 'os';
import * as path from 'path';

export const dynamic = 'force-dynamic'
export const maxDuration = 900;

const UNIMAN_LABEL = 'UNIMAN'

type LinearIssue = {
  action: string
  data: {
      id: string
      labels: {
        name: string
      }[]
      description: string | null
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

  const body = await req.json() as LinearIssue

  // Api key authentication
  const linearClient = new LinearClient({
    apiKey: process.env.LINEAR_API_KEY
  })

  const issue = await linearClient.issue(body.data.id)

  if (body.action !== 'create' || !issue.description || !body.data.labels.some((label) => label.name === UNIMAN_LABEL)) {
    logger.info('Not an uniman action')
    return Response.json({ message: 'Not an uniman action' }, { status: 200 })
  }

  linearClient.createComment({
    issueId: body.data.id,
    body: 'Uniman is coming to the rescue! \n ![alt text](https://sdmntprnorthcentralus.oaiusercontent.com/files/00000000-33f0-622f-9f9a-7f140b6e97ca/raw?se=2025-04-09T20%3A24%3A20Z&sp=r&sv=2024-08-04&sr=b&scid=419dbe1d-83a6-5ce7-839a-db7720769c1a&skoid=de76bc29-7017-43d4-8d90-7a49512bae0f&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2025-04-09T17%3A58%3A07Z&ske=2025-04-10T17%3A58%3A07Z&sks=b&skv=2024-08-04&sig=PrZPLl9dMRagCwSANN726s4XaPlInWgiAd4qgKwgs0M%3D)"'
  })

const universeDir = path.join(os.homedir(), 'Documents', 'universe');
const claudeCommand = 'claude'; // Or full path
// const logPath = path.join(universeDir, 'claudeLog.txt');

logger.info(`Spawning command in directory: ${universeDir}`);
// console.log(`Command: ${claudeCommand} [args] > ${logPath}`);

exec(`cd ${universeDir} && gt create ${issue.branchName}`)

const claudeProcess = spawn(
  claudeCommand,
  [ // Arguments are passed as an array
    '-p',
    issue.description,
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