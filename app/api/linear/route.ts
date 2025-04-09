import type { NextRequest } from 'next/server'
import pino from 'pino'
import { spawn } from 'child_process'
import * as os from 'os';
import * as path from 'path';

export const dynamic = 'force-dynamic'
export const maxDuration = 900;

const UNIMAN_LABEL = 'UNIMAN'

type LinearIssue = {
  action: string
  data: {
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

  if (body.action !== 'create' || !body.data.description || !body.data.labels.some((label) => label.name === UNIMAN_LABEL)) {
    logger.info('Not an uniman action')
    return Response.json({ message: 'Not an uniman action' }, { status: 200 })
  }

  // const claudeExec = exec(`cd ~/Documents/universe && claude -p "The color of the 'Get started' button is wrong. It should be accent1. Please fix it." --allowedTools Edit > log.txt`, (err) => {
  //   if (err) {
  //     logger.error(err)
  //     return Response.json({ message: 'Error' }, { status: 500 })
  //   } 
  // })

const universeDir = path.join(os.homedir(), 'Documents', 'universe');
const claudeCommand = 'claude'; // Or full path
// const logPath = path.join(universeDir, 'claudeLog.txt');

console.log(`Spawning command in directory: ${universeDir}`);
// console.log(`Command: ${claudeCommand} [args] > ${logPath}`);

const claudeProcess = spawn(
  claudeCommand,
  [ // Arguments are passed as an array
    '-p',
    body.data.description,
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
        console.log(`Spawned child pid: ${claudeProcess.pid}`);
      });
      
      claudeProcess.on('error', (err) => {
        console.error('Failed to start subprocess.', err);
        // logStream.end();
        reject(err);
      });
      
      claudeProcess.on('close', (code, signal) => {
        console.log(`child process closed with code ${code} and signal ${signal}`);
        // logStream.end();
        if (code === 0) {
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