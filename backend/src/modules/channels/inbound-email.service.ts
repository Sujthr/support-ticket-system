import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { ChannelsService } from './channels.service';
import * as net from 'net';
import * as tls from 'tls';

interface ParsedEmail {
  messageId: string;
  from: string;
  subject: string;
  body: string;
  date: string;
}

@Injectable()
export class InboundEmailService {
  private readonly logger = new Logger(InboundEmailService.name);
  private processing = false;

  constructor(
    private prisma: PrismaService,
    private channelsService: ChannelsService,
  ) {}

  /**
   * Poll all configured IMAP mailboxes every 2 minutes.
   * Gracefully skips if no orgs have IMAP configured.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async pollAllMailboxes() {
    if (this.processing) return;
    this.processing = true;

    try {
      const configs = await this.prisma.channelConfig.findMany({
        where: { imapEnabled: true },
      });

      if (configs.length === 0) return;

      for (const config of configs) {
        try {
          await this.pollMailbox(config);
        } catch (error) {
          this.logger.warn(
            `Failed to poll mailbox for org ${config.organizationId}: ${error.message}`,
          );
        }
      }
    } finally {
      this.processing = false;
    }
  }

  private async pollMailbox(config: any) {
    if (!config.imapHost || !config.imapUser || !config.imapPass) {
      return;
    }

    try {
      const emails = await this.fetchUnseenEmails(config);

      for (const email of emails) {
        // Check if we already processed this email
        const existing = await this.prisma.inboundMessage.findFirst({
          where: {
            externalId: email.messageId,
            organizationId: config.organizationId,
          },
        });

        if (existing) continue;

        await this.channelsService.createTicketFromChannel({
          channel: 'EMAIL_INBOUND',
          senderIdentity: email.from,
          subject: email.subject,
          body: email.body,
          externalId: email.messageId,
          rawPayload: JSON.stringify(email),
          organizationId: config.organizationId,
        });

        this.logger.log(
          `Processed inbound email from ${email.from} for org ${config.organizationId}`,
        );
      }
    } catch (error) {
      this.logger.warn(`IMAP poll error for org ${config.organizationId}: ${error.message}`);
    }
  }

  /**
   * Lightweight IMAP client using raw sockets.
   * Connects to the IMAP server, fetches UNSEEN emails from INBOX, and marks them as SEEN.
   * This avoids adding a heavy IMAP dependency — for production, consider using 'imapflow' package.
   */
  private async fetchUnseenEmails(config: any): Promise<ParsedEmail[]> {
    const emails: ParsedEmail[] = [];

    return new Promise((resolve, reject) => {
      const port = config.imapPort || 993;
      const useTls = config.imapTls !== false;
      let buffer = '';
      let tagCounter = 1;
      let currentState: 'CONNECTING' | 'LOGIN' | 'SELECT' | 'SEARCH' | 'FETCH' | 'DONE' = 'CONNECTING';
      let unseenIds: string[] = [];
      let fetchIndex = 0;
      let currentEmail: Partial<ParsedEmail> = {};
      let fetchingBody = false;
      let bodyBuffer = '';

      const getTag = () => `A${String(tagCounter++).padStart(3, '0')}`;

      const createConnection = () => {
        if (useTls) {
          return tls.connect({ host: config.imapHost, port, rejectUnauthorized: false });
        }
        return net.connect({ host: config.imapHost, port });
      };

      const socket = createConnection();
      const timeout = setTimeout(() => {
        socket.destroy();
        resolve(emails);
      }, 30000);

      const sendCommand = (cmd: string) => {
        const tag = getTag();
        socket.write(`${tag} ${cmd}\r\n`);
        return tag;
      };

      socket.on('data', (data: Buffer) => {
        buffer += data.toString();
        const lines = buffer.split('\r\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (currentState === 'CONNECTING' && line.startsWith('* OK')) {
            currentState = 'LOGIN';
            sendCommand(`LOGIN "${config.imapUser}" "${config.imapPass}"`);
          } else if (currentState === 'LOGIN' && line.match(/^A\d+ OK/)) {
            currentState = 'SELECT';
            sendCommand('SELECT INBOX');
          } else if (currentState === 'SELECT' && line.match(/^A\d+ OK/)) {
            currentState = 'SEARCH';
            sendCommand('SEARCH UNSEEN');
          } else if (currentState === 'SEARCH' && line.startsWith('* SEARCH')) {
            unseenIds = line.replace('* SEARCH', '').trim().split(/\s+/).filter(Boolean);
          } else if (currentState === 'SEARCH' && line.match(/^A\d+ OK/)) {
            if (unseenIds.length === 0) {
              currentState = 'DONE';
              sendCommand('LOGOUT');
            } else {
              // Limit to 10 emails per poll
              unseenIds = unseenIds.slice(0, 10);
              currentState = 'FETCH';
              fetchIndex = 0;
              fetchNextEmail();
            }
          } else if (currentState === 'FETCH') {
            if (fetchingBody) {
              if (line === ')' || line.match(/^A\d+ OK/)) {
                fetchingBody = false;
                currentEmail.body = bodyBuffer.trim();
                bodyBuffer = '';

                if (currentEmail.messageId || currentEmail.from) {
                  emails.push({
                    messageId: currentEmail.messageId || `imap-${Date.now()}-${fetchIndex}`,
                    from: currentEmail.from || 'unknown',
                    subject: currentEmail.subject || '(no subject)',
                    body: currentEmail.body || '',
                    date: currentEmail.date || new Date().toISOString(),
                  });
                }

                if (line.match(/^A\d+ OK/)) {
                  // Mark as seen
                  sendCommand(`STORE ${unseenIds[fetchIndex]} +FLAGS (\\Seen)`);
                  fetchIndex++;
                  if (fetchIndex < unseenIds.length) {
                    fetchNextEmail();
                  } else {
                    currentState = 'DONE';
                    sendCommand('LOGOUT');
                  }
                }
              } else {
                bodyBuffer += line + '\n';
              }
            } else {
              // Parse headers
              const fromMatch = line.match(/^From:\s*(.+)/i);
              const subjectMatch = line.match(/^Subject:\s*(.+)/i);
              const dateMatch = line.match(/^Date:\s*(.+)/i);
              const messageIdMatch = line.match(/^Message-ID:\s*<?(.+?)>?$/i);

              if (fromMatch) currentEmail.from = fromMatch[1].trim();
              if (subjectMatch) currentEmail.subject = subjectMatch[1].trim();
              if (dateMatch) currentEmail.date = dateMatch[1].trim();
              if (messageIdMatch) currentEmail.messageId = messageIdMatch[1].trim();

              // Detect body start (empty line after headers or BODY[] literal)
              if (line === '' && currentEmail.from) {
                fetchingBody = true;
              }
            }

            if (line.match(/^A\d+ OK/) && !fetchingBody) {
              // Mark current as seen and move to next
              if (unseenIds[fetchIndex]) {
                sendCommand(`STORE ${unseenIds[fetchIndex]} +FLAGS (\\Seen)`);
              }
              fetchIndex++;
              if (fetchIndex < unseenIds.length) {
                fetchNextEmail();
              } else {
                currentState = 'DONE';
                sendCommand('LOGOUT');
              }
            }
          } else if (currentState === 'DONE' && line.match(/^A\d+ OK|^\* BYE/)) {
            // Done
          }
        }
      });

      function fetchNextEmail() {
        currentEmail = {};
        fetchingBody = false;
        bodyBuffer = '';
        sendCommand(`FETCH ${unseenIds[fetchIndex]} (BODY[HEADER.FIELDS (FROM SUBJECT DATE MESSAGE-ID)] BODY[TEXT])`);
      }

      socket.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      socket.on('close', () => {
        clearTimeout(timeout);
        resolve(emails);
      });
    });
  }

  /**
   * Test IMAP connection — used by the config UI to verify credentials.
   */
  async testConnection(config: {
    imapHost: string;
    imapPort: number;
    imapUser: string;
    imapPass: string;
    imapTls: boolean;
  }): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve) => {
      const port = config.imapPort || 993;
      const useTls = config.imapTls !== false;

      const createConnection = () => {
        if (useTls) {
          return tls.connect({ host: config.imapHost, port, rejectUnauthorized: false });
        }
        return net.connect({ host: config.imapHost, port });
      };

      const socket = createConnection();
      const timeout = setTimeout(() => {
        socket.destroy();
        resolve({ success: false, message: 'Connection timed out after 10 seconds' });
      }, 10000);

      let loggedIn = false;

      socket.on('data', (data: Buffer) => {
        const response = data.toString();
        if (response.startsWith('* OK') && !loggedIn) {
          socket.write(`A001 LOGIN "${config.imapUser}" "${config.imapPass}"\r\n`);
        } else if (response.includes('A001 OK')) {
          loggedIn = true;
          socket.write('A002 LOGOUT\r\n');
          clearTimeout(timeout);
          resolve({ success: true, message: 'IMAP connection successful' });
        } else if (response.includes('A001 NO') || response.includes('A001 BAD')) {
          clearTimeout(timeout);
          socket.destroy();
          resolve({ success: false, message: 'Authentication failed. Check username and password.' });
        }
      });

      socket.on('error', (err) => {
        clearTimeout(timeout);
        resolve({ success: false, message: `Connection error: ${err.message}` });
      });
    });
  }
}
