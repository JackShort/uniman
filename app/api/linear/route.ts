import type { NextRequest } from 'next/server'
import pino from 'pino'

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

  const body = await req.json()

  logger.info(body)

  return Response.json({ message: 'Success' }, { status: 200 })
}